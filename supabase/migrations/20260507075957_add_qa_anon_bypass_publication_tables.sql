
CREATE POLICY "qa_anon_all_item_publication_events"
  ON public.item_publication_events FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "qa_anon_all_item_completeness_checks"
  ON public.item_completeness_checks FOR ALL TO anon USING (true) WITH CHECK (true);
;
