-- User Consolidation and Normalization Script
-- 1. Create a function to merge users
CREATE OR REPLACE FUNCTION merge_users(surviving_id UUID, duplicate_id UUID) 
RETURNS VOID AS $$
BEGIN
    -- Update references in po_requests
    UPDATE public.po_requests SET requester_id = surviving_id WHERE requester_id = duplicate_id;
    
    -- Update references in po_approvals
    UPDATE public.po_approvals SET approver_id = surviving_id WHERE approver_id = duplicate_id;
    
    -- Update references in user_notifications
    -- (Check if table exists first if using generic script, but here we know it exists)
    UPDATE public.user_notifications SET user_id = surviving_id WHERE user_id = duplicate_id;
    
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
        -- Choose a survivor: Prefer status 'APPROVED', then most recent sign-in, then earliest creation
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

-- 5. Add a constraint to prevent future duplicates (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;

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
