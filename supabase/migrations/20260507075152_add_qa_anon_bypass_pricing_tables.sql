-- Allow anon role full access to pricing tables for QA/dev mode
CREATE POLICY "qa_anon_all_item_purchase_prices"
  ON public.item_purchase_prices FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "qa_anon_all_item_sell_prices"
  ON public.item_sell_prices FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "qa_anon_all_preview_purchase_drafts"
  ON public.preview_purchase_price_drafts FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "qa_anon_all_preview_sell_drafts"
  ON public.preview_sell_price_drafts FOR ALL TO anon USING (true) WITH CHECK (true);;
