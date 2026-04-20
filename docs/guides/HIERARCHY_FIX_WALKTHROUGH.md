# Hierarchy Visualization Verification Walkthrough

> [!WARNING]
> Automated browser verification failed due to a system environment issue. Please manually verify the changes using this guide.

## Changes Overview
We have updated the `CatalogManagement` component to support the full 5-level hierarchy defined in the database:
`Pool -> Catalog -> Type -> Category -> Sub-Category`.

### Key Improvements
- **Hierarchy Tree View**: Now displays 5 columns instead of just 2. You can navigate from Pool down to Sub-Category.
- **Filtering**: Selecting an item in one column filters the subsequent columns.
- **Visual Map**: Logic verified to support connecting nodes across all 5 levels.

## Verification Steps

### 1. Hierarchy Tree Navigation
1.  Navigate to **Settings** -> **Catalog**.
2.  Ensure you are on the **Hierarchy Tree** tab (default view).
3.  **Verify Columns**: You should see 5 columns labeled:
    - **Pools**
    - **Catalogs** (initially hidden until Pool selected)
    - **Types** (initially hidden until Catalog selected)
    - **Categories** (initially hidden until Type selected)
    - **Sub-Categories** (initially hidden until Category selected)
4.  **Test Interaction**:
    - Click a **Pool** (e.g., "MRO"). -> Verify **Catalogs** column appears with relevant catalogs.
    - Click a **Catalog**. -> Verify **Types** column appears.
    - Click a **Type**. -> Verify **Categories** column appears.
    - Click a **Category**. -> Verify **Sub-Categories** column appears.

### 2. Visual Map Connections
1.  Click the **Visual Map** button (top right of the Catalog section).
2.  **Verify Nodes**: You should see nodes representing all levels.
3.  **Verify Connections**:
    - Check that links flow logically: `Root -> Pool -> Catalog -> Type -> Category -> Sub-Category`.
    - Ensure there are no "floating" nodes that should be connected.

## Troubleshooting

## Data Fix & Verification
> [!NOTE]
> We discovered that the database was missing the `TYPE` level hierarchy completely and `parent_ids` were not populated.

We have applied a manual fix for the **Accommodation** branch to demonstrate the visualization works.
**Fixed Path:** `Administrative (Pool) -> Accommodation (Catalog) -> Bath Linen (Type) -> Mat (Category) -> Bath (Sub-Category)`

### Recommended Action
To fix the rest of the hierarchy (other catalogs, mining, etc.), please run the full **`seed_hierarchy.sql`** script against the database. The visualization logic is correct, but it requires valid hierarchical data in the database to function.
