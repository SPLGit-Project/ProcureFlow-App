# ProcureFlow Item Creation Preview Implementation Plan

## Summary

Implement the official item creation process as an isolated preview/research module that can run against the live ProcureFlow environment with zero operational impact until a formal go-live decision is made.

Core delivery principle:
- Build, test, and validate the new item creation workflow beside the current app, not inside the active operational path.
- Existing item management, PO creation, pricing, stock mapping, supplier snapshots, Smart Buying, and finance workflows must continue unchanged until cutover.
- Preview data may reference live suppliers, users, sites, items, mappings, and stock data, but must not mutate production operational records unless explicitly promoted during go-live.

Locked defaults:
- ProcureFlow is the future item and pricing source of truth.
- Use the MD SKU convention.
- Salesforce consumption is API-first, with snapshot fallback.
- Bundle and LinenHub receive approved catalogue publications from ProcureFlow.
- SAP receives financial outcomes only.

## Isolation Model

- Add a feature-flagged preview module, for example `/item-creation-preview`, visible only to selected admin/master-data users.
- Store all new workflow records in isolated preview tables using a clear prefix such as `preview_item_requests`, `preview_item_master_drafts`, `preview_purchase_price_drafts`, `preview_sell_price_drafts`, `preview_publication_events`.
- Preview records can read from live reference data, suppliers, sites, users, current items, supplier mappings, and stock snapshots.
- Preview records must not write to:
  - `items`
  - `catalog_items`
  - `po_requests`
  - `po_lines`
  - `supplier_product_map`
  - `ref_item_pricing`
  - Bundle/LinenHub/Salesforce production endpoints
- Any “publish” action in preview mode writes only simulated publication events and payload logs.
- Add an explicit environment/config flag:
  - `item_creation_preview_enabled`
  - `item_creation_preview_write_block`
  - `item_creation_go_live_enabled`
- Default all environments to preview write block enabled.

## Current State

- Items are currently created and edited directly through Admin Panel and `ItemWizard`.
- Current item saves write directly to `items`.
- Pricing is split across `items.unit_price`, item `priceOptions`, `catalog_items.price`, stock snapshot sell prices, and early `ref_item_pricing`.
- PO creation reads active items directly and locks selected price values onto PO lines.
- Supplier/product mapping and stock availability already depend on existing item IDs.
- Audit logging exists, but item request governance, duplicate check records, price versioning, item approval, and downstream publication are not yet implemented.

## Target State

The new workflow will eventually become the governed item lifecycle:

1. Requestor creates an item request.
2. Duplicate check runs against live and preview catalogues.
3. Master Data defines item identity and SKU.
4. Procurement adds purchase pricing.
5. Commercial adds sell pricing.
6. ProcureFlow calculates margin and routes approval.
7. Approved item and price versions are locked.
8. Publication sends approved catalogue records to downstream systems.
9. Existing operational flows consume approved catalogue records after go-live.

Before go-live, all of this runs as preview-only and produces no operational mutations.

## Phased Implementation

### Phase 0: Preview Safety Foundation

- Add preview feature flags and permission gating.
- Add preview-only navigation under Admin or a separate Research/Preview area.
- Add database guardrails:
  - preview tables only
  - no triggers that mutate live item tables
  - no foreign-key cascade from preview into live operational tables
  - RLS limited to admins/master-data preview users
- Add a preview audit stream separate from production audit, or tag all audit rows with `mode = PREVIEW`.
- Add a hard service-layer rule: preview services cannot call existing `addItem`, `updateItem`, `archiveItem`, `updateCatalogItem`, or PO mutation functions.

### Phase 1: Reference Data and SKU Research Mode

- Reuse live `attribute_options`, suppliers, sites, and users as read-only inputs.
- Add preview reference-code overlays where current live reference values do not yet have required SKU codes.
- Build the MD SKU generation service in pure preview mode.
- Validate generated SKUs against live `items.sku` and preview requests.
- Store generated SKU, validation result, override reason, and duplicate/collision status only in preview draft tables.
- Do not create or update live item SKUs.

### Phase 2: Preview Item Request Workflow

- Build the item request wizard as a separate component from the current `ItemWizard`.
- Support Draft, Submitted, Duplicate Review Required, Data Review, Pricing Review, Approval Pending, Revision Required, Approved, Publishing, Partially Published, Fully Published, Active, Replaced, Retired, Rejected/On Hold.
- In preview mode, “Active” means active inside preview only.
- Requestor fields, Master Data fields, purchase pricing, sell pricing, attachments, and conditional validation are all stored in preview tables.
- Existing Admin Panel item management remains unchanged.

### Phase 3: Duplicate and Similarity Check

- Search live approved/current items plus preview item requests.
- Include supplier mappings and stock snapshot item names as read-only candidate sources.
- Store duplicate checks as structured preview records.
- Exact live SKU matches block preview approval unless replacement path is selected.
- “Use existing item” closes the preview request only; it does not alter the live item.

### Phase 4: Preview Pricing and Margin Engine

- Add preview purchase and sell price draft/version tables.
- Support effective dates, UOM, supplier item code, landed cost, freight/handling, tax code, price type, customer/group/contract specificity.
- Block date overlaps within preview data and detect overlaps against live pricing where comparable.
- Calculate margin using preview purchase price first, then live cost references where available.
- Do not update `items.unit_price`, `catalog_items.price`, `ref_item_pricing`, or PO price logic.

### Phase 5: Preview Approval Workflow

- Extend the workflow concept for preview item approvals without affecting PO approvals.
- Store approval instances and decisions in preview tables.
- Support configurable rules for margin, business unit, branch, customer-specific price, urgent activation date, COG, replacement, and purchase-only items.
- Approval in preview locks preview records only.
- Rejection returns the preview request to Revision Required.

### Phase 6: Simulated Publication

- Build publication queue and event envelope in preview mode.
- Generate target payloads for Bundle, LinenHub, Salesforce, and internal catalogue API.
- Store payload hash, event ID, correlation ID, target system, retry state, and acknowledgement simulation.
- Add “simulate success”, “simulate failure”, and “retry simulation” actions for test users.
- No real downstream endpoint calls until go-live flag is enabled and separately approved.

### Phase 7: Preview Catalogue API

- Build catalogue service/API in preview mode first.
- Endpoint behaviour:
  - can include live-only, preview-only, or combined read modes depending on caller/test configuration.
  - default preview UI reads combined live + preview, clearly labelled.
- Salesforce API-first design is validated using preview endpoints or mocked consumers.
- No Salesforce, Bundle, or LinenHub production write integration is enabled in this phase.

### Phase 8: Operational Shadow Testing

- Run realistic item creation scenarios using live read-only data:
  - new purchase item
  - new sale item
  - purchase + sale item
  - replacement item
  - COG item
  - Bundle-only item
  - LinenHub-only item
  - shared operational item
  - customer-specific and contract pricing
- Compare preview output against current operational assumptions:
  - SKU uniqueness
  - supplier mapping compatibility
  - PO item selection implications
  - margin impact
  - Bundle/LinenHub payload completeness
  - Salesforce catalogue visibility rules
- Produce exception reports for data gaps that must be fixed before cutover.

### Phase 9: Cutover Readiness Package

- Create a go-live checklist:
  - preview workflow accepted by Master Data, Procurement, Commercial, Finance, Operations
  - production migration scripts reviewed
  - rollback plan approved
  - downstream endpoint credentials confirmed
  - publication retry/reconciliation tested
  - support process agreed
- Add dry-run migration:
  - convert selected preview-approved records into production migration payloads
  - validate without writing
  - produce final impact report.
- Define go-live date and freeze window.
- Keep existing app behaviour unchanged until go-live flag is enabled.

### Phase 10: Controlled Go-Live

- Enable production writes only after formal go-live approval.
- Promote selected preview-approved records into canonical production records.
- Switch PO creation from legacy item pricing to approved catalogue projection only after validation.
- Keep legacy direct item editing available in read-only or emergency-admin mode during the first stabilization window.
- Monitor publication queue, PO creation, pricing lookups, and support tickets daily during hypercare.

## Test Plan

- Unit tests:
  - SKU generation and validation.
  - duplicate scoring.
  - preview write-block enforcement.
  - price overlap detection.
  - margin calculation.
  - approval rule matching.
  - publication event idempotency.
- Database tests:
  - preview migrations apply cleanly.
  - preview tables do not mutate live tables.
  - RLS blocks non-preview users.
  - approval locks preview versions.
- UI tests:
  - create/save/submit preview request.
  - complete duplicate check.
  - approve/reject/revise in preview.
  - simulate publication success/failure/retry.
- Regression tests:
  - current Admin item management still works.
  - current PO creation still works.
  - existing PO approvals and deliveries still work.
  - stock mapping and Smart Buying still resolve current item IDs.
- Go-live rehearsal:
  - run dry-run promotion.
  - verify generated production payloads.
  - verify rollback script path.
  - verify build passes with preview enabled and go-live disabled.

## Future Optimisations and Next Steps

- Add a preview analytics dashboard for duplicate trends, approval bottlenecks, pricing exceptions, and publication failure patterns.
- Add bulk preview import for Master Data teams.
- Add downstream reconciliation reports comparing preview catalogue payloads with current Bundle/LinenHub/Salesforce structures.
- Add sandbox external integrations before production endpoint activation.
- After go-live stability, retire direct item editing and move all item changes through governed request, revision, replacement, retirement, and price-change workflows.
