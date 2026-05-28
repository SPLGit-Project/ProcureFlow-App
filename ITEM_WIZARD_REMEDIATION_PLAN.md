# Item Creation Workflow — Wizard Redesign Remediation Plan

**Date:** May 2026  
**Status:** For Review — No Code Changes Made Yet  
**Scope:** Full redesign of item creation, duplicate check, item definition, pricing, and approval workflows

---

## 1. Executive Summary

The current item creation workflow is fragmented across at least **9 separate components** and **2 parallel tracks** (legacy `ItemRequest` system and research `PreviewItemRequest` system), with no clear production-ready path, no unified role-based handoffs, and no consistent wizard experience across roles. End-to-end a request touches: `ItemRequestForm` → `MasterDataQueue` → `ItemRequestDetail` → `ItemDefinitionForm` → `ItemApprovalQueue` — each a completely separate screen with its own navigation, validation style, and UX pattern.

The redesign replaces all of this with a **single unified workflow** anchored by **five role-targeted wizard stages**, a shared wizard shell component, and a consistent requestor-visible progress tracker. Every participant — regardless of role — is guided step by step through only the tasks relevant to them.

---

## 2. Current State Diagnosis

### 2.1 Architecture Problems

| Problem | Impact |
|---|---|
| Dual-track system (legacy + preview) operating in parallel | Confusion about which system is "real"; preview system gated behind `manage_development` only |
| 9+ separate components stitched together with `navigate()` calls | No cohesive UX journey; users must know which screen to go to |
| ItemWizard is a modal embedded inside ItemCatalogue | Direct item editing has no page context; no route, no history |
| ItemDefinitionForm is a flat accordion form embedded in ItemRequestDetail | Accordion sections collapse/expand with no enforced step order or progress indicator |
| No unified state machine | Status transitions triggered by ad-hoc button clicks; no validation of legal transitions |
| Form state lost on navigation | No auto-save at step level; request state only persisted on explicit submit |
| ItemCreationPreview is 1,343 lines in one component | Unmaintainable; cannot be tested in isolation |

### 2.2 Role & Permission Problems

| Problem | Impact |
|---|---|
| Three disconnected permission gates (`manage_item_definition`, `approve_item_requests`, `manage_development`) with no unified RBAC model | Roles overlap; a user who can approve cannot see definition; a user who can define cannot see approvals |
| Requestor has no visibility of what stage their request is in post-submission | Users chase status manually; no contextual updates |
| MasterDataQueue does not show who the active assignee is | Work is unowned; no accountability |
| Approval queue has no per-role filtering | All approvers see all pending requests regardless of approval rule conditions |
| `manage_development` gate on ItemCreationPreview blocks production use | The most complete form in the system is inaccessible to non-developers |

### 2.3 UX & Technical Anti-patterns

| Location | Issue |
|---|---|
| `ItemRequestForm.tsx:83` | `window.alert()` on submit error |
| `ItemRequestForm.tsx:153,91` | `animate-fade-in` instead of `animate-page-entry` |
| `ItemWizard.tsx` | Hardcoded `#129DC0` color throughout |
| `ItemWizard.tsx` | Price governance failure logged to console only; not shown to user |
| `ItemWizard.tsx` | No permission gate on the component itself |
| `ItemDefinitionForm.tsx` | Flat accordion with no step enforcement; all sections visible simultaneously |
| `ItemApprovalQueue.tsx:92` | `instance_started_at` always null; SLA countdown always shows zero |
| `ItemApprovalQueue.tsx` | SLA hardcoded to 48 hours; not configurable |
| `ItemApprovalQueue.tsx` | Reject action has no reason field |
| `MyItemRequests.tsx:79` | `animate-fade-in` instead of `animate-page-entry` |
| `MyItemRequests.tsx` | No inline page header pattern (PageHeader used but nested inside flex row with button) |
| `ItemRequestDetail.tsx` | Hard-coded next-stage logic covers only first 3 statuses |
| `itemRequestService.ts` | `searchExistingItems()` hardcoded to return top 10 results only |

---

## 3. Proposed Architecture

### 3.1 Single Unified Workflow

The preview system (`ItemCreationPreview`, `itemCreationPreviewService`, `preview_*` tables) should be **retired from the navigation** and replaced with the production workflow described below. The preview system can be preserved as a hidden dev/demo mode if needed, but should not be surfaced as a live nav item.

The production flow is a single linear path:

```
[REQUESTOR]          [MASTER DATA]         [PRICING]         [APPROVER]
     │                     │                    │                  │
  1. Request            2. Duplicate         3. Pricing         4. Approval
     Wizard     ──►       Check      ──►      Wizard    ──►     Wizard
                          Wizard                                   │
                             │                                     ▼
                          3. Item                            APPROVED → ACTIVE
                          Definition
                          Wizard
```

Each box is a **dedicated full-page wizard** with a shared shell, visible only to the role responsible for that stage. Requestors can always see a read-only progress tracker at any stage.

### 3.2 The Five Wizard Stages

#### WIZARD 1 — New Item Request (Requestor)
**Replaces:** `ItemRequestForm.tsx`  
**Route:** `/items/new-request` (same)  
**Permission:** `create_request`  
**Steps:**

| # | Name | Fields | Notes |
|---|------|--------|-------|
| 1 | Item Type | Request type selector (8 types with descriptions + visual cards) | Type selection drives conditional fields throughout |
| 2 | What You Need | Item description (rich), business reason, required activation date, urgency toggle | Minimum character validation with live counter |
| 3 | Where It's Needed | Target systems (SAP, Bundle, LinenHub, Salesforce) as visual toggle cards; department, business unit | Conditional: customer-specific → customer reference + contract; replacement → item search |
| 4 | Review & Submit | Full read-only summary, SLA estimate, what happens next explainer | Auto-saves draft on each step; final submit sends to Master Data queue |

**Key improvements:**
- Type selector shows card descriptions explaining each type (not just labels)
- Live preview of item request number on Review step
- Post-submit: animated success state with reference number and a live progress timeline showing next steps
- Saves draft automatically on every step advancement (no data loss on back-navigation)

---

#### WIZARD 2 — Duplicate Check (Master Data)
**Replaces:** `DuplicateCheckPanel` (embedded in `ItemRequestDetail.tsx`)  
**Route:** `/items/requests/:id/duplicate-check` (new)  
**Permission:** `manage_item_definition`  
**Triggered from:** MasterDataQueue "Start Duplicate Check" button  
**Steps:**

| # | Name | Description |
|---|------|-------------|
| 1 | Request Summary | Read-only card: requestor, description, business reason, type, target systems |
| 2 | Catalogue Search | Live search panel with auto-populated query from request description; fuzzy match scoring; each result shows similarity %, SKU, category |
| 3 | Outcome Decision | Three radio options: **Exact Duplicate** (route to use existing) / **Similar — New Required** (document justification) / **No Duplicate Found** (advance to definition) |
| 4 | Confirm & Record | Summary of outcome + optional notes; confirm advances request status |

**Key improvements:**
- Auto-initiates search from request description on step load (no manual search needed)
- Similarity scoring surfaced visually (color-coded match %)
- "Exact Duplicate" path routes to a "Link to Existing Item" flow rather than silently closing
- Outcome is always recorded; no skipping

---

#### WIZARD 3 — Item Definition (Master Data)
**Replaces:** `ItemDefinitionForm.tsx` (accordion), `ItemWizard.tsx` (modal)  
**Route:** `/items/requests/:id/define` (new)  
**Permission:** `manage_item_definition`  
**Triggered from:** MasterDataQueue "Define Item" button (DATA_REVIEW status)  
**Steps:**

| # | Name | Fields |
|---|------|--------|
| 1 | Classification | Item Pool → Catalogue → Type → Category → Sub-Category (cascading; each depends on prior) |
| 2 | Identity | SAP Item Code (with normalization + duplicate check), Description (pre-filled from request), Display Name (auto-truncated), Division |
| 3 | Physical Attributes | UOM, UPQ, Weight, Size, Colour, Material, GSM |
| 4 | System Flags | Purchase enabled, Sale enabled, Bundle, LinenHub, Salesforce, RFID, COG (with conditional COG customer field) |
| 5 | Stock Levels | Min/Par Level, Max Level, Initial Stock Quantity |
| 6 | Review & Confirm | Full summary with edit-link per section; advances to Pricing Review or Approval Pending based on request type |

**Right panel (persistent throughout):** Shows the originating item request card — description, business reason, requestor, target systems. The master data team never loses context while defining.

**Key improvements:**
- Steps replace accordion (sequential enforcement; can go back freely but must complete current step)
- SAP code normalization runs live on blur with instant feedback
- Duplicate SAP check happens in step 2, not on final save
- Advances automatically to correct next stage based on whether pricing is needed

---

#### WIZARD 4 — Pricing Setup (Pricing Team)
**New wizard — no direct equivalent currently**  
**Route:** `/items/requests/:id/pricing` (new)  
**Permission:** `manage_sell_pricing`  
**Triggered:** When request reaches `PRICING_REVIEW` status  
**Steps:**

| # | Name | Fields | Conditional |
|---|------|--------|-------------|
| 1 | Context | Read-only: item definition summary, request type, target systems | Always |
| 2 | Purchase Pricing | Supplier, supplier item code, purchase UOM, unit price ex-GST, currency, MOQ, lead time, freight handling, effective dates | If purchase_enabled |
| 3 | Sale Pricing | Price type (standard / group / customer-specific), sale UOM, sell price ex-GST, tax code, publish targets, effective dates | If sale_enabled |
| 4 | Margin Review | Calculated margin %, threshold check, approval flag if below threshold | If both enabled |
| 5 | Confirm & Submit | Summary + auto-advances to APPROVAL_PENDING | Always |

**Key improvements:**
- Pricing is a first-class wizard stage rather than buried in ItemCreationPreview (which is dev-only)
- Margin threshold surfaced clearly before submission, not discovered at approval
- Separate steps for purchase and sale pricing (not all on one form)

---

#### WIZARD 5 — Approval Review (Approvers)
**Replaces:** `ItemApprovalQueue.tsx` detail pane, `ItemApprovalReview.tsx`  
**Route:** `/items/requests/:id/approve` (new)  
**Permission:** `approve_item_requests`  
**Triggered from:** Approvals queue card "Review" button  
**Steps:**

| # | Name | Description |
|---|------|-------------|
| 1 | Request Overview | Requestor context, business justification, urgency, target systems, SLA countdown |
| 2 | Item Definition | Full item master data summary: classification, identity, attributes, flags |
| 3 | Pricing Summary | Purchase + sale pricing, margin %, comparison to similar items |
| 4 | Decision | Approve / Request Revision / Reject — with required comments on anything other than Approve; revision sends specific feedback back to requestor |

**Key improvements:**
- SLA countdown based on actual `created_at` rather than always null `instance_started_at`
- Revision reason is mandatory (not a generic message) and surfaced directly to requestor
- Approver sees full audit trail of all prior decisions on the request
- Approvals are filtered by active approval rules (respects condition types configured in ApprovalRulesConfig)

---

### 3.3 The Requestor Progress Tracker
**Replaces/Extends:** `MyItemRequests.tsx`  
**Route:** `/items/my-requests` (same)

The current table-based view is extended with a **timeline view toggle**. Each request row expands to show a horizontal stage timeline:

```
● Submitted  ──►  ● Duplicate Check  ──►  ● Item Definition  ──►  ○ Pricing  ──►  ○ Approval  ──►  ○ Active
   Done               Done                    In Progress              Pending          Pending
```

Stages are colour-coded: done (green), active (brand blue + pulse), pending (gray), blocked/revision (amber), rejected (red).

If a request is at `REVISION_REQUIRED`, the requestor sees a banner on their request with the specific feedback from the approver and a "Respond to Revision" action (which opens a limited 1-step wizard for them to update their request before re-submitting).

---

## 4. Shared Wizard Shell Component

A new `<ItemRequestWizardShell>` component will be built to wrap all five wizards. This eliminates the 9-component duplication of progress bar logic, navigation buttons, and step validation.

### Props
```typescript
interface WizardShellProps {
  title: string;
  steps: { id: string; label: string; icon: LucideIcon }[];
  currentStep: number;
  onBack: () => void;
  onNext: () => void;
  onClose?: () => void;
  isNextDisabled?: boolean;
  isLoading?: boolean;
  nextLabel?: string;        // Default: "Continue"
  finalLabel?: string;       // Default: "Submit"
  isFinalStep?: boolean;
  contextPanel?: React.ReactNode;   // Right-panel content (request card, item summary, etc.)
  children: React.ReactNode;
}
```

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  ← Back   WIZARD TITLE                        Step 3/6  │
│  ─────────────────────────────────────────────────────  │
│  ● ────── ● ────── ●active─ ○ ────── ○ ────── ○        │
│  Step 1   Step 2   Step 3   Step 4   Step 5   Step 6    │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│  STEP CONTENT AREA           │  CONTEXT PANEL           │
│  (left, 2/3 width)           │  (right, 1/3 width)      │
│                              │  Request card            │
│                              │  Item summary            │
│                              │  SLA indicator           │
│                              │                          │
├──────────────────────────────┴──────────────────────────┤
│  ← Previous                           Continue →        │
└─────────────────────────────────────────────────────────┘
```

---

## 5. State Machine Formalisation

The current ad-hoc status transitions will be replaced with a formal transition table enforced in the service layer. Illegal transitions throw an error.

```
DRAFT
  → SUBMITTED                (requestor: submit wizard)

SUBMITTED
  → DUPLICATE_REVIEW         (master data: start duplicate check wizard)

DUPLICATE_REVIEW
  → DATA_REVIEW              (master data: outcome = no duplicate / similar)
  → ACTIVE                   (master data: outcome = use existing)
  → REVISION_REQUIRED        (master data: outcome = needs requestor clarification)

DATA_REVIEW
  → PRICING_REVIEW           (master data: item defined; purchase or sale enabled)
  → APPROVAL_PENDING         (master data: item defined; no pricing needed)

PRICING_REVIEW
  → APPROVAL_PENDING         (pricing team: pricing wizard submitted)
  → REVISION_REQUIRED        (pricing team: needs requestor clarification)

APPROVAL_PENDING
  → APPROVED                 (approver: approve)
  → REVISION_REQUIRED        (approver: request revision)
  → REJECTED                 (approver: reject)

APPROVED
  → PUBLISHING               (system: publication triggered)

PUBLISHING
  → PARTIALLY_PUBLISHED      (system: some targets succeeded)
  → FULLY_PUBLISHED          (system: all targets succeeded)

FULLY_PUBLISHED / PARTIALLY_PUBLISHED
  → ACTIVE                   (system: final confirmation)

ACTIVE
  → REPLACED                 (system: replacement item activated)
  → RETIRED                  (admin action)
```

---

## 6. Files to Create

| File | Purpose |
|---|---|
| `components/ItemRequestWizardShell.tsx` | Shared shell for all 5 wizards |
| `components/wizards/ItemRequestWizard.tsx` | Wizard 1 — New Request (replaces ItemRequestForm) |
| `components/wizards/DuplicateCheckWizard.tsx` | Wizard 2 — Duplicate Check |
| `components/wizards/ItemDefinitionWizard.tsx` | Wizard 3 — Item Definition (replaces ItemDefinitionForm + ItemWizard modal) |
| `components/wizards/PricingSetupWizard.tsx` | Wizard 4 — Pricing Setup (new) |
| `components/wizards/ApprovalReviewWizard.tsx` | Wizard 5 — Approval (replaces ItemApprovalQueue detail) |
| `services/itemWorkflowService.ts` | Centralised state machine + transition validation |
| `hooks/useItemWizardDraft.ts` | Auto-save hook: persists step state to DB on each advance |

---

## 7. Files to Modify

| File | Changes |
|---|---|
| `App.tsx` | Add 5 new wizard routes; keep existing routes as redirects during transition |
| `components/MasterDataQueue.tsx` | "Start Duplicate Check" → navigates to `/items/requests/:id/duplicate-check`; "Define Item" → `/items/requests/:id/define` |
| `components/MyItemRequests.tsx` | Add timeline view toggle; REVISION_REQUIRED callout; fix `animate-fade-in` → `animate-page-entry`; move "New Request" button to flex-end row separate from PageHeader |
| `components/ItemRequestDetail.tsx` | Simplify to read-only status viewer + audit log; wizard logic moved to wizard routes |
| `components/ItemApprovalQueue.tsx` | Keep queue list; clicking a request routes to `/items/requests/:id/approve` wizard; fix hardcoded SLA + null `instance_started_at` |
| `services/itemRequestService.ts` | Add `validateStatusTransition()` guard; remove hardcoded result limit on `searchExistingItems()`; add audit log writes |
| `constants/navigation.ts` | Remove `item-creation-preview` and `item-approval-queue` from DEFAULT_NAV_ITEMS (absorbed into wizard flows) |
| `components/ItemWizard.tsx` | Keep for direct catalogue item editing but fix: `#129DC0` → `var(--color-brand)`; add permission gate; surface price governance error via toast not console; wrap in full-page view option |

---

## 8. Files to Deprecate / Archive

| File | Reason |
|---|---|
| `components/ItemCreationPreview.tsx` | Replaced by unified production wizard system; can be archived as dev tool |
| `components/ItemApprovalReview.tsx` | Absorbed into ApprovalReviewWizard step 2-3 |
| `services/itemCreationPreviewService.ts` | Replaced by `itemWorkflowService.ts` |
| `components/ItemDefinitionForm.tsx` | Replaced by ItemDefinitionWizard |
| `components/ItemRequestForm.tsx` | Replaced by ItemRequestWizard |

> **Note:** These files should be moved to `_archive/` rather than deleted until the new system is validated end-to-end.

---

## 9. Database Changes Required

### 9.1 New columns on `item_requests`

```sql
-- Step-level draft state (JSON blob, auto-saved per step)
ALTER TABLE item_requests ADD COLUMN wizard_draft JSONB DEFAULT '{}';

-- Assigned to (who is currently responsible at this stage)
ALTER TABLE item_requests ADD COLUMN assigned_to UUID REFERENCES users(id);
ALTER TABLE item_requests ADD COLUMN assigned_at TIMESTAMPTZ;

-- Audit fields
ALTER TABLE item_requests ADD COLUMN status_changed_at TIMESTAMPTZ;
ALTER TABLE item_requests ADD COLUMN status_changed_by UUID REFERENCES users(id);

-- Revision reason (surfaced to requestor)
ALTER TABLE item_requests ADD COLUMN revision_reason TEXT;
ALTER TABLE item_requests ADD COLUMN revision_requested_by UUID REFERENCES users(id);
```

### 9.2 New `item_request_audit_log` table

```sql
CREATE TABLE item_request_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES item_requests(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,          -- 'STATUS_CHANGE', 'FIELD_EDIT', 'COMMENT', 'ASSIGNMENT'
  performed_by UUID REFERENCES users(id),
  performed_by_name TEXT,
  from_status TEXT,
  to_status TEXT,
  summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON item_request_audit_log(request_id);
```

### 9.3 SLA configuration in `app_config`

```sql
INSERT INTO app_config (key, value) VALUES 
  ('item_request_sla_hours', '{"SUBMITTED": 8, "DUPLICATE_REVIEW": 24, "DATA_REVIEW": 48, "PRICING_REVIEW": 24, "APPROVAL_PENDING": 48}');
```

---

## 10. Permission Model Rationalisation

The three disconnected permissions are consolidated into a clear capability map:

| Permission | Wizard Access | Description |
|---|---|---|
| `create_request` | Wizard 1 (New Request) | Any staff member who can raise a request |
| `manage_item_definition` | Wizard 2 (Duplicate Check) + Wizard 3 (Item Definition) | Master Data team |
| `manage_sell_pricing` | Wizard 4 (Pricing Setup) | Pricing team |
| `approve_item_requests` | Wizard 5 (Approval Review) | Approvers per approval rules |
| `view_items` | Read-only progress tracker (all stages) | Everyone — requestors, observers |
| `manage_development` | No longer gates production workflow | Remains as admin/dev feature flag only |

The `MyItemRequests` (requestor tracker) becomes accessible to **all authenticated users** — it only shows their own requests, so no privilege escalation.

---

## 11. Quick Wins (Can Execute Independently of Wizard Redesign)

These issues exist in the current codebase and can be fixed without touching the wizard architecture:

| # | File | Fix | Effort |
|---|------|-----|--------|
| 1 | `ItemRequestForm.tsx:83` | Replace `alert()` with `useToast()` error | 5 min |
| 2 | `ItemRequestForm.tsx:153,197` | `animate-fade-in` → `animate-page-entry` | 2 min |
| 3 | `MyItemRequests.tsx:79` | `animate-fade-in` → `animate-page-entry` | 2 min |
| 4 | `ItemWizard.tsx` | `#129DC0` → `var(--color-brand)` across all instances | 5 min |
| 5 | `ItemWizard.tsx` | Surface price governance error via `useToast()` error | 10 min |
| 6 | `ItemWizard.tsx` | Add `hasPermission('manage_items')` gate at component top | 5 min |
| 7 | `ItemApprovalQueue.tsx` | Fix SLA: read from `app_config` not hardcoded 48h; use `created_at` as SLA start if `instance_started_at` is null | 20 min |
| 8 | `ItemApprovalQueue.tsx` | Add reason textarea to Reject action | 15 min |
| 9 | `ItemRequestDetail.tsx` | Add remaining statuses to next-stage guidance logic | 10 min |
| 10 | `itemRequestService.ts` | Remove hardcoded `limit(10)` on `searchExistingItems()` | 2 min |

---

## 12. Recommended Implementation Phases

### Phase 0 — Quick Wins (Day 1, ~1 hour total)
Apply all 10 items from Section 11. No architectural changes; all isolated fixes.

### Phase 1 — Foundation (~1 day)
- Create `ItemRequestWizardShell.tsx` (shell component, no wizard content yet)
- Create `services/itemWorkflowService.ts` (state machine + transition validator)
- Create `hooks/useItemWizardDraft.ts` (auto-save hook)
- Apply DB migrations from Section 9

### Phase 2 — Request Wizard (~1 day)
- Build `components/wizards/ItemRequestWizard.tsx` (Wizard 1, 4 steps)
- Replace `ItemRequestForm.tsx` with new wizard at same route
- Update success screen with live progress tracker preview
- Update `MyItemRequests.tsx` with timeline toggle

### Phase 3 — Master Data Wizards (~2 days)
- Build `components/wizards/DuplicateCheckWizard.tsx` (Wizard 2, 4 steps)
- Build `components/wizards/ItemDefinitionWizard.tsx` (Wizard 3, 6 steps)
- Update `MasterDataQueue.tsx` card buttons to navigate to new wizard routes
- Add new routes to `App.tsx`
- Archive `ItemDefinitionForm.tsx`, `ItemRequestDetail.tsx` (simplified)

### Phase 4 — Pricing Wizard (~1 day)
- Build `components/wizards/PricingSetupWizard.tsx` (Wizard 4, 5 steps)
- Add `PRICING_REVIEW` handling to `MasterDataQueue.tsx` and add pricing team queue
- Update approval rules to reflect new stage

### Phase 5 — Approval Wizard (~1 day)
- Build `components/wizards/ApprovalReviewWizard.tsx` (Wizard 5, 4 steps)
- Update `ItemApprovalQueue.tsx` to navigate to wizard route on card click
- Wire SLA config from DB
- Add mandatory revision reason

### Phase 6 — Cleanup (~half day)
- Move deprecated files to `_archive/`
- Remove `item-creation-preview` and `item-approval-queue` from nav
- Remove `ItemCreationSettings` from Admin Panel (if item creation now has its own dedicated wizard flow)
- Remove `previewEnabled` feature flag (system is now production)

---

## 13. What Is NOT Changing

- The underlying `item_requests` and `items` Supabase tables (additive columns only)
- The `ItemCatalogue.tsx` browse experience
- The `ItemWizard.tsx` modal for direct catalogue item editing (fixed, not replaced)
- The `ApprovalRulesConfig.tsx` configuration screen
- Routing structure (new routes added; existing routes kept as redirects)
- The `MasterDataQueue.tsx` queue list view (only button actions are updated)

---

*Ready to execute on your approval. Recommend starting with Phase 0 quick wins immediately, then confirming Phase 1 foundation scope before proceeding.*
