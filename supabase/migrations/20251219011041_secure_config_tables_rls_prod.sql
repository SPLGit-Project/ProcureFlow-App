-- 1. Secure app_config
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read app_config"
ON public.app_config FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admins to manage app_config"
ON public.app_config FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. Secure item_field_registry
ALTER TABLE public.item_field_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read item_field_registry"
ON public.item_field_registry FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admins to manage item_field_registry"
ON public.item_field_registry FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 3. Secure po_sequences
ALTER TABLE public.po_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read po_sequences"
ON public.po_sequences FOR SELECT
TO authenticated
USING (true);
;
