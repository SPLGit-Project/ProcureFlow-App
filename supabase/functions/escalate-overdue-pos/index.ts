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
    const deliveryFailures: Array<{ displayId: string; channel: string; error: string }> = [];

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
        const escalationId = wf.escalation_manager_id || "9e97d720-3bf0-4451-b739-9fd87d27686c";
        const approvalUrl = `${APP_BASE_URL}/requests/${po.id}`;
        const amountStr = `$${Number(po.total_amount || 0).toLocaleString("en-AU", {
          minimumFractionDigits: 2,
        })} AUD`;
        const nowIso = now.toISOString();

        // 5a. In-App Notification for COO only (schema-compliant: is_read, category, severity)
        const inAppTitle = `Escalated PO Approval Required: ${displayId}`;
        const inAppMsg = `${displayId} (${wf.site_name}, ${amountStr}) exceeded the ${slaHours}h SLA and is now in your exclusive COO queue.`;
        const { error: inAppErr } = await supabaseAdmin.from("user_notifications").insert({
          user_id: escalationId,
          title: inAppTitle,
          message: inAppMsg,
          category: "APPROVAL",
          severity: "WARNING",
          is_read: false,
          action_url: `/requests/${po.id}`,
          created_at: nowIso,
        });

        await supabaseAdmin.from("site_workflow_notification_outbox").insert({
          idempotency_key: `esc_${po.id}_IN_APP_${escalationId}`,
          po_id: po.id,
          display_id: displayId,
          site_id: wf.site_id,
          recipient_id: escalationId,
          recipient_name: escalationName,
          recipient_email: escalationEmail,
          channel: "IN_APP",
          status: inAppErr ? "FAILED" : "DELIVERED",
          title: inAppTitle,
          body: inAppMsg,
          retry_count: 0,
          max_retries: 3,
          last_error: inAppErr ? inAppErr.message : null,
          created_at: nowIso,
          delivered_at: inAppErr ? null : nowIso,
        });
        if (inAppErr) deliveryFailures.push({ displayId, channel: "IN_APP", error: inAppErr.message });

        // 5b. Email Notification via send-notification-email
        const emailSubject = `ESCALATED (${slaHours}h SLA): PO Approval Required — ${displayId} (${wf.site_name})`;
        const { error: emailErr } = await supabaseAdmin.functions.invoke("send-notification-email", {
          body: {
            to: escalationEmail,
            subject: emailSubject,
            html: `
              <p>Dear ${escalationName},</p>
              <p>Purchase requisition <strong>${displayId}</strong> for <strong>${wf.site_name}</strong> (${amountStr}) did not receive a site manager decision within ${slaHours} hours and has been escalated exclusively to you for COO approval.</p>
              <p><a href="${approvalUrl}">Review & Approve in ProcureFlow</a></p>
            `,
          },
        });

        await supabaseAdmin.from("site_workflow_notification_outbox").insert({
          idempotency_key: `esc_${po.id}_EMAIL_${escalationId}`,
          po_id: po.id,
          display_id: displayId,
          site_id: wf.site_id,
          recipient_id: escalationId,
          recipient_name: escalationName,
          recipient_email: escalationEmail,
          channel: "EMAIL",
          status: emailErr ? "FAILED" : "DELIVERED",
          title: emailSubject,
          body: inAppMsg,
          retry_count: 0,
          max_retries: 3,
          last_error: emailErr ? emailErr.message : null,
          created_at: nowIso,
          delivered_at: emailErr ? null : nowIso,
        });
        if (emailErr) deliveryFailures.push({ displayId, channel: "EMAIL", error: emailErr.message });

        // 5c. Teams 1:1 Notification (Custom ProcureFlow Approval Bot priority -> Power Automate fallback)
        let teamsStatus: "DELIVERED" | "FAILED" = "FAILED";
        let teamsError: string | null = null;
        let teamsHttpStatus: number | null = null;
        let teamsMode = "CUSTOM_BOT";

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
                        type: "ColumnSet",
                        columns: [
                          {
                            type: "Column",
                            width: "auto",
                            verticalContentAlignment: "Center",
                            items: [
                              {
                                type: "Image",
                                url: `${APP_BASE_URL}/Procureflow_Icon.png`,
                                size: "Small",
                                width: "36px",
                                height: "36px",
                                altText: "ProcureFlow Approval Bot",
                              },
                            ],
                          },
                          {
                            type: "Column",
                            width: "stretch",
                            items: [
                              {
                                type: "TextBlock",
                                text: "ProcureFlow Approval Bot",
                                weight: "Bolder",
                                size: "Small",
                                color: "Attention",
                                spacing: "None",
                                wrap: true,
                              },
                              {
                                type: "TextBlock",
                                text: `🚨 Escalated PO Approval Required: ${displayId}`,
                                weight: "Bolder",
                                size: "Medium",
                                color: "Attention",
                                spacing: "None",
                                wrap: true,
                              },
                              {
                                type: "TextBlock",
                                text: `${wf.site_name} • COO Exclusive Escalation (${slaHours}h SLA)`,
                                isSubtle: true,
                                size: "Small",
                                spacing: "None",
                                wrap: true,
                              },
                            ],
                          },
                        ],
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

        try {
          const { data: teamsData, error: teamsErr } = await supabaseAdmin.functions.invoke(
            "send-teams-notification",
            {
              body: {
                recipientEmail: escalationEmail,
                recipientName: escalationName,
                siteId: wf.site_id,
                eventType: "PO_ESCALATED_TO_COO",
                title: inAppTitle,
                card,
              },
            }
          );
          teamsHttpStatus = teamsData?.status || null;
          teamsMode = teamsData?.mode || (directBotUrl ? "DIRECT_BOT" : "CHANNEL_WEBHOOK");
          if (!teamsErr && teamsData?.success) {
            teamsStatus = "DELIVERED";
          } else {
            teamsError = teamsErr?.message || teamsData?.error || "Teams dispatch failed";
          }
        } catch (fetchErr: unknown) {
          teamsError = fetchErr instanceof Error ? fetchErr.message : "Teams invoke exception";
        }

        await supabaseAdmin.from("site_workflow_notification_outbox").insert({
          idempotency_key: `esc_${po.id}_TEAMS_${escalationId}`,
          po_id: po.id,
          display_id: displayId,
          site_id: wf.site_id,
          recipient_id: escalationId,
          recipient_name: escalationName,
          recipient_email: escalationEmail,
          channel: "TEAMS",
          status: teamsStatus,
          title: inAppTitle,
          body: inAppMsg,
          retry_count: 0,
          max_retries: 3,
          last_error: teamsError,
          created_at: nowIso,
          delivered_at: teamsStatus === "DELIVERED" ? nowIso : null,
        });

        await supabaseAdmin.from("notification_delivery_logs").insert({
          event_type: "PO_ESCALATED_TO_COO",
          channel: "TEAMS",
          recipient: escalationEmail,
          status: teamsStatus,
          title: inAppTitle,
          payload: {
            mode: teamsMode,
            siteId: wf.site_id,
            displayId,
            httpStatus: teamsHttpStatus,
          },
          error_message: teamsError,
        });

        if (teamsError) deliveryFailures.push({ displayId, channel: "TEAMS", error: teamsError });
        escalatedIds.push(displayId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        escalatedCount: escalatedIds.length,
        escalatedIds,
        deliveryFailuresCount: deliveryFailures.length,
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
