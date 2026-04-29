# ProcureFlow Item Creation Integration Plan

## Summary

Implement the official item creation process as a governed lifecycle inside ProcureFlow while preserving current PO, stock, mapping, and item-management workflows during migration.

Key defaults locked:
- ProcureFlow is the item and pricing source of truth.
- Use the MD SKU convention.
- Salesforce consumes approved catalogue data API-first, with snapshot publication as fallback.
- Bundle and LinenHub receive approved item and price publications from ProcureFlow.
- SAP receives financial outcomes only, not item workflow events.

## Current State

- Items are managed directly from Admin Panel using `ItemWizard` and `Settings`; saves write straight to `items`.
- Item taxonomy exists through `attribute_options` and `CatalogManagement`, but current values are labels, not governed reference codes.
- Pricing is fragmented:
  - `items.unit_price` and `specs.priceOptions` drive PO selection.
  - `catalog_items.price` stores supplier catalogue price.
  - `stock_snapshots.sell_price` can override estimated PO price.
  - `ref_item_pricing` exists for site purchase pricing but is not date-ranged beyond one effective date and has no version history.
- Supplier item mapping exists through `supplier_product_map`.
- PO lines already lock `item_id`, `sku`, `unit_price`, `total_price`, and optional price option metadata.
- Approval workflow exists for POs, but not for item creation, item pricing, publication, or price overrides.
- Audit logging exists for `items` and key transactional tables, but item request field-level governance is not yet implemented.

## Target State

ProcureFlow will support a full governed item lifecycle:

1. Requestor creates an item request in Draft.
2. System runs duplicate and similarity checks before submission.
3. Master Data validates item identity and generates SKU.
4. Procurement adds purchase pricing where required.
5. Commercial adds sell pricing where required.
6. ProcureFlow calculates margin and applies configurable approval routing.
7. Approved item and price versions become immutable.
8. Publication queue sends approved catalogue records to Bundle, LinenHub, and Salesforce.
9. External acknowledgements update request publication status.
10. Existing PO creation reads only active, approved item and price records once the new catalogue is live.

## Phased Implementation

### Phase 0: Baseline and Migration Design

- Inventory all current item records and classify each as `legacy_active`, `legacy_archived`, or `migration_exception`.
- Produce a one-time mapping from existing `items` columns into the future approved item model.
- Keep `items.id` as the canonical internal item ID to avoid breaking PO lines, supplier mappings, smart buying, stock snapshots, and audit history.
- Add feature flags:
  - `item_creation_workflow_enabled`
  - `approved_catalogue_enforced`
  - `catalogue_api_enabled`
  - `legacy_item_editing_locked`
- Define migration rollback points before every database phase.

### Phase 1: Reference Data and SKU Foundation

- Extend reference data beyond current `attribute_options` by adding governed code metadata:
  - category code, product type code, size code, colour code, GSM/weight class, business unit, request department, business reason, tax/revenue category.
- Keep `attribute_options` for UI hierarchy where useful, but introduce canonical reference tables or a typed `reference_values` table with:
  - `type`, `code`, `label`, `active_flag`, `sort_order`, `metadata`, `created_at`, `updated_at`.
- Update Catalog Management so admins maintain both display labels and codes.
- Build a deterministic SKU service using the MD convention:
  - item type, RFID flag, category, product type, size, variety/clothing size, colour, GSM.
- Validate SKU rules on save and submit:
  - unique in ProcureFlow active catalogue
  - uppercase alphanumeric only
  - no spaces or special characters
  - all segments sourced from active reference codes
- Add SKU override support for Master Data only, with mandatory justification and audit record.

### Phase 2: Item Request Data Model

Add new workflow tables without replacing `items` immediately:

- `item_requests`
  - request number, request type, requestor, department, business unit, branch/site, required activation date, status, business reason, replacement item, customer reference, flags for purchase/sale/Bundle/LinenHub/Salesforce.
- `item_request_drafts`
  - structured draft payload for incomplete requestor forms.
- `item_duplicate_checks`
  - search terms, candidates, match count, highest score, selected outcome, justification, performed by.
- `item_master_drafts`
  - SKU proposal, confirmed description, classification, RFID, COG, UOM, availability flags.
- `purchase_price_drafts`
  - supplier, supplier item code, UOM, purchase price ex GST, currency, MOQ, lead time, freight, landed cost, effective dates.
- `sell_price_drafts`
  - price type, customer or group, sale UOM, sell price ex GST, tax code, effective dates, target systems.
- `item_approval_instances` and `item_approval_decisions`.
- `publication_events`.

Use enums or check constraints for request status and price status.

### Phase 3: Requestor Workflow UI

- Add a new route such as `/item-requests` and a nav item gated by `create_request` or a new `create_item_request` permission.
- Build an item request wizard separate from the current Admin item editor.
- Requestor steps:
  - Request context
  - Item need and request type
  - Item description and classification
  - Purchase section if purchase enabled
  - Sell section if sale enabled
  - Duplicate check
  - Review and submit
- Enforce hard submission blocks:
  - missing mandatory fields
  - duplicate check not completed
  - purchase and sale both disabled
  - purchase enabled without supplier or purchase price
  - sale enabled without sell price
  - zero or negative purchase/sell price
  - required activation date before request date
- Store drafts continuously; audit field changes only after first submission.

### Phase 4: Duplicate and Similarity Engine

- Reuse existing normalization logic from `utils/normalization.ts`.
- Extend duplicate search across:
  - current `items`
  - supplier mappings
  - active/approved item drafts
  - Bundle/LinenHub mappings when available
  - customer-specific item metadata
- Score candidates using:
  - exact SKU match
  - normalized SKU match
  - description similarity
  - category/type/size/colour match
  - same supplier
  - customer reference match
- Block exact SKU duplicates unless the request is a justified replacement.
- Require structured requestor outcome:
  - `NoDuplicate`
  - `UseExisting`
  - `SimilarNewRequired`
- Close request when `UseExisting` is selected and record the existing item reference.

### Phase 5: Pricing, Margin, and Versioning

- Add canonical price version tables:
  - `item_purchase_price_versions`
  - `item_sell_price_versions`
- Purchase price uniqueness:
  - no overlapping effective dates for same item, supplier, purchase UOM.
- Sell price uniqueness:
  - no overlapping effective dates for same item, price type, customer/customer group, sale UOM.
- Calculate landed cost from purchase price plus freight/handling.
- Calculate margin percentage and margin dollars from approved purchase or landed cost.
- Keep legacy `items.unit_price` as a compatibility projection during migration.
- Add a database view or service mapper that returns current effective price for PO creation.
- Update PO creation in a later phase to use approved active price records instead of ad hoc `unitPrice`/`priceOptions`.

### Phase 6: Configurable Item Approval Workflow

- Extend the current workflow concept rather than hardcoding item approval rules.
- Add workflow rule support for:
  - request type
  - business unit
  - branch/site
  - margin threshold
  - customer-specific price
  - contract-specific price
  - urgent required activation date
  - replacement item
  - purchase-only item
- Approval decisions must store:
  - approver user ID
  - timestamp
  - decision
  - comments
  - matched rule
  - stage number
- Rejection returns request to `Revision Required`.
- Approval locks item and price draft payloads.
- SLA expiry creates in-app notification and escalates according to configured workflow rules.

### Phase 7: Publish Approved Catalogue Internally

- On final approval, create immutable approved records:
  - approved item version
  - purchase price version
  - sell price version
  - availability rules
  - external mapping placeholders
- Update existing `items` row as the compatibility master record only after approval.
- Block direct edits to approved/published items; changes must create a revision, replacement, or price-change request.
- Admin Panel item editing becomes legacy-maintenance only until `legacy_item_editing_locked` is enabled.
- Archive remains available, but retirement/replacement should become governed item lifecycle actions.

### Phase 8: Publication Queue and Downstream Integration

- Add `publication_events` with:
  - event ID
  - correlation ID as item request ID
  - item ID
  - price ID where applicable
  - target system
  - payload hash
  - payload JSON
  - status
  - retry count
  - last error
  - published/acknowledged timestamps
- Implement idempotent publication:
  - same target, item ID, price ID, and payload hash updates existing event instead of creating duplicates.
- Build acknowledgement endpoint:
  - `POST /publication/acknowledgements`
- Publication statuses:
  - Pending
  - Published
  - Acknowledged
  - Failed
  - Retrying
- Request status becomes:
  - `Publishing`
  - `Partially Published`
  - `Fully Published`
  - `Active`

### Phase 9: Catalogue API

Implement API endpoints for downstream consumers:

- `GET /catalogue/items`
  - filters: `targetSystem`, `businessUnit`, `branch`, `customerId`, `effectiveDate`.
- `GET /catalogue/items/{itemId}`
- `GET /catalogue/prices`
- `POST /pricing/override-requests`
- `POST /publication/acknowledgements`

Rules:
- Salesforce can read approved sellable items only.
- Salesforce cannot create or edit item master or base price.
- Salesforce price override creates a ProcureFlow price approval request.
- Bundle and LinenHub receive only records flagged for their target system.
- SAP is excluded from item workflow publication.

### Phase 10: PO and Operational Flow Cutover

- Update `POCreate` catalogue loading to read from approved active catalogue projection.
- Preserve existing PO line locking semantics.
- Add `priceId` to PO lines when using approved sell price records.
- Keep historical PO prices immutable.
- Ensure archived, replaced, retired, or unpublished items cannot be added to new POs.
- Existing POs continue to display legacy item names/prices from locked line data.
- Update Smart Buying and BundleConnect references to use approved purchase price versions where available.

## Test Plan

- Unit tests:
  - SKU generation and validation.
  - Duplicate scoring and outcome validation.
  - Effective-date overlap checks.
  - Margin calculations.
  - Approval rule matching.
  - Publication idempotency.
- Database tests:
  - migration applies cleanly.
  - legacy items remain readable.
  - approved records are immutable.
  - date overlap constraints block invalid prices.
  - RLS allows only authorised item workflow actions.
- UI tests:
  - save draft with incomplete request.
  - block invalid submission.
  - complete duplicate check.
  - submit purchase-only, sale-only, purchase+sale, replacement, COG, Bundle-only, LinenHub-only requests.
  - approve, reject, revise, and publish.
- Integration tests:
  - catalogue API returns only approved effective records.
  - acknowledgement updates publication status.
  - Salesforce override creates a ProcureFlow approval request.
  - Bundle/LinenHub publication retries after failure.
- Regression tests:
  - existing PO creation still works before cutover.
  - existing POs retain historical line prices.
  - stock mapping, supplier mappings, and Smart Buying still resolve item IDs.
  - `npm run build` passes.

## Future Optimisations and Next Steps

- Add a dedicated item governance dashboard showing SLA breaches, duplicate trends, margin exceptions, and publication failures.
- Add bulk item request import for Master Data teams, using the same validation and approval engine.
- Add richer fuzzy matching with weighted attribute similarity and cross-system catalogue memory.
- Add price simulation before approval to show margin impact by customer, branch, and business unit.
- Add downstream reconciliation reports comparing ProcureFlow approved catalogue against Bundle, LinenHub, and Salesforce snapshots.
- Harden RLS around item request, price, approval, and publication tables before external API exposure.
- After stable cutover, remove legacy direct item editing and keep only governed revisions, replacements, retirements, and price changes.
