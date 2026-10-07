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
- Reuse the existing catalogue UPQ, supplier report carton quantity and item UOM.
  Do not add a separate Bale/Carton UOM or parallel configuration. A pack is a count
  of ordering units; stock/pricing conversion factors and MOQ have separate meanings.

## Whole-app flow

| Stage | Pack behaviour |
| --- | --- |
| Catalogue and item setup | UPQ is labelled as the catalogue pack fallback, in the existing ordering UOM. |
| Supplier reports and mappings | Existing carton quantity accepts bale/carton/pack-size headings; only positive whole sizes are accepted. Supplier-specific values override catalogue fallback. |
| Stock directory, comparisons and reports | Shared pack calculation shows full-pack orderable stock; missing pack data blocks ordering without hiding physical stock. |
| New requests, drafts and amendments | Round up to a full pack with visible explanation and recalculated tax; validate again in the database. |
| Save, reload, approval and order detail | Store pack size, UOM and supplier on each order line. Submission/supplier/quantity changes capture the applicable configuration; later receipts and supplier reports preserve history. |
| Receiving and variances | Show the saved pack while accepting actual units, including partial cartons, shortages and unplanned receipts with zero ordered. |
| Finance and line reports | Display saved pack context; eight line-level CSV reports include ordering UOM, pack size at order and ordered pack equivalents. |
| Concur and existing totals | Quantity, unit prices, stock reservations and integration formats remain in ordering units; no implicit conversion to carton counts. |
| Historical orders | Leave unknown historical pack fields empty, labelled as legacy; never backfill from today's configuration. |

## Before release

1. Confirm bale/carton data with Procurement for orderable supplier products.
   The current catalogue mostly has a default UPQ of 1, so report coverage matters.
   Test missing/conflicting records and resolve them before enforcing this live.
2. Apply both `20261007075251_supplier_pack_quantities.sql` and
   `20261007091118_capture_order_pack_snapshot.sql` in staging with the frontend.
   Check supplier aliases, stock visibility, prices, an existing draft, save/reload,
   approval, partial/unplanned receipt, finance, exports and Concur reconciliation.
3. Review the draft PR after the current release has settled. Merge only after
   approval. Both main deployment workflows target production; do not manually
   dispatch them from this held branch.
4. At release, verify the Supabase migration and frontend deployments both succeed,
   then smoke-test a new request, an old draft and receipt of a historical order.

No production migration, merge or deployment was performed for this feature.

## Verification

`npm run test:packs` runs 37 checks against the real TypeScript rules and an isolated
Postgres-compatible PGlite database using both actual migrations, stock-pool SQL
and the production create/edit RPC definitions. It covers supplier selection,
rounding/pricing, validation, saved metadata/read hydration, draft submission,
supplier changes, unchanged historical upserts, partial/unplanned receipts,
imports, stock projections, exports, client metadata spoofing and private access.

Also run `npm run test:stock`, `npm run test:startup`, `npm run build:prod` and
`node scripts/verify_supabase_migrations.mjs` before release.

`npm run preview:packs` serves the actual request components at
`http://localhost:3107/` with isolated fixtures and no Supabase connection. It is
for reviewing the unreleased UI and never sends a production request.

## Rollback

Coordinate the database and frontend rollback. Restoring only the old frontend
while leaving enforcement triggers installed will cause odd-quantity saves to
fail. A reviewed rollback migration must remove the `enforce_order_line_pack` and
`capture_order_line_pack` triggers on `public.po_lines`, and `enforce_request_pack`
and `refresh_request_pack_snapshot` on `public.po_requests`, before removing their
six private helper functions. Preserve captured history columns unless separately
approved for removal. Do not modify immutable migration history.
