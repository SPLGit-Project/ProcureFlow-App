
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERSION = "1.0.2";

console.log(`send-invite-email function v${VERSION} initialized.`);

Deno.serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Diagnostic endpoint
  if (req.method === 'GET') {
     return new Response(JSON.stringify({ 
       status: 'online', 
       version: VERSION,
       timestamp: new Date().toISOString()
     }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    console.log(`[v${VERSION}] Processing ${req.method} request to send-invite-email`);
    
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401 
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get input params
    const body = await req.json();
    const { email, site_id, invited_by_name, subject, html } = body;

    if (!email) throw new Error("Email is required");

    // 1. Verify the requester via Supabase Auth
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth verify failed:", authError);
      throw new Error("Could not verify your identity");
    }
    console.log(`Caller: ${user.email} (${user.id})`);

    // 2. Resolve requester role
    const { data: dbUser, error: dbUserError } = await supabaseClient
      .from('users')
      .select('id, role_id, site_ids')
      .eq('auth_user_id', user.id)
      .single();

    if (dbUserError || !dbUser) {
      console.error("User database resolve failed:", dbUserError);
      throw new Error("User record not found in system directory");
    }

    if (!['ADMIN', 'SITE_ADMIN'].includes(dbUser.role_id)) {
      console.warn(`User ${user.email} with role ${dbUser.role_id} attempted to invite.`);
      throw new Error("Insufficient permissions to send invitations");
    }

    // 3. Invite Generation
    const token = crypto.randomUUID()
    const msgBuffer = new TextEncoder().encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // 4. Persistence
    const { error: inviteError } = await supabaseClient
      .from('invites')
      .insert({
        email,
        site_id: site_id || null,
        token_hash: tokenHash,
        invited_by: dbUser.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })

    if (inviteError) {
      console.error("Database Insert Error:", inviteError.message);
      throw new Error(`Invitation tracking failed: ${inviteError.message}`);
    }

    // 5. Microsoft Graph Email Integration
    const tenantId = Deno.env.get('AZURE_TENANT_ID')
    const clientId = Deno.env.get('AZURE_CLIENT_ID')
    const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')
    const senderEmail = Deno.env.get('SYSTEM_SENDER_EMAIL')

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      console.error("Server Configuration Missing Secrets");
      throw new Error("Email service is temporarily unavailable (Config Error)");
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default'
      })
    })

    if (!tokenResp.ok) {
       const err = await tokenResp.text();
       console.error("Azure Token Fetch Failed:", err);
       throw new Error("Could not connect to the email provider");
    }

    const { access_token } = await tokenResp.json()

    // Email Template Preparation
    const origin = req.headers.get('origin') || 'https://procureflow.splservices.com.au'
    const inviteUrl = `${origin}/invite?token=${token}`
    
    let finalHtml = html || "";
    if (finalHtml && finalHtml.includes("{link}")) {
      finalHtml = finalHtml.replace(/{link}/g, `<a href="${inviteUrl}" target="_blank" style="color: #2563eb; font-weight: bold;">Accept Invitation</a>`);
    } else if (!finalHtml) {
      finalHtml = `
        <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; margin: 20px auto;">
          <h2 style="color: #1f2937;">Welcome to ProcureFlow</h2>
          <p style="color: #4b5563;">You've been invited by <strong>${invited_by_name || 'an Admin'}</strong> to join the platform.</p>
          <div style="margin: 32px 0;">
            <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Join ProcureFlow</a>
          </div>
          <p style="color: #9ca3af; font-size: 13px;">This invitation link will expire in 7 days.</p>
          <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">If the button above doesn't work, copy and paste this URL into your browser:</p>
          <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">${inviteUrl}</p>
        </div>
      `;
    }

    const emailRequest = {
      message: {
        subject: subject || `Invitation to join ProcureFlow`,
        body: {
          contentType: 'HTML',
          content: finalHtml,
        },
        toRecipients: [{ emailAddress: { address: email } }],
      },
      saveToSentItems: 'false',
    }

    const sendUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`
    const emailResp = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailRequest),
    })

    if (!emailResp.ok) {
      const err = await emailResp.text()
      console.error("Microsoft Graph Send Failed:", err)
      throw new Error("Email provider rejected the message");
    }

    console.log(`Invite successfully sent to ${email}`);
    return new Response(JSON.stringify({ success: true, message: 'Invitation sent' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Edge Function Exception:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
