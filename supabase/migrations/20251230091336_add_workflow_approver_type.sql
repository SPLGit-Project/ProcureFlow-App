ALTER TABLE public.workflow_steps 
ADD COLUMN IF NOT EXISTS approver_type text DEFAULT 'ROLE',
ADD COLUMN IF NOT EXISTS approver_id text;

UPDATE public.workflow_steps 
SET approver_type = 'ROLE', approver_id = approver_role 
WHERE approver_id IS NULL AND approver_role IS NOT NULL;;
