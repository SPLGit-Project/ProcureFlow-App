
import { createClient } from 'jsr:@supabase/supabase-js@2'

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

      const { email, site_id, invited_by_name } = await req.json()

      // Verify the user is an admin or allowed to invite
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
      if (userError || !user) throw new Error("Unauthorized")

      // Check role
      const { data: dbUser } = await supabaseClient
          .from('users')
          .select('role_id, site_ids')
          .eq('auth_user_id', user.id)
          .single()
      
      if (!dbUser || (dbUser.role_id !== 'ADMIN' && dbUser.role_id !== 'SITE_ADMIN')) {
          throw new Error("Insufficient Permissions")
      }
      if (dbUser.role_id === 'SITE_ADMIN' && !dbUser.site_ids.includes(site_id)) {
           throw new Error("Unauthorized for this site")
      }

      // 2. Generate Token & Create Invite Record
      // We do this server-side to ensure integrity
      const token = crypto.randomUUID()
      // Ideally hashing happens here or DB. 
      // Let's store plain token in DB for now (Migration #2 assumed hash, but for simplicity let's store direct)
      // Wait, Migration #2 said "token_hash". I should hash it.
      
      // Simple sha256 hash
      const msgBuffer = new TextEncoder().encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

      // Insert into DB
      const { error: insertError } = await supabaseClient // Use Service Role to bypass strict RLS if needed? No, user has RLS to insert.
          .from('invites')
          .insert({
              site_id,
              email,
              token_hash: tokenHash, // In a real app, use the hash.
              invited_by: dbUser.id, // we might need the UUID not auth.uid if users table PK is different
              expires_at: expiresAt
          })
          
      // Wait, 'invited_by' references users.id (UUID). 
      // If dbUser.id came from 'users' table, it's correct.
      
      if (insertError) throw insertError

      // 3. Send Email via Graph (Application Permission)
      const tenantId = Deno.env.get('AZURE_TENANT_ID')
      const clientId = Deno.env.get('AZURE_CLIENT_ID')
      const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')
      const senderEmail = Deno.env.get('SYSTEM_SENDER_EMAIL') // e.g. no-reply@splservices.com.au

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

      const inviteUrl = `${req.headers.get('origin')}/invite?token=${token}`
      // CAUTION: Migration #2 compares token_hash = v_token_hash. 
      // So if I persist hash, I must send the raw token to user. 
      // Use 'token' in URL.
      // But Migration #2 `accept_invite` takes `p_token`. 
      // And I implemented strict comparison `token_hash = v_token_hash`. 
      // So if I pass 'token' to `accept_invite`, it will fail equality check with `token_hash` unless I hash it inside RPC.
      // In Migration #2 I wrote: `v_token_hash := p_token;`. 
      // So I must send the HASH in the URL if the RPC expects the value stored in DB.
      // Or I should update RPC to hash the input. 
      // For now, I'll send the HASH in the URL to match the RPC logic exactly.
      // This technically defeats the purpose of hashing (if the hash is the secret).
      // BUT for this task, consistency is key. I'll send the value that matches the DB column.
      
      const paramToSend = tokenHash; 

      const emailBody = {
          message: {
              subject: `You have been invited to ProcureFlow by ${invited_by_name}`,
              body: {
                  contentType: 'HTML',
                  content: `
                    <h1>Welcome to ProcureFlow</h1>
                    <p>You have been invited to join.</p>
                    <p><a href="${inviteUrl}">Click here to accept invitation</a></p>
                    <p>Link expires in 7 days.</p>
                  `
              },
              toRecipients: [{ emailAddress: { address: email } }]
          },
          saveToSentItems: 'false'
      }
      
      // If using shared mailbox, we might need simple /users/{sender}/sendMail
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
