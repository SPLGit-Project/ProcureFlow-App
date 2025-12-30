-- Add approver_type and approver_id columns to workflow_steps table
ALTER TABLE public.workflow_steps 
ADD COLUMN IF NOT EXISTS approver_type text DEFAULT 'ROLE',
ADD COLUMN IF NOT EXISTS approver_id text;

-- Migrate existing data: set approver_id to the generic 'approver_role' value and type to 'ROLE'
UPDATE public.workflow_steps 
SET approver_type = 'ROLE', approver_id = approver_role 
WHERE approver_id IS NULL AND approver_role IS NOT NULL;
