
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const VERSION = "1.0.8";

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
       timestamp: new Date().toISOString(),
       env: {
         HAS_TENANT_ID: !!Deno.env.get('AZURE_TENANT_ID'),
         HAS_CLIENT_ID: !!Deno.env.get('AZURE_CLIENT_ID'),
         HAS_SENDER: !!Deno.env.get('SYSTEM_SENDER_EMAIL')
       }
     }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    console.log(`[v${VERSION}] Processing ${req.method} request`);
    
    const authHeader = req.headers.get('Authorization')

    if (req.method !== 'GET' && !authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401 
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    )

    // Privileged client for DB checks & writes (Bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse Body
    const body = await req.json();
    const { email, from_email, site_id, invited_by_name, subject, html } = body;

    if (!email) throw new Error("Target email is required");

    // 1. Verify Caller Identity (must utilize the Auth Header)
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth verify failed:", authError);
      throw new Error("Could not verify your identity. Please log in again.");
    }

    // 2. Check Permissions (Use Admin Client to ensure we can read the user role)
    const { data: dbUser, error: dbUserError } = await supabaseAdmin
      .from('users')
      .select('id, role_id, site_ids')
      .eq('auth_user_id', user.id)
      .single();

    if (dbUserError || !dbUser) {
      console.error("User database resolve failed:", dbUserError);
      throw new Error("Your user record was not found in the directory.");
    }

    if (!['ADMIN', 'SITE_ADMIN', 'OWNER'].includes(dbUser.role_id)) {
      throw new Error("Insufficient permissions to send invitations.");
    }

    // 3. Invite Tracking (Use Admin Client to ensure write succeeds)
    const token = crypto.randomUUID()
    const msgBuffer = new TextEncoder().encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { error: inviteError } = await supabaseAdmin
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
      // We continue even if invite tracking fails, but log it
    }

    // 4. Microsoft Graph Integration & Dynamically determined Sender
    const tenantId = Deno.env.get('AZURE_TENANT_ID')
    const clientId = Deno.env.get('AZURE_CLIENT_ID')
    const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')
    const envSender = Deno.env.get('SYSTEM_SENDER_EMAIL')

    // DYNAMIC SENDER LOOKUP: Check if DB has a configured sender in branding
    let dbSender = null;
    try {
      const { data: brandingData } = await supabaseClient
        .from('app_config')
        .select('value')
        .eq('key', 'branding')
        .maybeSingle();
      
      if (brandingData?.value?.emailTemplate?.fromEmail) {
        dbSender = brandingData.value.emailTemplate.fromEmail;
        console.log(`[v${VERSION}] Using DB-configured sender: ${dbSender}`);
      }
    } catch (e) {
      console.warn(`[v${VERSION}] Failed to fetch DB sender, using env fallback:`, e.message);
    }

    const senderToUse = dbSender || envSender || from_email;

    if (!tenantId || !clientId || !clientSecret || !senderToUse) {
      throw new Error("Email service misconfigured: Missing Azure secrets or sender email.");
    }

    console.log(`[v${VERSION}] Fetching token for ${senderToUse}...`);
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
       console.error("Azure Token Error:", err);
       throw new Error(`Email Authentication Failed: ${tokenResp.statusText}`);
    }

    const { access_token } = await tokenResp.json()

    // 5. Template Construction
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
        </div>
      `;
    }

    // 6. Send via Graph
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

    console.log(`[v${VERSION}] Sending email via ${senderToUse} to ${email}...`);
    const sendUrl = `https://graph.microsoft.com/v1.0/users/${senderToUse}/sendMail`
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
      console.error("Microsoft Graph Error:", err)
      const graphError = JSON.parse(err);
      throw new Error(`Mail Server Error: ${graphError.error?.message || emailResp.statusText}`);
    }

    console.log(`[v${VERSION}] Successfully sent to ${email}`);
    return new Response(JSON.stringify({ success: true, version: VERSION }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(`[v${VERSION}] Fatal:`, error.message);
    return new Response(JSON.stringify({ error: error.message, version: VERSION }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
