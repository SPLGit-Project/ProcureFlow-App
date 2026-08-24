/**
 * Financial and Tax (GST) calculation utilities for ProcureFlow.
 * Standardizes calculation and rounding across PO creation, editing,
 * approval evaluation, reporting, and SAP Concur exports to eliminate
 * rounding variances and ensure 1:1 financial parity.
 */

export const DEFAULT_GST_RATE = 10.0; // Australian Standard GST 10%
export const DEFAULT_TAX_CODE = 'GST';

/**
 * Rounds a number to exactly 2 decimal places using Banker's / half-up rounding.
 */
export const roundCurrency = (amount: number): number => {
  return Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;
};

export interface CalculatedLinePricing {
  quantityOrdered: number;
  unitPrice: number; // Ex-GST
  totalPrice: number; // Ex-GST
  taxCode: string;
  taxRate: number;
  taxAmount: number; // GST Amount
  totalPriceIncGst: number; // Gross Total (Inc-GST)
  unitPriceIncGst: number; // Gross Unit Price
}

/**
 * Calculates complete net, GST, and gross figures for a single line item.
 */
export const calculateLinePricing = (
  quantity: number,
  unitPriceExGst: number,
  taxCode: string = DEFAULT_TAX_CODE,
  taxRate: number = DEFAULT_GST_RATE
): CalculatedLinePricing => {
  const safeQty = Math.max(0, Number(quantity) || 0);
  const safePrice = Math.max(0, Number(unitPriceExGst) || 0);
  const isGstFree = taxCode.toUpperCase() === 'FRE' || taxCode.toUpperCase() === 'GST_FREE' || taxCode.toUpperCase() === 'EXP' || taxRate === 0;
  const effectiveRate = isGstFree ? 0 : (Number(taxRate) || DEFAULT_GST_RATE);

  const totalPrice = roundCurrency(safeQty * safePrice);
  const taxAmount = isGstFree ? 0 : roundCurrency(totalPrice * (effectiveRate / 100));
  const totalPriceIncGst = roundCurrency(totalPrice + taxAmount);
  const unitPriceIncGst = safeQty > 0 ? roundCurrency(totalPriceIncGst / safeQty) : roundCurrency(safePrice * (1 + effectiveRate / 100));

  return {
    quantityOrdered: safeQty,
    unitPrice: safePrice,
    totalPrice,
    taxCode: isGstFree ? 'FRE' : taxCode,
    taxRate: effectiveRate,
    taxAmount,
    totalPriceIncGst,
    unitPriceIncGst
  };
};

export interface CalculatedPOTotals {
  subtotalAmount: number; // Ex-GST sum
  taxTotalAmount: number; // Total GST sum
  totalAmountIncGst: number; // Gross total (Subtotal + GST)
  itemCount: number;
}

/**
 * Calculates header-level totals aggregated across all PO lines.
 */
export const calculatePOTotals = (
  lines: Array<{
    totalPrice?: number;
    taxAmount?: number;
    totalPriceIncGst?: number;
    taxCode?: string;
    taxRate?: number;
  }>
): CalculatedPOTotals => {
  let subtotal = 0;
  let taxTotal = 0;
  let grossTotal = 0;

  for (const line of lines) {
    const lineNet = roundCurrency(Number(line.totalPrice) || 0);
    const lineTax = line.taxAmount !== undefined
      ? roundCurrency(Number(line.taxAmount))
      : (line.taxCode === 'FRE' ? 0 : roundCurrency(lineNet * ((line.taxRate ?? DEFAULT_GST_RATE) / 100)));
    const lineGross = line.totalPriceIncGst !== undefined
      ? roundCurrency(Number(line.totalPriceIncGst))
      : roundCurrency(lineNet + lineTax);

    subtotal += lineNet;
    taxTotal += lineTax;
    grossTotal += lineGross;
  }

  const subtotalAmount = roundCurrency(subtotal);
  const taxTotalAmount = roundCurrency(taxTotal);
  // Guarantee gross total matches subtotal + taxTotal
  const totalAmountIncGst = roundCurrency(subtotalAmount + taxTotalAmount);

  return {
    subtotalAmount,
    taxTotalAmount,
    totalAmountIncGst,
    itemCount: lines.length
  };
};

/**
 * Formats a monetary amount into Australian Dollar currency format.
 */
export const formatCurrency = (amount: number | undefined | null, includeSymbol: boolean = true): string => {
  const safeVal = Number(amount) || 0;
  const formatted = safeVal.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return includeSymbol ? `$${formatted}` : formatted;
};
