-- Migration: 20261104010000_assign_mack_albury_and_teegan_reporting.sql
-- Description: Assign Matt (Matthew Mancuso) as approval manager for SPL Albury alongside Melbourne,
--              with escalation to COO Ebrahim Mokhtari (Eb / Ed) across Melbourne, Albury, and Mackay.

BEGIN;

-- 1. Update Matthew Mancuso's user record in public.users to include Albury site ID in site_ids
UPDATE public.users
SET 
  site_ids = CASE 
    WHEN NOT ('99999999-9999-4999-8999-999999999999' = ANY(COALESCE(site_ids, ARRAY[]::text[]))) 
    THEN array_append(COALESCE(site_ids, ARRAY[]::text[]), '99999999-9999-4999-8999-999999999999')
    ELSE site_ids
  END,
  preferences = CASE
    WHEN preferences IS NOT NULL AND preferences ? 'activeSiteIds' THEN
      jsonb_set(
        preferences,
        '{activeSiteIds}',
        CASE 
          WHEN NOT (preferences->'activeSiteIds' @> '["99999999-9999-4999-8999-999999999999"]'::jsonb)
          THEN (preferences->'activeSiteIds') || '["99999999-9999-4999-8999-999999999999"]'::jsonb
          ELSE preferences->'activeSiteIds'
        END
      )
    ELSE preferences
  END
WHERE id = '460a44d0-5237-4e59-aad3-93619d6d50cd';

-- 2. Update SPL Albury workflow configuration in public.site_approval_workflows
UPDATE public.site_approval_workflows
SET
  approval_manager_id = '460a44d0-5237-4e59-aad3-93619d6d50cd',
  approval_manager_name = 'Matthew Mancuso',
  approval_manager_email = 'matthew.mancuso@splservices.com.au',
  approval_manager_entra_id = '460a44d0-5237-4e59-aad3-93619d6d50cd',
  escalation_manager_id = '9e97d720-3bf0-4451-b739-9fd87d27686c',
  escalation_manager_name = 'Ebrahim Mokhtari',
  escalation_manager_email = 'ebrahim.mokhtari@splservices.com.au',
  escalation_manager_entra_id = '9e97d720-3bf0-4451-b739-9fd87d27686c',
  escalation_mode = 'AUTO',
  escalation_sla_hours = 72,
  sla_status = 'ACTIVE_AUTO',
  is_active = true,
  notes = 'Albury workflow configured with Matt Mancuso & COO Eb.',
  updated_at = timezone('utc'::text, now()),
  updated_by = 'Aaron Bell'
WHERE site_id = '99999999-9999-4999-8999-999999999999';

COMMIT;
