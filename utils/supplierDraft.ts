/** Keep header details, but never restore another supplier's priced cart. */
export const getSupplierScopedDraft = <T extends {
  selectedSupplierId?: string;
  cart?: unknown[];
  quantityDrafts?: Record<string, string>;
}>(draft: T | null, requestedSupplierId: string): T | null => {
  if (!draft || !requestedSupplierId || draft.selectedSupplierId === requestedSupplierId) return draft;
  return { ...draft, selectedSupplierId: requestedSupplierId, cart: [], quantityDrafts: {} };
};
