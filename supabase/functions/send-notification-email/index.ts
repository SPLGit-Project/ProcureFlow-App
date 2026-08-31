import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const VERSION = "1.0.0";

console.log(`send-notification-email function v${VERSION} initialized.`);

Deno.serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Diagnostic endpoint
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      status: 'online', 
      function: 'send-notification-email',
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
    const authHeader = req.headers.get('Authorization');
    const apikey = req.headers.get('apikey');

    if (!authHeader && !apikey) {
      return new Response(JSON.stringify({ error: 'Missing Authorization or apikey header' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401 
      });
    }

    interface EmailRequest {
      to: string | string[];
      subject: string;
      html: string;
      from_email?: string;
      reply_to?: string;
    }

    const body: EmailRequest = await req.json();
    const { to, subject, html, from_email } = body;

    if (!to) throw new Error("Target recipient email ('to') is required.");
    if (!subject) throw new Error("Email 'subject' is required.");
    if (!html) throw new Error("Email 'html' content is required.");

    const recipientList: string[] = Array.isArray(to) ? to : [to];

    // Microsoft Graph Integration & Sender Resolution
    const tenantId = Deno.env.get('AZURE_TENANT_ID');
    const clientId = Deno.env.get('AZURE_CLIENT_ID');
    const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET');
    const envSender = Deno.env.get('SYSTEM_SENDER_EMAIL');

    const senderToUse = from_email || envSender || 'aaron.bell@splservices.com.au';

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("Email service misconfigured: Missing Azure tenant secrets (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET).");
    }

    console.log(`[send-notification-email] Authenticating with Microsoft Graph for sender: ${senderToUse}...`);
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default'
      })
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error("[send-notification-email] Azure OAuth Token Error:", errText);
      throw new Error(`Azure Token Acquisition Failed: ${tokenResp.status} ${tokenResp.statusText} - ${errText}`);
    }

    const { access_token } = await tokenResp.json();

    // Construct Microsoft Graph Mail Message
    const emailRequest = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: html,
        },
        toRecipients: recipientList.map(addr => ({ emailAddress: { address: addr.trim() } })),
      },
      saveToSentItems: 'false',
    };

    console.log(`[send-notification-email] Dispatching email to [${recipientList.join(', ')}] via ${senderToUse}...`);
    const sendUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderToUse)}/sendMail`;
    const emailResp = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailRequest),
    });

    if (!emailResp.ok) {
      const graphError = await emailResp.text();
      console.error("[send-notification-email] Microsoft Graph sendMail Error:", graphError);
      throw new Error(`Microsoft Graph API Error: ${emailResp.status} ${emailResp.statusText} - ${graphError}`);
    }

    console.log(`[send-notification-email] Successfully delivered email to ${recipientList.length} recipients!`);

    return new Response(JSON.stringify({ 
      success: true, 
      recipients: recipientList,
      sender: senderToUse,
      timestamp: new Date().toISOString()
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    });

  } catch (error: any) {
    console.error("[send-notification-email] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    });
  }
});
