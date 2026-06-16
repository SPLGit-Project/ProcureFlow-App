
import { createClient } from "@supabase/supabase-js"

// ingest-supplier-email
// -----------------------------------------------------------------------------
// Polls the dedicated supplier-inventory mailbox via Microsoft Graph, lands each
// spreadsheet attachment in the private "supplier-inbox" storage bucket, and
// records a PENDING row in email_ingestion_queue. The app drains PENDING rows
// through the same parser + supplier detection + auto-mapping + stale-report
// guard used by manual uploads, so there is one ingestion code path.
//
// Reuses the SAME Azure AD app registration as sync-directory. That app must be
// granted the application permission Mail.Read (and admin-consented) so it can
// read the mailbox. Mailbox address is read from app_config.inbound_email_config
// (falls back to the INGEST_MAILBOX env var).

console.log("ingest-supplier-email function initialized.")

const SUPPORTED_EXT = ["xlsx", "xls", "csv"]
const BUCKET = "supplier-inbox"

// Lightweight filename date extractor (mirrors utils/fileParser.ts
// extractReportDate filename logic) so the queue can show a report date before
// the app drains it. Day-first (Australian) is assumed. Returns YYYY-MM-DD.
function reportDateFromName(name: string): string | null {
  if (!name) return null
  const clamp = (y: number, m: number, d: number): string | null => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    const yyyy = y < 100 ? 2000 + y : y
    if (yyyy < 2000 || yyyy > 2100) return null
    const dt = new Date(Date.UTC(yyyy, m - 1, d))
    if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
    return `${yyyy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  }
  const iso = name.match(/(20\d{2})[._/-](\d{1,2})[._/-](\d{1,2})/)
  if (iso) {
    const hit = clamp(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    if (hit) return hit
  }
  const dmy = name.match(/(\d{1,2})[._/-](\d{1,2})[._/-](\d{2,4})/)
  if (dmy) {
    const hit = clamp(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]))
    if (hit) return hit
  }
  return null
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

Deno.serve(async (req) => {
  try {
    console.log(`[ingest-supplier-email] Triggered at ${new Date().toISOString()}`)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.warn("[ingest-supplier-email] Unauthorized attempt - no auth header")
      return new Response("Unauthorized", { status: 401 })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Resolve the mailbox to poll.
    let mailbox = Deno.env.get("INGEST_MAILBOX") ?? ""
    const { data: cfg } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "inbound_email_config")
      .single()
    if (cfg?.value?.email) mailbox = cfg.value.email
    if (!mailbox) throw new Error("No inbound mailbox configured (app_config.inbound_email_config or INGEST_MAILBOX).")
    console.log(`[ingest-supplier-email] Mailbox: ${mailbox}`)

    // 2. Azure AD client-credentials token (same app as sync-directory).
    const tenantId = Deno.env.get("AZURE_TENANT_ID")
    const clientId = Deno.env.get("AZURE_CLIENT_ID")
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("Missing Azure AD Credentials in Environment Variables")
    }

    const tokenResp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    })
    if (!tokenResp.ok) {
      const err = await tokenResp.text()
      console.error("[ingest-supplier-email] Azure Auth Failed:", err)
      throw new Error(`Azure Auth Error: ${tokenResp.statusText}`)
    }
    const { access_token } = await tokenResp.json()

    // 3. List unread messages that carry attachments, oldest first.
    const listUrl =
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages` +
      `?$filter=hasAttachments eq true and isRead eq false` +
      `&$select=id,subject,receivedDateTime,from&$top=25&$orderby=receivedDateTime asc`

    const listResp = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${access_token}`, Prefer: 'outlook.body-content-type="text"' },
    })
    if (!listResp.ok) {
      const errText = await listResp.text()
      console.error("[ingest-supplier-email] Graph list error:", errText)
      throw new Error(`Graph list messages failed: ${listResp.statusText}`)
    }
    const { value: messages = [] } = await listResp.json()
    console.log(`[ingest-supplier-email] ${messages.length} unread message(s) with attachments.`)

    let enqueued = 0
    let skipped = 0

    for (const msg of messages) {
      const fromAddr = msg.from?.emailAddress?.address ?? null
      const attResp = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${msg.id}/attachments`,
        { headers: { Authorization: `Bearer ${access_token}` } },
      )
      if (!attResp.ok) {
        console.error(`[ingest-supplier-email] Could not fetch attachments for ${msg.id}: ${attResp.statusText}`)
        continue
      }
      const { value: attachments = [] } = await attResp.json()

      for (const att of attachments) {
        const name: string = att.name ?? "attachment"
        const ext = name.split(".").pop()?.toLowerCase() ?? ""
        const isFile = att["@odata.type"] === "#microsoft.graph.fileAttachment"

        // Only spreadsheet attachments flow through the parser. Other types
        // (zips, PDFs, inline images) are recorded as SKIPPED so they are
        // visible but not mistaken for inventory.
        if (!isFile || !SUPPORTED_EXT.includes(ext) || !att.contentBytes) {
          await supabase.from("email_ingestion_queue").upsert({
            message_id: msg.id,
            attachment_id: att.id ?? null,
            attachment_name: name,
            storage_path: "",
            from_address: fromAddr,
            subject: msg.subject ?? null,
            received_at: msg.receivedDateTime ?? null,
            status: "SKIPPED",
            error: isFile ? `Unsupported attachment type (.${ext})` : "Not a file attachment",
          }, { onConflict: "message_id,attachment_name", ignoreDuplicates: true })
          skipped++
          continue
        }

        const storagePath = `${msg.id}/${name}`
        const bytes = base64ToBytes(att.contentBytes)
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, bytes, {
            contentType: att.contentType || "application/octet-stream",
            upsert: true,
          })
        if (upErr) {
          console.error(`[ingest-supplier-email] Storage upload failed for ${storagePath}:`, upErr.message)
          continue
        }

        const { error: insErr } = await supabase.from("email_ingestion_queue").upsert({
          message_id: msg.id,
          attachment_id: att.id ?? null,
          attachment_name: name,
          storage_path: storagePath,
          from_address: fromAddr,
          subject: msg.subject ?? null,
          received_at: msg.receivedDateTime ?? null,
          report_date: reportDateFromName(name),
          status: "PENDING",
        }, { onConflict: "message_id,attachment_name", ignoreDuplicates: true })

        if (insErr) {
          console.error(`[ingest-supplier-email] Queue insert failed for ${name}:`, insErr.message)
          continue
        }
        enqueued++
      }

      // Mark the message read so it is not picked up again next poll.
      await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${msg.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      })
    }

    const result = { success: true, messages: messages.length, enqueued, skipped }
    console.log("[ingest-supplier-email] Done:", JSON.stringify(result))
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } })
  } catch (error) {
    const err = error as Error
    console.error("[ingest-supplier-email] Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
