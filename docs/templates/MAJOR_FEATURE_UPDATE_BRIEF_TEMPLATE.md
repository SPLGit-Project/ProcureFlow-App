# 📋 ProcureFlow Standard: Major Feature Update Brief Template

> **Standard Version:** 1.0  
> **Custodian:** Enterprise Data and Automation Team (Aaron Bell)  
> **Intended Use:** Standard communication and documentation asset for all future major ProcureFlow feature releases, workflow enhancements, and platform upgrades.

---

## 1. Design & Communication Standards

Every Major Feature Release Brief must adhere to the following principles:

1. **Dual Format Delivery:**
   - **Markdown / Email / Teams Announcement:** Plain-text formatted for direct copy-paste into emails or Microsoft Teams channels.
   - **Executive Word Document (`.docx`):** Cleanly formatted with official `public/Procureflow_Logo.png`, metadata blocks, color-coded urgency tables, high-resolution figures, and contact cards.
2. **Visual-First Requirement:**
   - Text alone is not sufficient. Every brief **must** include high-resolution visuals wherever practical:
     - **Workflow Diagram:** End-to-end lifecycle / decision tree.
     - **In-App Component Mockup:** Real-life badges, flyouts, and pill indicators.
     - **Calculation / Logic Visual:** Waterfall, balance, or formula explanation.
     - **Reporting & Insights Preview:** Dashboard KPIs, tables, and audit logs.
3. **Dedicated Two-Tier Contacts:**
   - Always differentiate between **Operational / Business Ownership** (Procurement & Inventory) and **Technical / Automation Ownership** (ProcureFlow Development).

---

## 2. Standard Markdown Copy-Paste Template

*(Use the markdown below for all future feature release announcements)*

```markdown
# 📢 ProcureFlow Feature Update: [Feature Title / Theme]

**Effective Date:** [Date, e.g. 24 September 2026]  
**Audience:** [Target Audience, e.g. Requisitioners, Approvers, Procurement Officers]  
**System Module:** [Module Name, e.g. Stock & Requisitions / Approvals / Deliveries]  

---

### Executive Overview: [Brief Impact Statement]
[2-3 sentences explaining what problem was solved, why this change was made, and the core benefit to the business.]

---

### Visual Workflow Overview
*(See attached visual diagram in document: `[Feature_Workflow_Diagram.png]`)*

1. **[Step 1 - Trigger / Input]:** [Description]
2. **[Step 2 - System Automation / Holding State]:** [Description]
3. **[Step 3A - Successful Completion]:** [Description]
4. **[Step 3B - Exception / Auto-Action / Fallback]:** [Description]

---

### Key Enhancements & How They Work

1. **[Icon] [Core Enhancement 1 Title]**
   - [Bullet details on mechanism]
   - [Formula or data source explanation]

2. **[Icon] [Core Enhancement 2 Title]**
   - [Holding state, automation rules, or time limits]

3. **[Icon] [Live UI Indicators / Badges]**
   - [Urgency levels or status colors]
     - 🟢 **[Normal / Tier 1]:** [Definition & threshold]
     - 🟠 **[Warning / Tier 2]:** [Definition & threshold]
     - 🔴 **[Critical / Tier 3]:** [Definition & threshold]

4. **[Icon] [Transition / Completion Stage]**
   - [What happens when action is taken]

5. **[Icon] [Automated Background Rules / Expiry]**
   - [Details of automated cron jobs or system validations]

---

### New Reporting & Analytics Insights
Located under **Reporting ➔ [Category] ➔ [Report Name]**:
- **Executive KPI Cards:** [List metrics tracked]
- **Interactive Visual Breakdown:** [Chart / comparative visual details]
- **Live Action Queue:** [Filterable operational queue details]
- **Audit Log & History:** [Log and compliance tracking details]
- **CSV Data Export:** [Full dataset export capabilities]

---

### What This Means for You: Role-by-Role Guidance

| Role | Key Benefits | Action Items & Best Practices |
| :--- | :--- | :--- |
| **Requisitioners** *(Site / Plant)* | • [Benefit 1]<br>• [Benefit 2] | • [Action 1]<br>• [Action 2] |
| **Procurement Officers** *(Buyers)* | • [Benefit 1]<br>• [Benefit 2] | • [Action 1]<br>• [Action 2] |
| **Approvers & Plant Managers** | • [Benefit 1]<br>• [Benefit 2] | • [Action 1]<br>• [Action 2] |

---

### Frequently Asked Questions (FAQ)

- **Q: [Common user question 1]?**  
  *A:* [Clear, definitive answer].

- **Q: [Common user question 2]?**  
  *A:* [Clear, definitive answer].

- **Q: [Common user question 3]?**  
  *A:* [Clear, definitive answer].

---

### Questions & Key Contacts

| Area / Scope | Contact Lead | Details |
| :--- | :--- | :--- |
| **Procurement & Inventory Inquiries**<br>*(Supplier stock availability, inventory quotas, PO approval escalation, Concur PO processing)* | **Ashish Chhabra**<br>Procurement & Inventory Manager | ✉️ [ashish.chhabra@splservices.com.au](mailto:ashish.chhabra@splservices.com.au) |
| **ProcureFlow Development & Automation**<br>*(Platform features, reservation engine logic, reporting tools, system workflows)* | **Aaron Bell**<br>Enterprise Data and Automation Manager | ✉️ [aaron.bell@splservices.com.au](mailto:aaron.bell@splservices.com.au) |

*You can also submit instant feedback or log support tickets directly within ProcureFlow using the **Help & Guide** drawer on any screen.*
```

---

## 3. Automation Scripts Reference

The automated pipeline for generating this release brief comprises two scripts:

1. **`scripts/generate_brief_visuals.ts`**:
   - Uses Playwright to render pixel-perfect Tailwind CSS visual cards and diagrams at `2x` deviceScaleFactor.
   - Outputs PNG assets directly to `docs/brief_assets/`.
2. **`scripts/generate_docx_brief.py`**:
   - Uses `python-docx` to construct an executive Word document.
   - Embeds `public/Procureflow_Logo.png` and all high-resolution figures with figure captions.
   - Applies table borders, zebra striping, and cell margins according to ProcureFlow brand guidelines.
