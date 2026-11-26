import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const VERSION = "1.1.0";

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

    // Strictly resolve destination from approved server-side app_config (ignore any client-supplied URL)
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
      // Escalations never fall back to site/public channels
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
