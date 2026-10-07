
CREATE POLICY "qa_anon_all_item_approval_instances"
  ON public.item_approval_instances FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "qa_anon_all_item_approval_decisions"
  ON public.item_approval_decisions FOR ALL TO anon USING (true) WITH CHECK (true);
;
