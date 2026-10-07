-- Allow anon users to read basic config to avoid 406 during bootstrap
CREATE POLICY "Allow anon read app_config"
ON public.app_config FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anon read item_field_registry"
ON public.item_field_registry FOR SELECT
TO anon
USING (true);
;
