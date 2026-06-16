# Automated supplier-inventory email ingestion

Polls a dedicated mailbox, lands spreadsheet attachments in storage, and lets
the app ingest them through the same pipeline as a manual upload.

## How it works

```
Supplier email ──▶ Procurement@splservices.com.au (Entra mailbox)
                         │
        ingest-supplier-email (edge fn, hourly cron)
                         │  Microsoft Graph: list unread + attachments
                         ▼
        supplier-inbox bucket  +  email_ingestion_queue (PENDING)
                         │
        Admin opens Mapping ▸ Ingest ▸ "Process inbox"
                         │  reuses parser + supplier detect + STALE guard + auto-map
                         ▼
        stock_snapshots replaced ──▶ Confirm Matches (human, as today)
```

Parsing and matching deliberately run **client-side** so there is one code path
(the 800-line parser and the auto-mapping algorithm are not duplicated in Deno).
The poller runs 24/7; an email's data lands the next time an admin opens the
workbench — which they do anyway to confirm matches.

## One-time setup

### 1. Azure AD — add Mail.Read to the existing app
This function reuses the **same app registration** as `sync-directory`
(`AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET`).

1. Entra admin centre ▸ App registrations ▸ (the ProcureFlow sync app)
2. API permissions ▸ Add ▸ Microsoft Graph ▸ **Application permissions** ▸
   `Mail.Read` (and `Mail.ReadWrite` so the function can mark messages read).
3. **Grant admin consent** for the tenant.
4. (Recommended) Restrict the app to only the inbound mailbox with an
   Application Access Policy so it cannot read other mailboxes:
   ```powershell
   New-ApplicationAccessPolicy -AppId <CLIENT_ID> `
     -PolicyScopeGroupId Procurement@splservices.com.au `
     -AccessRight RestrictAccess -Description "ProcureFlow inbound ingestion"
   ```

### 2. Apply the database migrations
```
supabase db push      # or apply via your migration pipeline
```
Adds: `20260616000000_stale_report_guard.sql`,
`20260616000100_email_ingestion_queue.sql` (queue table + supplier-inbox bucket).

### 3. Deploy the function
```
supabase functions deploy ingest-supplier-email
```
Secrets already exist from `sync-directory`. The mailbox is read from
`app_config.inbound_email_config` (set in the UI). Optional override:
```
supabase secrets set INGEST_MAILBOX=Procurement@splservices.com.au
```

### 4. Schedule the hourly poll (pg_cron + pg_net)
Run once in the SQL editor. Replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>`
(do **not** commit these — that is why this is a manual step):
```sql
select cron.schedule(
  'ingest-supplier-email-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/ingest-supplier-email',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
                 'Content-Type',  'application/json'),
    body    := '{}'::jsonb
  );
  $$
);
```
Run `select cron.unschedule('ingest-supplier-email-hourly');` to stop it.

## Manual test
```
curl -i -X POST \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  https://<PROJECT_REF>.functions.supabase.co/ingest-supplier-email
```
Then open Mapping ▸ Ingest ▸ Automated Email and click **Process inbox**.

## Known limitations / follow-ups
- Parses `.xlsx` / `.xls` / `.csv` attachments **and** spreadsheets inside
  `.zip` attachments (e.g. the SIMBA reports). Non-spreadsheet attachments and
  zips with no spreadsheets are recorded as **Skipped**.
- The poller filters **unread** messages and marks them read after processing,
  so re-running is safe. `email_ingestion_queue` is also de-duped on
  `(message_id, attachment_name)`.
- Unknown suppliers are flagged **Needs supplier** rather than auto-created,
  matching the in-app rule that ingestion pauses for supplier creation.
