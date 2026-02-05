-- Clear all Purchase Request related data AND Migration Mappings AND Notifications
-- Safe version: Checks if tables exist before attempting to TRUNCATE.

DO $$
BEGIN
    -- 1. Clear Deliveries (Cascades to lines)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deliveries') THEN
        TRUNCATE TABLE deliveries CASCADE;
        RAISE NOTICE 'Cleared deliveries';
    END IF;

    -- 2. Clear PO Requests (Cascades to lines and approvals)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'po_requests') THEN
        TRUNCATE TABLE po_requests CASCADE;
        RAISE NOTICE 'Cleared po_requests';
    END IF;

    -- 3. Clear Migration Mappings
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'migration_mappings') THEN
        TRUNCATE TABLE migration_mappings CASCADE;
        RAISE NOTICE 'Cleared migration_mappings';
    ELSE
        RAISE NOTICE 'Table migration_mappings does not exist, skipping...';
    END IF;

    -- 4. Clear User Notifications
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_notifications') THEN
        TRUNCATE TABLE user_notifications CASCADE;
        RAISE NOTICE 'Cleared user_notifications';
    ELSE
        RAISE NOTICE 'Table user_notifications does not exist, skipping...';
    END IF;
    
END $$;

-- Verify results (Only queries tables if they exist to avoid errors in the generic SELECT)
-- Note: Simple SELECTs might still fail if tables don't exist in the query planner.
-- So we print the counts via the block above or you can verify manually.
