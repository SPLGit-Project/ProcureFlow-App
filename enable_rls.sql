ALTER TABLE public.asset_capitalization ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access for all authenticated users (or everyone if public data, but usually authenticated)
CREATE POLICY "Enable read access for authenticated users" 
ON public.asset_capitalization 
FOR SELECT 
TO authenticated 
USING (true);

-- Policy to allow write access for authenticated users (adjust as needed, e.g., only admins)
CREATE POLICY "Enable write access for authenticated users" 
ON public.asset_capitalization 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);
