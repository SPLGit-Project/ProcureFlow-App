/**
 * Verify a Supabase PostgREST mutation (update/upsert with `{ count: 'exact' }` + `.select('id')`)
 * actually modified the expected minimum number of rows.
 * Rejects silent RLS denials where PostgREST returns `error: null` and `count: null` or `0`.
 *
 * @param {{ data?: unknown[] | null; error?: unknown; count?: number | null }} result
 * @param {string} errorMessage
 * @param {number} [expectedMin=1]
 * @returns {void}
 */
export function assertMutationAffected(result, errorMessage, expectedMin = 1) {
  if (result.error) throw result.error;
  if (
    !Array.isArray(result.data) ||
    result.data.length < expectedMin ||
    typeof result.count !== 'number' ||
    result.count < expectedMin
  ) {
    throw new Error(errorMessage);
  }
}
