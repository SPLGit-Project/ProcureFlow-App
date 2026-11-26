import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const VERSION = "1.2.0";

async function trySendViaCustomBot(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  recipientEmail: string;
  card: Record<string, unknown>;
}): Promise<{ delivered: boolean; error?: string; httpStatus?: number }> {
  const botAppId = Deno.env.get("TEAMS_BOT_APP_ID") || "";
  const botAppSecret = Deno.env.get("TEAMS_BOT_APP_SECRET") || "";
  const tenantId = Deno.env.get("AZURE_TENANT_ID") || "";
  if (!botAppId || !botAppSecret || !tenantId || !params.recipientEmail) {
    return { delivered: false };
  }

  const emailLower = params.recipientEmail.toLowerCase();
  const { data: install } = await params.supabaseAdmin
    .from("teams_bot_installations")
    .select("conversation_id, service_url")
    .eq("user_email", emailLower)
    .maybeSingle();

  if (!install?.conversation_id || !install?.service_url) {
    return { delivered: false, error: "Custom bot not yet installed for recipient" };
  }

  try {
    const tokenResp = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: botAppId,
          client_secret: botAppSecret,
          scope: "https://api.botframework.com/.default",
        }),
      }
    );
    if (!tokenResp.ok) {
      return { delivered: false, error: `Bot token HTTP ${tokenResp.status}` };
    }
    const { access_token } = await tokenResp.json();
    if (!access_token) return { delivered: false, error: "Missing Bot Framework token" };

    const serviceBase = String(install.service_url).replace(/\/+$/, "");
    const activityUrl = `${serviceBase}/v3/conversations/${encodeURIComponent(install.conversation_id)}/activities`;
    const resp = await fetch(activityUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "message",
        attachments: (params.card as any)?.attachments || [],
      }),
    });

    return {
      delivered: resp.ok,
      httpStatus: resp.status,
      error: resp.ok ? undefined : `Bot Framework HTTP ${resp.status}`,
    };
  } catch (err: unknown) {
    return {
      delivered: false,
      error: err instanceof Error ? err.message : "Custom bot exception",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "online",
        function: "send-teams-notification",
        version: VERSION,
        hasCustomBot: Boolean(Deno.env.get("TEAMS_BOT_APP_ID")),
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    const apikey = req.headers.get("apikey");
    if (!authHeader && !apikey) {
      return new Response(JSON.stringify({ error: "Missing Authorization or apikey header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json();
    const {
      recipientEmail,
      recipientName,
      siteId,
      eventType,
      title,
      card,
    } = body || {};

    if (!card) {
      throw new Error("Adaptive Card payload ('card') is required.");
    }

    // Priority 1: Dedicated Custom Teams Bot ('ProcureFlow Approval Bot') if installed for recipient
    if (recipientEmail) {
      const customRes = await trySendViaCustomBot({ supabaseAdmin, recipientEmail, card });
      if (customRes.delivered) {
        await supabaseAdmin.from("notification_delivery_logs").insert({
          event_type: eventType || "TEAMS_NOTIFICATION",
          channel: "TEAMS",
          recipient: recipientEmail,
          status: "DELIVERED",
          title: title || "ProcureFlow Approval Notification",
          payload: { mode: "CUSTOM_BOT", siteId: siteId || null, httpStatus: customRes.httpStatus },
          error_message: null,
        });
        return new Response(
          JSON.stringify({
            success: true,
            mode: "CUSTOM_BOT",
            recipientEmail,
            status: customRes.httpStatus || 200,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Priority 2: Approved server-side app_config (Power Automate 1:1 Direct Bot or site/COO webhook)
    const { data: configs, error: cfgErr } = await supabaseAdmin
      .from("app_config")
      .select("key, value")
      .in("key", ["teams_config", "teams_webhook_url"]);

    if (cfgErr) {
      throw new Error(`Failed to load server-side Teams config: ${cfgErr.message}`);
    }

    let directBotUrl = "";
    let cooEscUrl = "";
    let defaultUrl = "";
    let siteWebhooks: Record<string, string> = {};

    for (const row of configs || []) {
      if (row.key === "teams_webhook_url" && typeof row.value === "string") {
        defaultUrl = row.value;
      } else if (row.key === "teams_config" && row.value) {
        if (row.value.directBotWebhookUrl) directBotUrl = row.value.directBotWebhookUrl;
        if (row.value.cooEscalationWebhookUrl) cooEscUrl = row.value.cooEscalationWebhookUrl;
        if (row.value.webhookUrl) defaultUrl = row.value.webhookUrl;
        if (row.value.siteWebhooks && typeof row.value.siteWebhooks === "object") {
          siteWebhooks = row.value.siteWebhooks;
        }
      }
    }

    const isEscalation =
      eventType === "PO_ESCALATED_TO_COO" || eventType === "ESCALATION_MANAGER_ALERT";

    let targetUrl = "";
    let resolvedMode: "DIRECT_BOT" | "CHANNEL_WEBHOOK" = "CHANNEL_WEBHOOK";

    if (directBotUrl && recipientEmail) {
      targetUrl = directBotUrl;
      resolvedMode = "DIRECT_BOT";
    } else if (isEscalation) {
      targetUrl = cooEscUrl;
      resolvedMode = "CHANNEL_WEBHOOK";
    } else if (siteId && siteWebhooks[siteId]) {
      targetUrl = siteWebhooks[siteId];
      resolvedMode = "CHANNEL_WEBHOOK";
    } else {
      targetUrl = defaultUrl;
      resolvedMode = "CHANNEL_WEBHOOK";
    }

    if (!targetUrl) {
      const msg = isEscalation
        ? "No approved Direct Bot or COO Escalation Teams destination configured."
        : "No approved Teams destination configured for this site.";
      await supabaseAdmin.from("notification_delivery_logs").insert({
        event_type: eventType || "TEAMS_NOTIFICATION",
        channel: "TEAMS",
        recipient: recipientEmail || siteId || "unconfigured",
        status: "FAILED",
        title: title || "ProcureFlow Notification",
        payload: { mode: resolvedMode, siteId: siteId || null },
        error_message: msg,
      });
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const outboundPayload =
      resolvedMode === "DIRECT_BOT"
        ? {
            recipientEmail: recipientEmail || "",
            recipientName: recipientName || "",
            siteId: siteId || "",
            eventType: eventType || "SITE_MANAGER_APPROVAL_REQUIRED",
            title: title || "ProcureFlow Approval Notification",
            card,
          }
        : card;

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outboundPayload),
    });

    const respText = await resp.text().catch(() => "");
    if (!resp.ok) {
      const errMsg = `Teams webhook returned HTTP ${resp.status}`;
      await supabaseAdmin.from("notification_delivery_logs").insert({
        event_type: eventType || "TEAMS_NOTIFICATION",
        channel: "TEAMS",
        recipient: recipientEmail || siteId || "channel",
        status: "FAILED",
        title: title || "ProcureFlow Notification",
        payload: { mode: resolvedMode, siteId: siteId || null, httpStatus: resp.status },
        error_message: errMsg,
      });
      return new Response(
        JSON.stringify({ success: false, error: errMsg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    await supabaseAdmin.from("notification_delivery_logs").insert({
      event_type: eventType || "TEAMS_NOTIFICATION",
      channel: "TEAMS",
      recipient: recipientEmail || siteId || "channel",
      status: "DELIVERED",
      title: title || "ProcureFlow Notification",
      payload: { mode: resolvedMode, siteId: siteId || null, httpStatus: resp.status },
      error_message: null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        mode: resolvedMode,
        recipientEmail: recipientEmail || null,
        status: resp.status,
        bodyPreview: respText ? respText.slice(0, 120) : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-teams-notification] Error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
