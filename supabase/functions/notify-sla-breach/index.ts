
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("Checking for SLA breaches...")

    // 1. Fetch pending instances that have breached their SLA but haven't been notified yet
    // We check both the boolean flag (set by DB trigger) and the raw deadline
    const { data: breaches, error: breachError } = await supabaseAdmin
      .from('item_approval_instances')
      .select(`
        id,
        rule_name,
        request_id,
        approver_type,
        approver_role,
        approver_user_id,
        sla_deadline,
        item_requests (
          request_number
        )
      `)
      .eq('status', 'PENDING')
      .is('sla_notified_at', null)
      .or(`sla_breached.eq.true,sla_deadline.lt.${new Date().toISOString()}`)

    if (breachError) throw breachError

    console.log(`Found ${breaches?.length || 0} breaches to process.`)

    if (!breaches || breaches.length === 0) {
      return new Response(JSON.stringify({ message: "No breaches found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const notifications = []
    const instancesToUpdate = []

    for (const breach of breaches) {
      const requestNumber = breach.item_requests?.request_number || breach.request_id
      const title = "SLA Breach Warning"
      const message = `Approval for request ${requestNumber} (${breach.rule_name}) has exceeded its SLA deadline.`
      
      // Determine recipients
      let targetUserIds: string[] = []

      if (breach.approver_type === 'USER' && breach.approver_user_id) {
        targetUserIds = [breach.approver_user_id]
      } else if (breach.approver_type === 'ROLE' && breach.approver_role) {
        // Fetch users with this role
        // Note: The roles/users relationship might vary, but based on AppContext:
        const { data: roleUsers, error: roleError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('role_id', breach.approver_role)
          .eq('status', 'APPROVED') // Only active users

        if (!roleError && roleUsers) {
          targetUserIds = roleUsers.map(u => u.id)
        }
      }

      for (const userId of targetUserIds) {
        notifications.push({
          user_id: userId,
          title,
          message,
          type: 'SLA_BREACH',
          related_request_id: breach.request_id,
          link: `/requests/${breach.request_id}`,
          is_read: false
        })
      }

      instancesToUpdate.push(breach.id)
    }

    // 2. Insert notifications in bulk
    if (notifications.length > 0) {
      const { error: notifError } = await supabaseAdmin
        .from('user_notifications')
        .insert(notifications)
      
      if (notifError) {
        console.error("Error inserting notifications:", notifError)
        throw notifError
      }
    }

    // 3. Mark instances as notified
    if (instancesToUpdate.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('item_approval_instances')
        .update({ sla_notified_at: new Date().toISOString() })
        .in('id', instancesToUpdate)
      
      if (updateError) {
        console.error("Error updating instances:", updateError)
        throw updateError
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: breaches.length,
      notifications_sent: notifications.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Fatal error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
