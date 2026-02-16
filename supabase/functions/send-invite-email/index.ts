
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
      // 1. Verify User is Admin via RLS (Indirectly via what they can pass)
      // Actually, we must trust the CALLER if it's the client.
      // But sending email is sensitive. 
      // Better pattern: Client inserts into 'invites' table -> Trigger (or CRON) calls this function?
      // OR: Client calls this function, we verify permissions.
      
      const authHeader = req.headers.get('Authorization')
      const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader! } } }
      )

      const { email, site_id, invited_by_name, subject, html } = await req.json()

      // Verify the user is an admin or allowed to invite
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
      if (userError || !user) throw new Error("Unauthorized")

      // Check role
      const { data: dbUser } = await supabaseClient
          .from('users')
          .select('id, role_id, site_ids')
          .eq('auth_user_id', user.id)
          .single()
      
      if (!dbUser || (dbUser.role_id !== 'ADMIN' && dbUser.role_id !== 'SITE_ADMIN')) {
          throw new Error("Insufficient Permissions")
      }
      if (dbUser.role_id === 'SITE_ADMIN' && !dbUser.site_ids.includes(site_id)) {
           throw new Error("Unauthorized for this site")
      }

      // 2. Generate Token & Create Invite Record
      const token = crypto.randomUUID()
      
      // Simple sha256 hash
      const msgBuffer = new TextEncoder().encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

      // Insert into DB
      const { error: insertError } = await supabaseClient 
          .from('invites')
          .insert({
              site_id,
              email,
              token_hash: tokenHash, 
              invited_by: dbUser.id, 
              expires_at: expiresAt
          })
      
      if (insertError) throw insertError

      // 3. Send Email via Graph (Application Permission)
      const tenantId = Deno.env.get('AZURE_TENANT_ID')
      const clientId = Deno.env.get('AZURE_CLIENT_ID')
      const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')
      const senderEmail = Deno.env.get('SYSTEM_SENDER_EMAIL') 

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
      const { access_token } = await tokenResp.json()

      const origin = req.headers.get('origin') || 'https://procureflow.splservices.com.au'
      const inviteUrl = `${origin}/invite?token=${token}`
      
      // If custom html is provided, replace {link} with inviteUrl
      let finalHtml = html
    if (finalHtml) {
      finalHtml = finalHtml
        .replace(/{link}/g, `<a href="${inviteUrl}">${inviteUrl}</a>`)
        .replace(/{invited_by_name}/g, invited_by_name || 'Admin')
    } else {
      finalHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome to ProcureFlow</h1>
          <p>You have been invited to join by ${invited_by_name}.</p>
          <div style="margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; rounded: 8px; font-weight: bold;">Accept Invitation</a>
          </div>
          <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 14px;">${inviteUrl}</p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">Link expires in 7 days.</p>
        </div>
      `
    }

      const emailBody = {
          message: {
              subject: subject || `You have been invited to ProcureFlow by ${invited_by_name}`,
              body: {
                  contentType: 'HTML',
                  content: finalHtml
              },
              toRecipients: [{ emailAddress: { address: email } }]
          },
          saveToSentItems: 'false'
      }
      
      const sendUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`
      
      const emailResp = await fetch(sendUrl, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailBody)
      })

      if (!emailResp.ok) {
           const errOpts = await emailResp.json().catch(()=>({}))
           console.error("Graph Email Failed:", errOpts)
           throw new Error("Failed to send email")
      }

      return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

  } catch (error) {
      console.error(error)
      return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
      })
  }
})
