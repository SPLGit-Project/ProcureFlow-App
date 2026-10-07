
-- Dev/QA bypass: allow unauthenticated (anon) access to all workflow tables
-- These policies exist solely for QA testing in local dev mode.
-- REMOVE before any production-facing deployment.

CREATE POLICY qa_anon_item_requests
  ON item_requests FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY qa_anon_audit_log
  ON item_request_audit_log FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY qa_anon_duplicate_checks
  ON item_duplicate_checks FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY qa_anon_item_approval_instances
  ON item_approval_instances FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY qa_anon_item_approval_decisions
  ON item_approval_decisions FOR ALL TO anon USING (true) WITH CHECK (true);
;
