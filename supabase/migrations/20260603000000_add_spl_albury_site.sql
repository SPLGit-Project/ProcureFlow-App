-- Add SPL Albury as a new site.
-- The BundleConnect sync service already tracks ALB as an active site code;
-- this migration adds the corresponding ProcureFlow site record and corrects
-- the bundle_connect_sync_config display name ('Albany' was a typo for 'Albury').

INSERT INTO sites (id, name, suburb, address, state, zip, contact_person)
VALUES ('99999999-9999-4999-8999-999999999999', 'SPL Albury', 'Albury', '1 Olive Street', 'NSW', '2640', 'Site Manager Albury')
ON CONFLICT (id) DO NOTHING;

UPDATE bundle_connect_sync_config
SET site_name = 'Albury', updated_at = NOW()
WHERE site_code = 'ALB' AND site_name = 'Albany';
