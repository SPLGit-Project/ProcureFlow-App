DROP POLICY IF EXISTS "item_approval_rules_read" ON item_approval_rules;
DROP POLICY IF EXISTS "item_approval_rules_write" ON item_approval_rules;

CREATE POLICY "item_approval_rules_read" ON item_approval_rules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "item_approval_rules_write" ON item_approval_rules
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_permission('manage_development'));;
