-- ==============================================================================
-- ProcureFlow Database Remediation Script
-- Purpose: Reallocate Linen Hub orders incorrectly assigned to SPL Melbourne
--          to SPL Holdings (5d0c236b-4311-4bbe-894e-d7a2621ed559).
-- Date: 2026-09-03
-- Author: Antigravity / Aaron Bell
-- Target: ProcureFlow_PROD (yasosgkznoxamysutxfc)
-- ==============================================================================

-- 1. Verify target SPL Holdings site exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sites WHERE id = '5d0c236b-4311-4bbe-894e-d7a2621ed559') THEN
        RAISE EXCEPTION 'SPL Holdings site ID 5d0c236b-4311-4bbe-894e-d7a2621ed559 does not exist.';
    END IF;
END $$;

-- 2. Execute atomic site reallocation
UPDATE po_requests
SET site_id = '5d0c236b-4311-4bbe-894e-d7a2621ed559' -- SPL Holdings
WHERE id IN (
  'b9cf8f2e-ae46-4bd4-8c4c-53f2e8084586', -- POR-202608-000045 ($313,490.14 - Branded Linen Hub Project)
  'e0419642-6f1a-4cd5-8ff0-bd197ecc90bc', -- POR-202608-000056 ($300.00 - Branded Linen Hub Project)
  '7f5551cd-7c11-492c-b869-86df7e946fc0', -- POR-202608-000057 ($4,200.00 - Branded Linen Hub Project)
  'd19fe494-e23c-4099-90ed-61205f0eb1b2'  -- POR-202609-000029 ($3,700.00 - Linen Hub - CHIPS)
)
RETURNING id, display_id, site_id, customer_name, total_amount;

-- 3. Verification query
SELECT r.display_id, r.request_date, r.customer_name, r.total_amount, s.name AS site_name
FROM po_requests r
JOIN sites s ON r.site_id = s.id
WHERE r.id IN (
  'b9cf8f2e-ae46-4bd4-8c4c-53f2e8084586',
  'e0419642-6f1a-4cd5-8ff0-bd197ecc90bc',
  '7f5551cd-7c11-492c-b869-86df7e946fc0',
  'd19fe494-e23c-4099-90ed-61205f0eb1b2'
);
