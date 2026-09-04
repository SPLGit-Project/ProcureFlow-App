# ProcureFlow Strategic Transformation & Developmental Action Plan (v4.0)

**Document Classification:** Executive Strategy & Operational Governance Roadmap  
**Framework Model:** Previous State $\rightarrow$ Current State (Wins, Challenges, Opportunities) $\rightarrow$ Future Developed State (BAU Integration & Execution)  
**Branch:** [`feature/eom-budget-governance-improvements`](https://github.com/SPLGit-Project/ProcureFlow-App/tree/feature/eom-budget-governance-improvements)  
**Presentation Deck:** [`docs/ProcureFlow_Executive_Roadmap.pptx`](file:///C:/Github/ProcureFlow-App/docs/ProcureFlow_Executive_Roadmap.pptx)  
**Target Cutover:** Production Release following Thursday Workshop  
**Key Governance Committee:**
* **Ebrahim Mokhtari** — *Chief Operating Officer (COO)*
* **Ashish Chhabra** — *Procurement Lead & System Super User*
* **Aaron Bell** — *Tech Lead & ProcureFlow Developer*

---

## Strategic Transformation Executive Model

```mermaid
flowchart LR
    subgraph Act1 ["ACT 1: PREVIOUS STATE<br/>The Foundation"]
        A1["Digitized Requisitions"]
        A2["Multi-Site Catalog Ordering"]
        A3["Basic Goods Receipt (GR)"]
        A4["Initial Financial Categorisation"]
    end

    subgraph Act2 ["ACT 2: CURRENT STATE<br/>Wins, Challenges & Opportunities"]
        B1["WINS: 100% Item Mapping & National Scale"]
        B2["CHALLENGES: Manual EOM Crunching, Pack Typos, Missing Concur Links"]
        B3["OPPORTUNITY: Shift from Passive Record to Active Closed-Loop Platform"]
    end

    subgraph Act3 ["ACT 3: FUTURE / DEVELOPED STATE<br/>Seamless BAU Integration"]
        C1["Zero-Defect Point-of-Entry Governance"]
        C2["Closed-Loop ERP Parity with SAP Concur"]
        C3["Automated Multi-Channel Nudges & Escalation"]
        C4["Executive 2D EOM Reconciliation & FY27 Budget ($14.521M)"]
        C5["Self-Service Live Stock on Hand (SOH)"]
    end

    Act1 --> Act2 --> Act3
```

---

## Act 1: Previous State — What ProcureFlow Provided the Business

Before ProcureFlow, South Pacific Laundry managed national linen ordering through disparate emails, phone calls, and manual spreadsheets. ProcureFlow established the core operational baseline:

1. **Digitized Online Requisitioning:** Replaced fragmented paper and email ordering with a centralized web portal across all laundry sites.
2. **Multi-Site Catalog Routing:** Enabled branch-specific catalog browsing, local delivery address routing, and local manager authorization (Melbourne, Sydney, Brisbane, Perth, Adelaide, Cairns, Mackay, Albury).
3. **Goods Receipt (GR) Tracking:** Established digital delivery logging on site, capturing dockets, delivered quantities, and partial delivery histories.
4. **Basic Financial Categorisation:** Introduced initial taxonomy to distinguish Depletion from New Customer injections.

---

## Act 2: Current State — Wins, Challenges & Strategic Opportunities

### 1. Key Operational Wins Achieved
* **100% Supply Item Code Mapping Milestone:** Completed the full mapping of all SPL internal item codes against supplier vendor codes (Simba, Host, etc.), eliminating naming confusion across branches.
* **National Requisitioning Scale:** Active daily purchasing across all 8 operating entities with standardized audit trails.
* **Supplier Data Feeds:** Built ingestion pipelines for supplier stock-on-hand (SOH) files.

### 2. Current Challenges & Operational Friction Points
* **Manual EOM Excel Crunching:** Ashish Chhabra (Super User) spends days each month extracting Concur reports, stripping GST (`/ 1.1`), manually parsing unstandardized descriptions, and building pivot tables for executive leadership.
* **Unrounded Requisition Quantities:** Site staff order arbitrary quantities (e.g. 5,000 units on a 240 carton size, or 90 units on a 100 pack), causing supplier rejections and manual rework.
* **Contract Pricing Typos:** Keying errors (e.g. 61¢ instead of contracted 51¢ for face washers) cause 3-way matching failures in finance and delayed payments.
* **Missing Concur ERP Linkage:** Orders receipted in ProcureFlow without entering the Concur Request PR #, breaking 1-to-1 data mirroring.
* **Lingering Open Orders:** POs 100% received physically but left open in ProcureFlow.
* **Overdue Shipments:** Deliveries $>14$ days past need-by date sitting unnoticed without line manager visibility.

### 3. The Strategic Opportunity
* **Shift from Passive to Active Governance:** Transform ProcureFlow from a passive recording tool into an intelligent, closed-loop platform with automated guardrails that prevent human error before an order is submitted.
* **Single Source of Truth:** Establish ProcureFlow as the authoritative single source of truth that permanently matches SAP Concur.

---

## Act 3: Future / Target Developed State — Frictionless BAU Integration

### 1. The Vision of BAU Integration & User Engagement
* **For Requesters & Site Staff:** Requisitioning is effortless and error-proof. Packaging multiples are automatically enforced with 1-click rounding, contracted prices auto-populate, and an **"Action Required"** center surfaces open tasks upon login.
* **For Procurement (Ashish Chhabra):** Zero rework from supplier rejections; zero manual EOM Excel building; self-service SOH removes manual weekly emailing.
* **For Executive Leadership (Ebrahim Mokhtari, COO):** Complete commercial control with live FY27 budget burn rates (\$14.521M), real-time \$2.3M Linen Hub tracking, and 100% financial alignment with SAP Concur.

---

### 2. Core Development Pillars Delivered to Achieve the Vision

```mermaid
flowchart TD
    subgraph P1 ["Pillar A: Point-of-Entry Governance"]
        PA1["Carton/Pack Size Multiple Check live in POCreate & PODetail"]
        PA2["1-Click Smart Rounding: e.g. 5,000 -> 5,040 units (21 cartons)"]
        PA3["Contract Price Master Check & $0.00 block"]
    end

    subgraph P2 ["Pillar B: Closed-Loop ERP Parity"]
        PB1["Mandatory Concur PR # block before order completion"]
        PB2["Homepage 'Action Required' task center on login"]
    end

    subgraph P3 ["Pillar C: Automated Notifications & Escalations"]
        PC1["100% Goods Receipt daily closure reminders"]
        PC2[">14d Overdue Delivery Escalation to Line Managers"]
        PC3["In-App Drawer, Microsoft Graph Email, MS Teams Adaptive Cards"]
    end

    subgraph P4 ["Pillar D: Executive Financial Intelligence"]
        PD1["Native 2D Pivot Table: Branch x Sector x Reason (excl. GST)"]
        PD2["FY27 Budget Tracking Grid ($14.521M Operating Base)"]
        PD3["Dedicated Linen Hub $2.30M Decrement Pool Tracker"]
        PD4["1-Click Concur EOM Excel CSV Export"]
    end

    subgraph P5 ["Pillar E: Self-Service Live SOH"]
        PE1["Automated live SOH reporting in SUPPLIER_INVENTORY"]
        PE2["Deprecates manual weekly Excel emailing by procurement"]
    end

    P1 & P2 & P3 & P4 & P5 --> Destination["Frictionless BAU Integration"]
```

---

## 4. Thursday Executive Workshop Agenda & Presentation Flow

**Date & Time:** Thursday 12:00 PM – 2:00 PM  
**Presenters:** Aaron Bell & Ashish Chhabra  
**Executive Reviewer & Sign-Off:** Ebrahim Mokhtari (COO)

| Agenda Part | Time Window | Focus Area & Live Demonstration | Session Leads |
| :--- | :--- | :--- | :--- |
| **Part 1: Point-of-Entry Governance** | 12:00 – 12:30 PM | • Live demo of `POCreate`: Carton multiple rounding & price checks <br/>• Presentation of 100% Item Code Mapping Milestone | Aaron Bell & Ashish Chhabra |
| **Part 2: DOA Approvals & Escalation** | 12:30 – 1:00 PM | • DOA approval tiers & Approval Review Wizard demo <br/>• 100% receipt closure nudges & >14d overdue manager escalation <br/>• Mandatory Concur PR # rule on completion | Ashish Chhabra & Aaron Bell |
| **Part 3: Executive EOM Reconciliation** | 1:00 – 1:30 PM | • Live 2D Pivot Table (Branch $\times$ Sector $\times$ Reason) <br/>• FY27 Budget vs Actuals grid & Linen Hub \$2.3M tracker <br/>• 1-Click Concur EOM Excel CSV export | Ashish Chhabra & Aaron Bell |
| **Part 4: SOH & Production Sign-Off** | 1:30 – 2:00 PM | • Automated SOH live reporting <br/>• Synthesis of stakeholder feedback <br/>• **Formal production cutover sign-off by Ebrahim Mokhtari (COO)** | Ebrahim Mokhtari (COO) |

---

## 5. Stakeholder Review Checklist Ahead of Workshop

* [ ] **Ashish Chhabra (Procurement Lead / Super User):**
  * Reconcile August & September 2026 EOM Pivot numbers in ProcureFlow against `Purchase Request EOM SEP-26.xls`.
  * Export the system SOH report and verify line-by-line parity with the manual weekly report.
  * Test carton multiple rounding in `POCreate`.
* [ ] **Aaron Bell (Tech Lead / Developer):**
  * Verify staging environment on `feature/eom-budget-governance-improvements`.
  * Prepare live demonstration walk-through and test datasets.
* [ ] **Ebrahim Mokhtari (COO):**
  * Review national FY27 budget burn rates (\$14.521M), commercial governance rules, and grant formal production sign-off.
