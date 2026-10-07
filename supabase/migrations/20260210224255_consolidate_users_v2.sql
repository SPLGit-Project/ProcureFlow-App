-- User Consolidation and Normalization Script V2
-- 1. Create a function to merge users
CREATE OR REPLACE FUNCTION merge_users(surviving_id UUID, duplicate_id UUID) 
RETURNS VOID AS $$
BEGIN
    -- Update references in po_requests
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'po_requests') THEN
        UPDATE public.po_requests SET requester_id = surviving_id WHERE requester_id = duplicate_id;
    END IF;
    
    -- Update references in po_approvals
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'po_approvals') THEN
        UPDATE public.po_approvals SET approver_id = surviving_id WHERE approver_id = duplicate_id;
    END IF;
    
    -- Update references in user_notifications (if it exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_notifications') THEN
        EXECUTE 'UPDATE public.user_notifications SET user_id = $1 WHERE user_id = $2' USING surviving_id, duplicate_id;
    END IF;

    -- Update references in system_audit_logs (if it exists)
    -- Note: schema says it references auth.users, but good to check
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_audit_logs' AND column_name = 'performed_by') THEN
        UPDATE public.system_audit_logs SET performed_by = surviving_id WHERE performed_by = duplicate_id;
    END IF;
    
    -- Delete the duplicate user
    DELETE FROM public.users WHERE id = duplicate_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Consolidate duplicates
DO $$
DECLARE
    rec RECORD;
    surviving_id UUID;
    duplicate_id UUID;
BEGIN
    -- Find groups of duplicate emails (case-insensitive)
    FOR rec IN 
        SELECT LOWER(email) as lower_email, COUNT(*) 
        FROM public.users 
        GROUP BY LOWER(email) 
        HAVING COUNT(*) > 1
    LOOP
        -- Choose a survivor: Prefer status 'APPROVED', then earliest creation
        SELECT id INTO surviving_id 
        FROM public.users 
        WHERE LOWER(email) = rec.lower_email
        ORDER BY 
            (CASE WHEN status = 'APPROVED' THEN 0 ELSE 1 END),
            created_at ASC
        LIMIT 1;
        
        -- Merge all others into the survivor
        FOR duplicate_id IN 
            SELECT id FROM public.users 
            WHERE LOWER(email) = rec.lower_email AND id != surviving_id
        LOOP
            PERFORM merge_users(surviving_id, duplicate_id);
        END LOOP;
    END LOOP;
END $$;

-- 3. Normalize all remaining emails to lowercase
UPDATE public.users SET email = LOWER(email);

-- 4. Clean up the helper function
DROP FUNCTION merge_users(UUID, UUID);

-- 5. Add a constraint to prevent future duplicates (case-insensitive)
-- First drop existing unique constraint if any
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_unique;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

-- Add case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS users_email_case_insensitive_idx ON public.users (LOWER(email));

-- 6. Optional: Add a trigger to enforce lowercase emails on insert/update
CREATE OR REPLACE FUNCTION lowercase_email_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email = LOWER(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lowercase_email_trigger ON public.users;
CREATE TRIGGER lowercase_email_trigger
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION lowercase_email_trigger_fn();
;
