# Supplier bale/carton quantities — held release

Implemented on `codex/supplier-pack-quantities`. This is an unreleased feature,
held for the week commencing 12 October 2026 after the current feature release.
Release still requires Aaron's go-ahead; the date does not trigger a deployment.

## Behaviour

- Request quantities round **up** to a whole supplier bale/carton on leaving the
  quantity field or adding an item. A 30-unit pack changes 31 to 60, with a visible
  adjustment message and recalculated net, GST and gross amounts.
- Plus/minus controls move by one full pack. Pack sizes follow the selected
  supplier's confirmed mapping and latest matching stock report. Stock conversion
  factors are not multiplied into carton quantities.
- A confirmed supplier pack of 1 permits loose units. A catalogue UPQ greater
  than 1 is a fallback; the legacy default of 1 does not confirm loose ordering.
  Missing or conflicting supplier pack data blocks saving/submitting new lines.
- Saved drafts and changed request quantities are checked in the app and database.
  Unchanged historical orders remain receivable and editable for audit details.
  An old odd-quantity draft must be corrected before submission.

## Before release

1. Confirm bale/carton data with Procurement for orderable supplier products.
   The current catalogue mostly has a default UPQ of 1, so report coverage matters.
   Test missing/conflicting records and resolve them before enforcing this live.
2. Apply `20261007075251_supplier_pack_quantities.sql` in staging with the frontend.
   Check actual supplier aliases, stock visibility, prices and an existing draft.
3. Review the draft PR after the current release has settled. Merge only after
   approval. Both main deployment workflows target production; do not manually
   dispatch them from this held branch.
4. At release, verify the Supabase migration and frontend deployments both succeed,
   then smoke-test a new request, an old draft and receipt of a historical order.

No production migration, merge or deployment was performed for this feature.

## Verification

`npm run test:packs` runs 23 checks against the real TypeScript rules and an isolated
Postgres-compatible PGlite database using the actual migration and stock-pool SQL.
It covers supplier selection, rounding/pricing, database validation, draft submit,
supplier changes, historical upserts/receipts, rollback and private function access.

Also run `npm run test:stock`, `npm run test:startup`, `npm run build:prod` and
`node scripts/verify_supabase_migrations.mjs` before release.

`npm run preview:packs` serves the actual request components at
`http://localhost:3107/` with isolated fixtures and no Supabase connection. It is
for reviewing the unreleased UI and never sends a production request.

## Rollback

Coordinate the database and frontend rollback. Restoring only the old frontend
while leaving enforcement triggers installed will cause odd-quantity saves to
fail. A reviewed rollback migration must remove `enforce_order_line_pack` on
`public.po_lines` and `enforce_request_pack` on `public.po_requests` before removing
their four private helper functions. Do not modify immutable migration history.
