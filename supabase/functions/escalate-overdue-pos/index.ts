import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const APP_BASE_URL = "https://procureflow-app-spl.azurewebsites.net";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Load active AUTO escalation site workflows
    const { data: workflows, error: wfError } = await supabaseAdmin
      .from("site_approval_workflows")
      .select("*")
      .eq("is_active", true)
      .eq("escalation_mode", "AUTO");

    if (wfError) throw wfError;

    // 2. Load Teams routing config for Direct Bot / COO Escalation channel
    const { data: configs } = await supabaseAdmin
      .from("app_config")
      .select("key, value")
      .in("key", ["teams_config"]);

    let directBotUrl = "";
    let cooEscWebhookUrl = "";
    for (const row of configs || []) {
      if (row.key === "teams_config" && row.value) {
        directBotUrl = row.value.directBotWebhookUrl || "";
        cooEscWebhookUrl = row.value.cooEscalationWebhookUrl || "";
      }
    }

    const now = new Date();
    const escalatedIds: string[] = [];

    for (const wf of workflows || []) {
      const slaHours = Number(wf.escalation_sla_hours) || 72;
      const cutoffIso = new Date(now.getTime() - slaHours * 60 * 60 * 1000).toISOString();

      // 3. Find overdue PENDING_APPROVAL POs for this facility
      const { data: overduePOs, error: poErr } = await supabaseAdmin
        .from("po_requests")
        .select("id, display_id, site_id, total_amount, requester_id, created_at")
        .eq("site_id", wf.site_id)
        .eq("status", "PENDING_APPROVAL")
        .is("escalated_at", null)
        .lt("created_at", cutoffIso);

      if (poErr || !overduePOs?.length) continue;

      for (const po of overduePOs) {
        // 4. Atomically transition status to ESCALATED and assign to COO
        const { data: updated, error: updErr } = await supabaseAdmin
          .from("po_requests")
          .update({
            status: "ESCALATED",
            escalated_at: now.toISOString(),
            assigned_approver_id: wf.escalation_manager_id,
            updated_at: now.toISOString(),
          })
          .eq("id", po.id)
          .eq("status", "PENDING_APPROVAL")
          .select("id")
          .maybeSingle();

        if (updErr || !updated) continue;

        const displayId = po.display_id || po.id;
        const escalationEmail = wf.escalation_manager_email || "ebrahim.mokhtari@splservices.com.au";
        const escalationName = wf.escalation_manager_name || "Ebrahim Mokhtari";
        const approvalUrl = `${APP_BASE_URL}/approvals/${po.id}`;
        const amountStr = `$${Number(po.total_amount || 0).toLocaleString("en-AU", {
          minimumFractionDigits: 2,
        })} AUD`;

        // 5a. In-App Notification for COO only
        if (wf.escalation_manager_id) {
          await supabaseAdmin.from("user_notifications").insert({
            user_id: wf.escalation_manager_id,
            title: `Escalated PO Approval Required: ${displayId}`,
            message: `${displayId} (${wf.site_name}, ${amountStr}) exceeded the ${slaHours}h SLA and is now in your exclusive COO queue.`,
            type: "warning",
            read: false,
            action_url: `/approvals/${po.id}`,
            created_at: now.toISOString(),
          });
        }

        // 5b. Email Notification via send-notification-email
        await supabaseAdmin.functions.invoke("send-notification-email", {
          body: {
            to: escalationEmail,
            subject: `ESCALATED (${slaHours}h SLA): PO Approval Required — ${displayId} (${wf.site_name})`,
            html: `
              <p>Dear ${escalationName},</p>
              <p>Purchase requisition <strong>${displayId}</strong> for <strong>${wf.site_name}</strong> (${amountStr}) did not receive a site manager decision within ${slaHours} hours and has been escalated exclusively to you for COO approval.</p>
              <p><a href="${approvalUrl}">Review & Approve in ProcureFlow</a></p>
            `,
          },
        });

        // 5c. Teams 1:1 Direct Bot or COO-only Private Channel Notification
        const teamsTargetUrl = directBotUrl || cooEscWebhookUrl;
        if (teamsTargetUrl) {
          const card = {
            type: "message",
            attachments: [
              {
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                  type: "AdaptiveCard",
                  version: "1.4",
                  body: [
                    {
                      type: "Container",
                      style: "emphasis",
                      items: [
                        {
                          type: "TextBlock",
                          text: `🚨 Escalated PO Approval Required: ${displayId}`,
                          weight: "Bolder",
                          size: "Medium",
                          color: "Attention",
                          wrap: true,
                        },
                        {
                          type: "TextBlock",
                          text: `${wf.site_name} • COO Exclusive Escalation (${slaHours}h SLA)`,
                          isSubtle: true,
                          size: "Small",
                          wrap: true,
                        },
                      ],
                    },
                    {
                      type: "TextBlock",
                      text: `Assigned Escalation Authority: <at>${escalationName}</at>`,
                      weight: "Bolder",
                      size: "Small",
                      wrap: true,
                    },
                    {
                      type: "FactSet",
                      facts: [
                        { title: "Requisition ID", value: displayId },
                        { title: "Facility", value: wf.site_name },
                        { title: "Total Value", value: amountStr },
                        { title: "SLA Breached", value: `${slaHours} hours` },
                      ],
                    },
                  ],
                  actions: [
                    {
                      type: "Action.OpenUrl",
                      title: "Approve in ProcureFlow",
                      url: approvalUrl,
                    },
                  ],
                  msteams: {
                    entities: [
                      {
                        type: "mention",
                        text: `<at>${escalationName}</at>`,
                        mentioned: {
                          id: escalationEmail,
                          name: escalationName,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          };

          const outbound = directBotUrl
            ? {
                recipientEmail: escalationEmail,
                recipientName: escalationName,
                siteId: wf.site_id,
                eventType: "PO_ESCALATED_TO_COO",
                title: `Escalated PO Approval Required: ${displayId}`,
                card,
              }
            : card;

          await fetch(teamsTargetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(outbound),
          });
        }

        escalatedIds.push(displayId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        escalatedCount: escalatedIds.length,
        escalatedIds,
        checkedAt: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[escalate-overdue-pos] Error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
