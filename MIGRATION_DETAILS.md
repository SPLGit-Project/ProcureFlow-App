# Data Migration Process Documentation

This document provides an exhaustive and comprehensive overview of the data migration (Historical Data Import) process in ProcureFlow.

## 1. Overview
The data migration tool allows administrators to import historical Purchase Order (PO) data from Excel spreadsheets. It includes smart matching logic, mapping persistence, and automated capitalization record generation.

---

## 2. Technical Workflow

### Step 1: File Upload & initial Parsing
The process begins in `AdminMigration.tsx` using the `handleParse` function:
*   **Format:** Accepts `.xlsx` files via `react-dropzone`.
*   **Engine:** Uses `xlsx` (SheetJS) to convert sheets to JSON rows.
*   **Grouping:** Rows are grouped by **PO #**.
*   **Initial Validation:** Each row's **Product Code** (SKU) is checked against the system's `items` master list.

### Step 2: Smart SKU Matching
If a SKU is not found in the master list, the system employs several strategies to resolve it:
1.  **Global Migration Mappings:** Checks the `migration_mappings` table for previously manual resolves of the same input SKU.
2.  **Fuzzy Suggestions:** Uses a combination of:
    *   **Levenshtein Distance:** To find similar string patterns.
    *   **Token Matching:** Stripping common suffixes (e.g., RFID, Colour) and comparing core tokens.
    *   **Containment Boost:** Prioritizing SKUs that contain the target string (e.g., matching `PCC1` to `PCC1-RFID`).

### Step 3: Manual Mapping & "Memory"
When an administrator manually maps an unknown SKU to a system item:
*   **Update Count:** The system automatically updates **all occurrences** of that SKU in the current batch.
*   **Persistence:** The relationship is saved to the `migration_mappings` table (via `db.saveMigrationMapping`).
*   **Future Utility:** Any future imports containing that exact SKU will be auto-resolved, significantly reducing manual work over time.

### Step 4: Asset Capitalization
The migration tool specifically looks for the **'Capitalized Month'** column:
*   If present, it creates records in the `asset_capitalization` table.
*   Includes `cap_date`, `cap_comments`, and `asset_tag` (using the sheet's tag or generating one in the format `AST-[PO]-[SKU]`).

### Step 5: Commit & Record Creation
Once the "Commit" action is triggered, the system performs the following sequentially:
1.  **Placeholder Creation (Optional):** If "Allow Import with Errors" is checked, "UNMATCHED_[SKU]" items are created in the master list to ensure relational integrity.
2.  **PO Header:** Inserts into `po_requests`.
3.  **PO Lines:** Inserts into `po_lines`, linking to the resolved `item_id`.
4.  **Capitalization:** Inserts into `asset_capitalization` for relevant lines.

---

## 3. Spreadsheet Schema Requirements

| Column Header | Type | Description |
| :--- | :--- | :--- |
| `PO #` | String | Unique identifier for grouping lines into a single PO. |
| `Order Date` | Date | The date the request was originally made. |
| `Product Code` | String | The SKU used in the historical system. |
| `Product Description` | String | Description of the item. |
| `Order QTY` | Number | Quantity ordered. |
| `QTY Received` | Number | Quantity actually received. |
| `Unit Price` | Number | Cost per item. |
| `Total Order Price` | Number | Calculated line total. |
| `Order Status` | String | Used to default `QTY Received` if the specific column is missing. |
| `Capitalized Month` | Date | (Optional) Trigger for asset capitalization records. |
| `Asset Tag` | String | (Optional) Historical asset tag. |

---

## 4. Logical States & Defaults

*   **Status Deduction:**
    *   If `totalReceived >= totalOrdered`, the PO is marked as **COMPLETED**.
    *   Otherwise, it defaults to **PENDING_DELIVERY**.
*   **Requester:** Defaults to a system admin account (Aaron Bell).
*   **Site:** Defaults to the first available site in the configuration if not specified.
*   **Normalization:** All SKUs are normalized (lowercased/trimmed) before lookup to ensure robustness.

---

## 5. Limitations & Edge Cases

1.  **Duplicate PO Numbers:** If a PO number already exists in the system, the importer will append lines to the existing record rather than creating a duplicate header, provided the logic finds the ID.
2.  **Currency Parsing:** The system expects raw numbers in price columns; currency symbols may cause parsing failures depending on individual cell formatting.
3.  **Large Batches:** The browser-based parsing is efficient up to ~5000 rows. Extremely large files should be split to avoid UI hanging.
4.  **Deletion:** There is no "Bulk Delete Import" feature. Imports should be carefully previewed before committing to the database.
