import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const VERSION = "1.0.0";

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
      mode,
      webhookUrl,
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

    let targetUrl = typeof webhookUrl === "string" ? webhookUrl.trim() : "";
    let resolvedMode = mode || "CHANNEL_WEBHOOK";

    // Resolve server-side from app_config if webhookUrl wasn't passed explicitly
    if (!targetUrl) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: configs } = await supabaseAdmin
        .from("app_config")
        .select("key, value")
        .in("key", ["teams_config", "teams_webhook_url"]);

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

      if (directBotUrl) {
        targetUrl = directBotUrl;
        resolvedMode = "DIRECT_BOT";
      } else if (isEscalation && cooEscUrl) {
        targetUrl = cooEscUrl;
        resolvedMode = "CHANNEL_WEBHOOK";
      } else if (siteId && siteWebhooks[siteId]) {
        targetUrl = siteWebhooks[siteId];
        resolvedMode = "CHANNEL_WEBHOOK";
      } else {
        targetUrl = defaultUrl;
        resolvedMode = "CHANNEL_WEBHOOK";
      }
    }

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "No Teams webhook URL configured." }),
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

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Teams webhook returned HTTP ${resp.status}: ${errText}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: resolvedMode,
        recipientEmail: recipientEmail || null,
        status: resp.status,
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
