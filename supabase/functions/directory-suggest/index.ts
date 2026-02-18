
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const { query } = await req.json()
    if (!query || query.length < 2) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1. Verify User Session (Security)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    // 2. Azure AD Client Credentials Auth (Application Flow)
    const tenantId = Deno.env.get('AZURE_TENANT_ID')
    const clientId = Deno.env.get('AZURE_CLIENT_ID')
    const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("Azure AD Credentials not configured")
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

    if (!tokenResp.ok) throw new Error(`Azure Auth Failed: ${tokenResp.statusText}`)
    const { access_token } = await tokenResp.json()

    // 3. Live Microsoft Graph Search (RESTORES FEB 11 BEHAVIOR)
    // We search across the whole tenant in real-time
    const escapedQuery = query.replace(/"/g, '\\"')
    const graphUrl = `https://graph.microsoft.com/v1.0/users?$search="displayName:${escapedQuery}" OR "mail:${escapedQuery}"&$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation&$top=10`
    
    const graphResp = await fetch(graphUrl, {
      headers: { 
        Authorization: `Bearer ${access_token}`,
        'ConsistencyLevel': 'eventual' // Required for $search
      }
    })

    if (!graphResp.ok) {
        const err = await graphResp.text()
        console.error("Graph API Error:", err)
        throw new Error("Directory search failed at source.")
    }

    const { value: users } = await graphResp.json()
    
    interface GraphUser {
      id: string;
      displayName: string;
      mail?: string;
      userPrincipalName: string;
      jobTitle?: string;
      department?: string;
      officeLocation?: string;
    }

    // 4. Map to Application User Format
    const results = users.map((u: GraphUser) => ({
      id: u.id,
      name: u.displayName,
      email: u.mail || u.userPrincipalName,
      jobTitle: u.jobTitle,
      department: u.department || u.officeLocation
    }))

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const err = error as Error;
    console.error("Directory Suggest Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
