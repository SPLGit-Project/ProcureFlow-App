-- Migration: Add view_reports permission to ADMIN and beta_tester roles
UPDATE roles
SET permissions = array_append(permissions, 'view_reports')
WHERE id IN ('ADMIN', 'beta_tester')
  AND NOT (permissions @> ARRAY['view_reports']);
