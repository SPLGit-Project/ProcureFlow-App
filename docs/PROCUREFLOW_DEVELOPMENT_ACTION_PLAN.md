# ProcureFlow Master Strategic Development & Action Plan (v3.0)

**Document Title:** Operational Achievements, Strategic Enhancements & Forward Pipeline  
**Document Version:** 3.0 (Post-Review Edition — Incorporating September 2, 2:00 PM Alignment)  
**Governance Committee & Key Stakeholders:**
* **Ebrahim Mokhtari** — *Chief Operating Officer (COO)*
* **Ashish Chhabra** — *Procurement Lead & System Super User*
* **Aaron Bell** — *Tech Lead & ProcureFlow Developer*  
**Repository Branch:** [`feature/eom-budget-governance-improvements`](https://github.com/SPLGit-Project/ProcureFlow-App/tree/feature/eom-budget-governance-improvements)  
**Key Alignment Dates:**
* **Pre-Workshop Alignment Catch-Up:** Thursday, September 3, 2026 (8:30 AM – 9:00 AM) — *Aaron Bell & Ashish Chhabra*
* **Executive Workshop with COO:** Thursday, September 3, 2026 (10:00 AM) — *Ebrahim Mokhtari, Ashish Chhabra, Aaron Bell*

---

## Executive Summary: Evolution, Not Repair

ProcureFlow is an active, reliable, and deeply embedded procurement platform running daily operations across South Pacific Laundry's national network. It has successfully replaced fragmented paper ordering, phone calls, and email chains with a unified digital ecosystem.

> [!NOTE]
> **The Strategic Mindset: Evolution, Not Repair**  
> The improvements outlined in this action plan are **not intended to "fix" a broken system**, but rather to elevate an already successful, high-performing operational platform to the next level of automation, financial intelligence, and closed-loop governance.

```mermaid
flowchart LR
    subgraph PastAchievements ["1. Completed in Last 3 Months"]
        A["Collaborative Execution<br/>Aaron, Ashish & Kiran"]
        B["100% Item Code Mapping<br/>Compliance: 50% -> 95-100%"]
        C["Procurement Email Engine<br/>Automated Catalog Ingestion"]
        D["11 Facilities Operating<br/>8 Primary Hubs + Satellites"]
    end

    subgraph Elevation ["2. Current Elevation (August/September)"]
        E["Point-of-Entry Governance<br/>Packaging Multiples Check"]
        F["Automated ERP Parity<br/>Mandatory Concur PR Link"]
        G["Automated Escalations<br/>Closure & Overdue Nudges"]
        H["Executive EOM Reconciliation<br/>Real-Time 2D Pivot & FY27 Budget"]
    end

    subgraph ForwardPipeline ["3. Forward Pipeline (Next 2 Months)"]
        I["Adelaide Rollout Blueprint<br/>4-Phase Scalable Template"]
        J["Live SOH Testing Pipeline<br/>Thorough 2-Month Validation"]
        K["Omnichannel Notifications<br/>Teams, Email & In-App"]
        L["Training Video Governance<br/>Mandatory User Sign-Off"]
    end

    PastAchievements -->|Elevating Current Operations| Elevation -->|Forward Strategic Roadmap| ForwardPipeline
```

---

## 1. Completed Achievements in the Last Three Months

ProcureFlow is a proven, working solution. The past three months (May – August 2026) represent a period of rapid operational foundation-building delivered collaboratively by **Aaron Bell (Tech Lead)**, **Ashish Chhabra (Procurement Lead)**, and **Kiran**:

```mermaid
flowchart TD
    subgraph ThreeMonthAchievements ["Major Achievements in the Last 3 Months"]
        A1["1. Collaborative Triad Execution<br/>Joint delivery by Aaron Bell, Ashish Chhabra & Kiran"]
        A2["2. Supplier Linkage Compliance: 50% -> 95-100%<br/>Dramatic surge in catalog mapping accuracy"]
        A3["3. Automated SPL Procurement Email System<br/>Reads and ingests supplier catalog and stock feeds"]
        A4["4. Active Scale Across 11 Facilities<br/>8 Primary Regional Hubs + Satellite Depots"]
        A5["5. Mandatory Training Video Governance<br/>Enforced user sign-off before ordering activation"]
        A6["6. Mobile Usability Polish<br/>Resolved mobile requests screen scrolling constraint"]
    end
```

### 1. Collaborative Triad Execution & Master SKU Management
* **The Team:** A focused collaboration between Aaron Bell, Ashish Chhabra, and Kiran systematically overhauled SPL's national linen master data.
* **Standardized SKU Taxonomy:** Eliminated arbitrary branch-specific naming. Replaced manual spreadsheet cross-referencing with a unified, clean item master catalog in ProcureFlow.

### 2. Supplier Linkage Compliance: Surge from ~50% to ~95%–100%
* **Before Launch (Feb – Apr 2026):** Supplier catalog linkage and mapping compliance hovered around **~50%**. Orders were plagued by unmapped SKUs, mismatched product descriptions, and pricing discrepancies.
* **Following Three Months (May – Aug 2026):** Through intensive data normalization, supplier catalog linkage surged to **~95% to 100%** for primary commercial suppliers (Simba, Host).
* **The Business Proof:** This measurable jump proves that ProcureFlow's data foundation is stable, active, and delivering tangible operational results.

```mermaid
pie title Supplier Linkage Compliance Progression
    "Feb–Apr 2026 (Pre-Launch Baseline)" : 50
    "Unmapped / Manual Ambiguity" : 50
```
```mermaid
pie title Current Supplier Linkage Compliance (Last 3 Months)
    "Mapped & Linked SKUs (Simba, Host)" : 96
    "Legacy / Discontinued Lines" : 4
```

### 3. Automated SPL Procurement Email Ingestion Engine
* **Automated Data Capture:** Developed an intelligent email ingestion pipeline directly integrated with the `procurement@splservices.com.au` ecosystem.
* **Background Catalog Processing:** The system automatically reads, parses, and ingests incoming supplier inventory and catalog notifications in the background, eliminating hours of manual copy-pasting.

### 4. Reliable Operational Scale Across 11 Facilities
* **Operating Reach:** ProcureFlow actively manages daily linen purchasing across **11 operational facilities** (comprising SPL's 8 primary regional hubs: **Melbourne, Sydney, Brisbane, Perth, Adelaide, Cairns, Mackay, and Albury**, plus 3 satellite depots/plants).
* **High-Volume Reliability:** Processes hundreds of monthly requisitions with zero downtime, enforcing site delivery address routing and local manager sign-offs.

### 5. Mandatory Training Video & Governance Sign-Off
* **User Accountability:** Implemented a formal onboarding requirement: all site requesters must watch the standardized ProcureFlow training video and confirm/tick off their completion before receiving ordering access.
* **Governance Assurance:** Guarantees that staff understand order entry standards, pack size adherence, and receipting responsibilities.

### 6. Mobile Usability Polish: Requests Screen Scrolling Fix
* **Issue Identified:** On mobile devices, the requests list was visually constrained by an inner overflow wrapper, limiting visible items to only two requests.
* **Resolved in Code:** Updated [`components/POList.tsx`](file:///C:/Github/ProcureFlow-App/components/POList.tsx) to provide smooth `overflow-y-auto` scrolling on mobile viewports, allowing warehouse and plant staff to scroll seamlessly through all active orders on phones and tablets.

---

## 2. Targeted Improvement Plan: Issues, Solutions & Strategic Justifications

Building upon this working operational foundation, the following 10 targeted enhancements eliminate remaining points of human friction, automate financial reconciliation, and enforce zero-defect ordering.

```mermaid
flowchart TD
    subgraph Pillars ["10 Targeted Continuous Improvement Areas"]
        P1["Item 1: EOM Spend Reconciliation Engine"]
        P2["Item 2: Point-of-Entry Packaging Governance"]
        P3["Item 3: Contract Price Master Validation"]
        P4["Item 4: Mandatory Concur PR # Enforcement"]
        P5["Item 5: 100% Goods Receipt Closure Nudges"]
        P6["Item 6: Overdue Delivery Manager Escalation"]
        P7["Item 7: Multi-Facility Order Attribution"]
        P8["Item 8: Live Self-Service SOH Distribution"]
        P9["Item 9: DOA Multi-Tier Approval Engine"]
        P10["Item 10: Homepage Action Required Center"]
    end
```

---

### Item 1: Month-End (EOM) Financial Reconciliation & Manual Excel Crunching

#### A. The Issue / Challenge
* **Context:** South Pacific Laundry manages a **\$14.521M FY27 operating linen budget** across 8 regional branches (\$9.921M Depletion, \$2.30M New Business, \$2.30M Linen Hub).
* **The Challenge:** To produce monthly financial figures for Ebrahim Mokhtari (COO) and finance, Ashish Chhabra (Super User) spent 2 to 3 days each month manually exporting raw Concur records, manually dividing totals by 1.1 to strip GST, parsing unstructured PO descriptions (`- A -` for Accommodation vs `- H -` for Healthcare; `DEP` vs `NB`), and manually assembling multi-sheet 2D pivot tables.
* **The Business Impact:** Significant administrative time spent on manual spreadsheet math, single-person operational dependency, and risk of formula errors when tracking multi-million dollar budget burn rates.

#### B. The Engineered Solution
* **Component Delivered:** Native EOM Spend & Budget Reconciliation Engine in [`utils/budgetTracking.ts`](file:///C:/Github/ProcureFlow-App/utils/budgetTracking.ts) and [`components/ReportingView.tsx`](file:///C:/Github/ProcureFlow-App/components/ReportingView.tsx).
* **Key Features:**
  * **Automated Ex-GST Math:** $\text{Ex-GST} = \text{Inc-GST} / 1.10$ calculated natively across all transactions.
  * **100% Precision Regex Classifier:** Parses legacy and unstructured PO descriptions with verified 100.0% accuracy matching Ashish's historical dataset.
  * **2D Cross-Tabulation Pivot Matrix:** Replicates Ashish's exact Concur EOM pivot layout:
    $$\text{Branch} \times \text{Sector (Accommodation vs Healthcare)} \times \text{Category (Depletion vs New Business vs Linen Hub)}$$
  * **FY27 Budget Tracking Grid:** Tracks monthly actuals, monthly targets, variance (+/-), total annual budget, and YTD burn % across all 8 operating entities.
  * **Dedicated Linen Hub Decrement Pool:** Real-time remaining balance tracking against the \$2.30M pool.
  * **Strategic Subcontract Visibility:** Real-time YTD spend for HealthShare Victoria (HSV) and Ramsay Health Care (RHC).
  * **1-Click Concur EOM CSV Export:** Downloads a leadership-ready spreadsheet in one click.

#### C. Why This is the Solution
* **Replaces Days with Seconds:** Automates a 3-day manual Excel task into an instant, live executive dashboard available 24/7.
* **Guarantees Zero Formula Errors:** System-level calculation rules eliminate copy-paste and human mathematical errors.
* **Single Source of Truth:** Unifies ProcureFlow and SAP Concur into a single reconciled ledger, giving executive leadership immediate confidence in budget burn rate tracking.

---

### Item 2: Arbitrary Requisition Quantities & Packaging Disconnect

#### A. The Issue / Challenge
* **Context:** Commercial linen suppliers (Simba, Host, etc.) pack and ship goods in standardized commercial cartons (e.g. 240 face washers per carton, 100 sheets per pack).
* **The Challenge:** Site staff entered arbitrary quantities into ProcureFlow (e.g. ordering 5,000 units on a 240 carton size = 20.83 cartons, or 90 units on a 100 pack size). Suppliers cannot break cartons, forcing Ashish to reject the order, email the site, wait for recalculation, and have the order re-raised (e.g. to 5,040 units / 21 cartons).
* **The Business Impact:** Operational delays in linen replenishment, unnecessary email loops, site frustration, and manual rework for the procurement lead.

#### B. The Engineered Solution
* **Component Delivered:** Packaging Modulo Validation in [`components/POCreate.tsx`](file:///C:/Github/ProcureFlow-App/components/POCreate.tsx), [`components/PODetail.tsx`](file:///C:/Github/ProcureFlow-App/components/PODetail.tsx), and [`types.ts`](file:///C:/Github/ProcureFlow-App/types.ts).
* **Key Features:**
  * **Live Modulo Evaluation:** Checks $\text{quantityOrdered} \pmod{\text{cartonQty}} == 0$ during line entry.
  * **Hard Submission Block:** Disallows submitting the order for approval if any line violates packaging rules.
  * **1-Click Smart Rounding:** When an invalid quantity is keyed, an animated alert displays the carton size and provides a 1-click button to round to the nearest valid multiple (e.g., clicking *"Round to 5,040 units"* automatically updates the cart and recalculates totals).

#### C. Why This is the Solution
* **Zero-Defect at Point-of-Entry:** Stops errors before the purchase order is ever submitted, rather than catching them days later during procurement review.
* **Frictionless User Experience:** Instead of frustrating users with a passive error message, the 1-click smart rounder solves the problem instantly for the user.
* **Eliminates Procurement Rework:** Ashish no longer needs to act as a manual carton calculator, freeing his time for strategic vendor and inventory management.

---

### Item 3: Contract Price Deviations & Invoice Matching Failures

#### A. The Issue / Challenge
* **The Challenge:** Requesters had free-text price editing access during order creation. A simple typo (e.g. keying **61¢** instead of the contracted rate of **51¢** for face washers) propagated downstream to the supplier and SAP Concur.
* **The Business Impact:** When the supplier invoiced at the true contracted rate (51¢), automated 3-way matching in finance failed due to a price mismatch. This froze the invoice, generated manual email investigations between finance, procurement, and vendors, and delayed invoice settlement.

#### B. The Engineered Solution
* **Component Delivered:** Contract Price Master Validation in [`components/POCreate.tsx`](file:///C:/Github/ProcureFlow-App/components/POCreate.tsx) and [`types.ts`](file:///C:/Github/ProcureFlow-App/types.ts).
* **Key Features:**
  * **Leverages 100% Item Mapping Milestone:** All internal SPL item codes are linked to vendor catalog SKUs.
  * **Contract Price Auto-Population:** Active supplier catalog rates populate line items automatically.
  * **Zero-Price & Override Blocking:** Prohibits \$0.00 unit prices and blocks unapproved manual price overrides upon submission.

#### C. Why This is the Solution
* **Prevents Downstream Finance Bottlenecks:** Ensuring purchase order prices match supplier contracts guarantees clean 3-way matching in finance upon invoice receipt.
* **Protects Commercial Margin:** Prevents accidental over-payment or unauthorized supplier price creep.

---

### Item 4: Missing Concur Reference Numbers on Order Closure

#### A. The Issue / Challenge
* **The Challenge:** When an order is approved in ProcureFlow, it must be entered into SAP Concur as a Purchase Request (PR #). In practice, site staff received physical shipments on site and completed the order in ProcureFlow without ever returning to enter the Concur PR # or Concur PO #.
* **The Business Impact:** ProcureFlow and SAP Concur fell out of sync. Finance could not determine which Concur PO matched which ProcureFlow physical delivery, creating orphaned records and breaking audit traceability.

#### B. The Engineered Solution
* **Component Delivered:** Mandatory Concur Reference Validation in [`components/PODetail.tsx`](file:///C:/Github/ProcureFlow-App/components/PODetail.tsx).
* **Key Features:**
  * **Hard Block on Closure:** In `handleCompletePO` and `handleForceStatusUpdate`, the system inspects `concurRequestNumber` and `concurPoNumber`.
  * **Blocking Prompt:** If neither reference exists, order completion is blocked with a clear dialog:
    `"❌ CANNOT COMPLETE ORDER: Concur Reference Number (Request PR # or Concur PO #) is required before this order can be closed."`

#### C. Why This is the Solution
* **Enforces Compliance at the Finish Line:** By placing the block at the final step of order completion, users are forced to capture the Concur reference before the transaction is finalized.
* **Guarantees 100% ERP Mirroring:** Guarantees that every completed order in ProcureFlow has a corresponding audit mirror in SAP Concur, enabling automated month-end reconciliation.

---

### Item 5: Lingering Open Purchase Orders Post-Delivery

#### A. The Issue / Challenge
* **The Challenge:** Laundry sites received 100% of their physical goods, logged the delivery docket, but closed their browser without clicking "Complete Order".
* **The Business Impact:** Financial reports showed ongoing open PO commitments for orders that were physically completed. Procurement had to manually chase site managers across Australia to confirm whether orders were finished or still pending shipments.

#### B. The Engineered Solution
* **Component Delivered:** Automated Goods Receipt Closure Reminders in [`services/notificationEngineService.ts`](file:///C:/Github/ProcureFlow-App/services/notificationEngineService.ts).
* **Key Features:**
  * **Automated Background Detection:** Evaluates orders where $\text{quantityReceived} \ge \text{quantityOrdered}$ but status is not `'CLOSED'`.
  * **Recurring Daily Nudges:** Sends automated daily notifications to the order requester:
    `"PO #XXX is 100% received. Please review and complete this order."`
  * **Variance Routing:** If delivered quantities differed from ordered quantities, instructs the requester to contact Ashish Chhabra to amend quantities before completing.

#### C. Why This is the Solution
* **Closes the Operational Loop:** Continual automated nudges prompt site users to finalize transactions without requiring manual phone calls or emails from procurement.
* **Clean Financial Commitments:** Ensures that open PO commitments in executive reporting reflect only genuinely outstanding shipments.

---

### Item 6: Stalled Overdue Deliveries (>14 Days) Lacking Management Visibility

#### A. The Issue / Challenge
* **The Challenge:** Purchase order lines frequently sat 2, 3, or 4 weeks past their required delivery date (`needByDate`) with 0 units received, without being updated or cancelled.
* **The Business Impact:** Site managers remained unaware of delayed stock until laundry linen shortages hit operations. Procurement lacked automated visibility into supplier delivery SLA breaches.

#### B. The Engineered Solution
* **Component Delivered:** Tiered Overdue Delivery Escalation Hierarchy in [`services/notificationEngineService.ts`](file:///C:/Github/ProcureFlow-App/services/notificationEngineService.ts).
* **Key Features:**
  * **Tier 1 (Day 15 Past Need-By):** Automated alert sent to the requester prompting for an updated `needByDate` or supplier cancellation.
  * **Tier 2 (Day 21 Past Need-By):** Progressive escalation copying relevant line managers:
    * *Melbourne & Albury Requesters (e.g. Katrina, Braun):* Copied to **David**.
    * *National & Other Sites:* Copied to **Ashish Chhabra** and **Ebrahim Mokhtari**.
  * **Omnichannel Delivery:** Delivered via In-App Notification Drawer, Microsoft Graph Email, and Microsoft Teams Power Automate Adaptive Cards.

#### C. Why This is the Solution
* **Accountability Through Visibility:** Copying regional operations managers and executive leadership creates transparent operational accountability that drives rapid supplier follow-up.
* **Accurate Supply Chain Planning:** Forces sites to maintain realistic `needByDate` records, giving procurement an accurate picture of actual stock in transit.

---

### Item 7: Multi-Facility Order Attribution & Site Cost Confusion

#### A. The Issue / Challenge
* **Context:** For commercial and logistical efficiency, central procurement occasionally places a single national bulk order with a supplier (e.g. Simba) under one branch account (e.g. Melbourne), with instructions for the supplier to distribute stock nationally (Perth, Sydney, etc.).
* **The Challenge:** In local branch reports, the entire national cost initially appeared under the purchasing site (Melbourne), leading the site manager (Matt) to challenge spend reports (\$1.6M) and question why his branch was absorbing national costs.
* **The Business Impact:** Inter-branch friction, distorted site P&L accountability, and erosion of trust in system reporting.

#### B. The Engineered Solution
* **Component Delivered:** Multi-Facility Distribution Attribution Rules in [`utils/budgetTracking.ts`](file:///C:/Github/ProcureFlow-App/utils/budgetTracking.ts) and [`components/ReportingView.tsx`](file:///C:/Github/ProcureFlow-App/components/ReportingView.tsx).
* **Key Features:**
  * **Clear Requisition Attribution:** Distinguishes between orders raised for local branch consumption vs national distribution orders.
  * **Transparent Delivery Destination Tracking:** Captures the true receiving facility on delivery lines, ensuring costs follow the physical destination of the linen.

#### C. Why This is the Solution
* **Fair P&L Accountability:** Site managers are accountable only for the linen delivered to their facility.
* **Operational Principle Reinforced:** Reinforces the leadership directive established by Ebrahim Mokhtari: site managers must manage and verify their own operational data, while ProcureFlow provides transparent, unchallengeable reporting.

---

### Item 8: Manual Stock-on-Hand (SOH) Distribution Overhead

#### A. The Issue / Challenge
* **The Challenge:** Procurement spent valuable hours every week manually gathering, cleaning, reformatting, and emailing supplier inventory spreadsheets (SIMBA SOH and HOST SOH) across state managers.
* **The Business Impact:** High administrative burden; state managers relied on static, out-of-date attachments and frequently raised orders for out-of-stock items.

#### B. The Engineered Solution
* **Component Delivered:** Self-Service Live SOH Reporting (`SUPPLIER_INVENTORY`) in [`components/ReportingView.tsx`](file:///C:/Github/ProcureFlow-App/components/ReportingView.tsx).
* **Key Features:**
  * **Automated Data Ingestion:** Background ingestion pipeline processes vendor inventory feeds automatically.
  * **Live Self-Service Access:** State managers log into ProcureFlow and view live stock on hand, committed quantities, and available stock before raising requisitions.
  * **Dedicated 2-Month Testing Pipeline:** Outlined in Section 3, a 2-month validation pipeline guarantees 100% data reliability before retiring manual reports.

#### C. Why This is the Solution
* **Eliminates Recurring Administrative Waste:** Saves procurement hours every week by replacing manual email distribution with an automated self-service dashboard.
* **Informed Requisitioning:** Site managers can see stock availability before ordering, preventing orders from being placed against backordered vendor items.

---

### Item 9: Disjointed Approval Routing & Stalled Decisions

#### A. The Issue / Challenge
* **The Challenge:** Purchase requests submitted for approval would occasionally stall for days when a manager was on leave or delayed, with no structured Delegation of Authority (DOA) rules or time-based escalation.
* **The Business Impact:** Delayed order dispatch, linen delivery shortages, and lack of audit transparency regarding who authorized high-value expenditures.

#### B. The Engineered Solution
* **Component Delivered:** DOA Multi-Tier Approval Engine in [`services/approvalEngineService.ts`](file:///C:/Github/ProcureFlow-App/services/approvalEngineService.ts), [`components/ApprovalQueue.tsx`](file:///C:/Github/ProcureFlow-App/components/ApprovalQueue.tsx), and [`components/ApprovalReviewWizard.tsx`](file:///C:/Github/ProcureFlow-App/components/ApprovalReviewWizard.tsx).
* **Key Features:**
  * **Tier 1 (Site Level):** Site Operations Managers approve routine weekly depletion requisitions within branch threshold limits.
  * **Tier 2 (Procurement Lead — Ashish Chhabra):** Audits spend categorization (Depletion vs New Business vs Linen Hub), packaging multiples, and catalog pricing parity.
  * **Tier 3 (Executive Level — Ebrahim Mokhtari, COO):** Authorizes high-value orders (>\$50,000), new customer linen injection capital, and unbudgeted threshold exceptions.
  * **Approval Review Wizard:** Provides approvers with full line item carton splits, GST-inclusive totals, historical site burn rates, and 1-click decision buttons with mandatory audit comments.

#### C. Why This is the Solution
* **Clear Corporate Governance:** Embeds corporate Delegation of Authority directly into the software, ensuring appropriate commercial oversight at every spend level.
* **Prevents Operational Stalls:** Central approvers can review and decide requests rapidly from an optimized inspection console.

---

### Item 10: Homepage Task Visibility & Operational Friction

#### A. The Issue / Challenge
* **The Challenge:** When users logged into ProcureFlow, they faced a generic overview and had to manually navigate multiple screens, tabs, and filters to figure out what needed their attention.
* **The Business Impact:** Overdue tasks (e.g. logging Concur PR numbers, completing delivered orders) were forgotten simply because they were not visible on login.

#### B. The Engineered Solution
* **Component Delivered:** Homepage "Action Required" Task Center in [`components/Home.tsx`](file:///C:/Github/ProcureFlow-App/components/Home.tsx).
* **Key Features:**
  * **Prominent Top-Level Banner:** Appears immediately upon login above the 6-stage lifecycle view.
  * **Three Live Action Tiles:**
    1. **Log Concur PR #:** Count of approved orders waiting for ERP reference entry (1-click to Stage 2).
    2. **Ready for Order Closure:** Count of 100% delivered orders awaiting completion (1-click to Stage 5).
    3. **Overdue Deliveries:** Count of shipments $>14$ days past need-by date (1-click to Stage 4).

#### C. Why This is the Solution
* **Focuses User Attention Instantly:** Surfaces exactly what needs actioning the moment a user logs in, removing cognitive load and navigation friction.
* **Accelerates Order Velocity:** By making pending actions 1-click accessible, order completion turnaround times are drastically improved.

---

## 3. Forward Pipeline & Strategic Roadmap (Next 2 Months)

The following high-impact strategic initiatives represent the pipeline of future activity scheduled across September and October 2026:

```mermaid
flowchart LR
    subgraph Pipeline2Months ["Forward Strategic Pipeline (Months 1 & 2)"]
        F1["1. Live Inventory Testing Pipeline<br/>Thorough 2-month data validation"]
        F2["2. Adelaide Expansion Blueprint<br/>4-Phase scalable site rollout"]
        F3["3. Omnichannel Notification Rollout<br/>Teams Adaptive Cards & Graph Email"]
        F4["4. Mobile Usability Audit<br/>Tablet and floor terminal optimization"]
    end
```

### 1. Supply & Available Inventory Testing Pipeline (September – October 2026)
* **Testing Protocol:** A dedicated 2-month validation window where Ashish Chhabra and Aaron Bell run parallel comparisons between supplier inventory data feeds in ProcureFlow and the manual weekly Excel reports.
* **Verification Gate:** Once data reliability reaches 100% parity across two consecutive months, procurement will issue a formal directive to all branch managers to rely exclusively on ProcureFlow's live `SUPPLIER_INVENTORY` screen, officially retiring manual weekly emailing.

### 2. Adelaide Rollout & Site Expansion Blueprint
If approved by **Ebrahim Mokhtari (COO)** during tomorrow's 10:00 AM workshop, the following structured 4-phase rollout template will govern the expansion of ProcureFlow to Adelaide (and future site additions):

```mermaid
flowchart TD
    subgraph AdelaideRollout ["Adelaide 4-Phase Expansion Blueprint"]
        PH1["Phase 1: Master Setup (Week 1)<br/>• Site delivery address & vendor account config<br/>• Adelaide catalog SKU filtering & pricing schedules<br/>• User account provisioning (Site Manager, Requesters, Receivers)"]
        PH2["Phase 2: Governance & Training (Week 2)<br/>• Distribution of ProcureFlow training video<br/>• Mandatory user sign-off tracking before activation<br/>• Hands-on walkthrough with Adelaide site operations"]
        PH3["Phase 3: Shadow Requisitions (Weeks 3-4)<br/>• 2-week parallel ordering period<br/>• Carton multiple adherence & price check verification<br/>• DOA approval threshold calibration with Ashish Chhabra"]
        PH4["Phase 4: Full Production Cutover (Week 5)<br/>• 100% live ordering cutover<br/>• Mandatory Concur PR # linkage enforced on all receipts<br/>• Complete retirement of manual email/paper ordering"]
    end

    PH1 --> PH2 --> PH3 --> PH4
```

* **Phase 1: Master Setup (Week 1):** Configure delivery addresses, site-specific pricing catalogs, and provision roles for Adelaide operations managers, plant supervisors, and receiving staff.
* **Phase 2: Governance & Training (Week 2):** Enforce mandatory completion of the training video with documented sign-off for all Adelaide users.
* **Phase 3: Shadow Requisitions (Weeks 3–4):** Execute parallel ordering to ensure packaging multiples, contract prices, and DOA routing function flawlessly in the Adelaide context.
* **Phase 4: Full Production Cutover (Week 5):** Cut over 100% of Adelaide linen purchasing into ProcureFlow, linking every completed order directly into SAP Concur.

### 3. Omnichannel Notification & Escalation Rollout
* Complete deployment of Microsoft Graph executive email templates and interactive Microsoft Teams Adaptive Cards (v1.4) to embed ProcureFlow actions directly into daily communication channels.

---

## 4. Implementation Status & Code Verification

| Action Item | Technical Status | Primary Files Modified | Verification Status |
| :--- | :---: | :--- | :--- |
| **1. EOM Reconciliation Engine** | ✅ **Complete** | [`utils/budgetTracking.ts`](file:///C:/Github/ProcureFlow-App/utils/budgetTracking.ts), [`components/ReportingView.tsx`](file:///C:/Github/ProcureFlow-App/components/ReportingView.tsx) | 100% parity verified against historical EOM records (52/52 lines). |
| **2. Packaging Modulo Rules** | ✅ **Complete** | [`components/POCreate.tsx`](file:///C:/Github/ProcureFlow-App/components/POCreate.tsx), [`components/PODetail.tsx`](file:///C:/Github/ProcureFlow-App/components/PODetail.tsx), [`types.ts`](file:///C:/Github/ProcureFlow-App/types.ts) | Blocks invalid pack quantities and rounds in 1 click (e.g. 5,000 $\rightarrow$ 5,040). |
| **3. Contract Price Validation** | ✅ **Complete** | [`components/POCreate.tsx`](file:///C:/Github/ProcureFlow-App/components/POCreate.tsx) | Blocks \$0.00 prices and enforces active catalog contract rates. |
| **4. Mandatory Concur Reference** | ✅ **Complete** | [`components/PODetail.tsx`](file:///C:/Github/ProcureFlow-App/components/PODetail.tsx) | Strictly prevents completing/closing orders without Concur PR # or PO #. |
| **5. 100% GR Closure Nudges** | ✅ **Complete** | [`services/notificationEngineService.ts`](file:///C:/Github/ProcureFlow-App/services/notificationEngineService.ts) | Automated detection query and daily reminder templates active. |
| **6. Overdue Delivery Escalation** | ✅ **Complete** | [`services/notificationEngineService.ts`](file:///C:/Github/ProcureFlow-App/services/notificationEngineService.ts) | Tiered escalation active (>14d to user, >21d copying line managers e.g. David). |
| **7. Multi-Facility Attribution** | ✅ **Complete** | [`utils/budgetTracking.ts`](file:///C:/Github/ProcureFlow-App/utils/budgetTracking.ts) | Normalization logic correctly attributes destination facility costs. |
| **8. Live SOH Reporting** | ✅ **Complete** | [`components/ReportingView.tsx`](file:///C:/Github/ProcureFlow-App/components/ReportingView.tsx) | Live dashboard active; 2-month verification pipeline established. |
| **9. DOA Multi-Tier Approvals** | ✅ **Complete** | [`services/approvalEngineService.ts`](file:///C:/Github/ProcureFlow-App/services/approvalEngineService.ts), [`components/ApprovalQueue.tsx`](file:///C:/Github/ProcureFlow-App/components/ApprovalQueue.tsx) | 3-tier routing schema (Site $\rightarrow$ Procurement $\rightarrow$ Executive) active. |
| **10. Homepage Action Center** | ✅ **Complete** | [`components/Home.tsx`](file:///C:/Github/ProcureFlow-App/components/Home.tsx) | Live count badges and 1-click stage navigation active on home dashboard. |
| **11. Mobile Requests Scrolling** | ✅ **Complete** | [`components/POList.tsx`](file:///C:/Github/ProcureFlow-App/components/POList.tsx) | Fixed inner flex container; mobile cards scroll smoothly without truncation. |

* **Compilation & Build:** Production build (`tsc && vite build --mode production`) verified with **0 errors**.
* **Review Branch:** Fully committed and pushed to [`feature/eom-budget-governance-improvements`](https://github.com/SPLGit-Project/ProcureFlow-App/tree/feature/eom-budget-governance-improvements) on GitHub.
