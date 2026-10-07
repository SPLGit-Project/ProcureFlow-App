
-- Allow anon role to read active colour options (non-sensitive reference data)
CREATE POLICY "colour_options_anon_read" ON colour_options
  FOR SELECT TO anon USING (true);
;
