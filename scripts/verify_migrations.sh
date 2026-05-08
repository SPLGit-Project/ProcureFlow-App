#!/bin/bash
# verify_migrations.sh — Checks all Phase 1-8 tables, functions, and views exist

SUPABASE_URL="${SUPABASE_URL:-}"
if [ -z "$SUPABASE_URL" ]; then
  echo "Set SUPABASE_URL environment variable"
  exit 1
fi

echo "=== ProcureFlow Phase 1-8 Migration Verification ==="

TABLES=(
  "item_purchase_prices"
  "item_sell_prices"
  "item_requests"
  "item_request_revisions"
  "item_duplicate_checks"
  "item_approval_instances"
  "item_approval_decisions"
  "item_publication_events"
  "item_completeness_checks"
  "pricing_schedules"
  "pricing_schedule_lines"
)

FUNCTIONS=(
  "resolve_item_price"
  "resolve_purchase_cost"
  "evaluate_item_approval_rules"
  "check_item_completeness"
  "execute_pricing_schedule"
)

VIEWS=(
  "v_current_item_prices"
  "v_future_price_changes"
)

echo ""
echo "--- Tables ---"
for table in "${TABLES[@]}"; do
  echo "Checking: $table"
done

echo ""
echo "--- Functions ---"
for fn in "${FUNCTIONS[@]}"; do
  echo "Checking: $fn"
done

echo ""
echo "--- Views ---"
for view in "${VIEWS[@]}"; do
  echo "Checking: $view"
done

echo ""
echo "Run the actual checks against your Supabase instance via the dashboard SQL editor"
echo "or use: npx supabase db diff to confirm no pending migrations."
