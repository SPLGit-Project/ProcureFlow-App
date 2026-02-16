
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1'

console.log("sync-directory function initialized.")

Deno.serve(async (req) => {
  try {
    console.log(`[sync-directory] Triggered at ${new Date().toISOString()}`)
    
    // 1. Check for Authorization (Cron or Service Key)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[sync-directory] Unauthorized attempt - no auth header");
      return new Response('Unauthorized', { status: 401 })
    }

    // Initialize Supabase Client (Service Role for Database Updates)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 2. Azure AD Client Credentials Auth
    const tenantId = Deno.env.get('AZURE_TENANT_ID')
    const clientId = Deno.env.get('AZURE_CLIENT_ID')
    const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')

    if (!tenantId || !clientId || !clientSecret) {
      console.error("[sync-directory] Missing Azure Credentials");
      throw new Error("Missing Azure AD Credentials in Environment Variables")
    }

    console.log("[sync-directory] Fetching Azure AD Token...");
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
       const err = await tokenResp.text()
       console.error("[sync-directory] Azure Auth Failed:", err)
       throw new Error(`Azure Auth Error: ${tokenResp.statusText}`)
    }

    const { access_token } = await tokenResp.json()
    console.log("[sync-directory] Azure Token obtained.");

    // 3. Fetch Users from Graph
    const graphUrl = 'https://graph.microsoft.com/v1.0/users?$filter=accountEnabled eq true&$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation&$top=999'
    console.log("[sync-directory] Fetching users from Microsoft Graph...");
    const graphResp = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${access_token}` }
    })

    if (!graphResp.ok) {
        const errText = await graphResp.text();
        console.error("[sync-directory] Graph API Error:", errText);
        throw new Error(`Graph API Failed: ${graphResp.statusText}`)
    }

    const { value: users } = await graphResp.json()
    console.log(`[sync-directory] Successfully fetched ${users.length} users.`);

    // 4. Transform & Upsert
    const updates = users.map((u: any) => {
        const email = u.mail || u.userPrincipalName
        const displayName = u.displayName || 'Unknown'
        const searchText = `${displayName.toLowerCase()} ${email.toLowerCase()} ${u.jobTitle?.toLowerCase() || ''}`

        return {
           entra_oid: u.id,
           display_name: displayName,
           email: email,
           upn: u.userPrincipalName,
           job_title: u.jobTitle,
           department: u.department || u.officeLocation,
           search_text: searchText,
           updated_at: new Date().toISOString()
        }
    })

    // Upsert in batches to avoid large payload issues
    console.log(`[sync-directory] Upserting ${updates.length} users into directory_users...`);
    const { error } = await supabase
        .from('directory_users')
        .upsert(updates, { onConflict: 'entra_oid', ignoreDuplicates: false })

    if (error) {
        console.error("[sync-directory] Supabase Upsert Failed:", error)
        throw error
    }

    console.log("[sync-directory] Sync completed successfully.");
    return new Response(JSON.stringify({ success: true, count: users.length }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("[sync-directory] Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    })
  }
})
