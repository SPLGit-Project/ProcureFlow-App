import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const VERSION = "1.0.0";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function resolveUserEmailFromGraph(aadObjectId: string): Promise<string | null> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret || !aadObjectId) return null;

  try {
    const tokenResp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    });
    if (!tokenResp.ok) return null;
    const { access_token } = await tokenResp.json();
    if (!access_token) return null;

    const userResp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(aadObjectId)}?$select=mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!userResp.ok) return null;
    const userJson = await userResp.json();
    const email = userJson.mail || userJson.userPrincipalName;
    return typeof email === "string" ? email.toLowerCase() : null;
  } catch {
    return null;
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
        function: "teams-bot-webhook",
        version: VERSION,
        hasBotConfig: Boolean(Deno.env.get("TEAMS_BOT_APP_ID")),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const botAppId = Deno.env.get("TEAMS_BOT_APP_ID") || "";

    // Basic Bot Framework Bearer JWT validation (audience & issuer check)
    if (botAppId) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Missing Bot Framework Bearer token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
      const claims = decodeJwtPayload(authHeader.slice(7));
      const iss = String(claims?.iss || "");
      const aud = String(claims?.aud || "");
      const exp = Number(claims?.exp || 0);
      const validIssuer =
        iss.startsWith("https://api.botframework.com") ||
        iss.startsWith("https://sts.windows.net/") ||
        iss.startsWith("https://login.microsoftonline.com/");
      if (!claims || !validIssuer || aud !== botAppId || exp * 1000 < Date.now()) {
        return new Response(JSON.stringify({ error: "Invalid Bot Framework token claims" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
    }

    const activity = await req.json();
    const serviceUrl = String(activity?.serviceUrl || "").replace(/\/+$/, "") + "/";
    const conversationId = String(activity?.conversation?.id || "");
    const tenantId = String(
      activity?.channelData?.tenant?.id || activity?.conversation?.tenantId || Deno.env.get("AZURE_TENANT_ID") || ""
    );
    const aadObjectId = String(
      activity?.from?.aadObjectId ||
        activity?.membersAdded?.[0]?.aadObjectId ||
        ""
    );

    if (serviceUrl !== "/" && conversationId && aadObjectId) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      let userEmail = await resolveUserEmailFromGraph(aadObjectId);
      if (!userEmail) {
        const { data: userRow } = await supabaseAdmin
          .from("users")
          .select("email")
          .or(`id.eq.${aadObjectId},auth_user_id.eq.${aadObjectId}`)
          .maybeSingle();
        if (userRow?.email) userEmail = String(userRow.email).toLowerCase();
      }

      if (userEmail) {
        await supabaseAdmin.from("teams_bot_installations").upsert(
          {
            user_email: userEmail,
            aad_object_id: aadObjectId,
            tenant_id: tenantId,
            conversation_id: conversationId,
            service_url: serviceUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_email" }
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[teams-bot-webhook] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
