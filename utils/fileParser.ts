import * as XLSX from 'xlsx';
import { SupplierStockSnapshot } from '../types';

// Enhanced interfaces for mapping confirmation
export interface ColumnMapping {
    [ourField: string]: {
        sourceColumn: string | null;
        confidence: number;  // 0-1 score
        alternatives: string[];  // Other possible matches
    };
}

export interface MappingConfidence {
    overall: number;  // 0-1
    hasErrors: boolean;
    missingRequired: string[];
}

export interface DateColumn {
    columnName: string;
    parsedDate: string;  // ISO format YYYY-MM
    format: string;  // e.g., "MMM YYYY"
    isIncomingStock: boolean;
}

export interface EnhancedParseResult {
    success: boolean;
    data?: Partial<SupplierStockSnapshot>[];
    mapping: ColumnMapping;
    confidence: MappingConfidence;
    errors: string[];
    warnings: string[];
    allColumns: string[];  // All detected columns from file
    dateColumns: DateColumn[];  // Detected date columns for incoming stock
    rawData?: any[];  // Raw data for preview
    detectedSupplier?: SupplierDetection;
    reportDate?: string;  // YYYY-MM-DD effective date of the report (from filename/content), used for staleness checks
}

export interface SupplierDetection {
    name: string;
    confidence: number;
    evidence: string[];
    isExcluded?: boolean;
}

// Field definitions with aliases and confidence weights
const FIELD_DEFINITIONS = {
    supplierSku: {
        aliases: ['sku', 'stock code', 'item code', 'product code', 'supplier sku', 'suppliersku', 'code', 'customer stock code', 'cust code', 'supplier part id', 'part id'],
        required: true,
        weight: 1.0
    },
    productName: {
        aliases: ['product', 'product name', 'item name', 'description', 'item', 'name', 'spl product description'],
        required: false,
        weight: 1.0 // Increased weight to prioritize 'Product' over 'Range'
    },
    stockOnHand: {
        aliases: ['soh', 'stock on hand', 'stock', 'on hand', 'stock_on_hand', 'total stock'],
        required: false,
        weight: 0.95
    },
    availableQty: {
        aliases: ['available', 'avail', 'available qty', 'available stock', 'avail qty', 'available_qty', 'orders available'],
        required: false,
        weight: 0.9
    },
    committedQty: {
        aliases: ['committed', 'committed qty', 'allocated', 'committed_qty'],
        required: false,
        weight: 0.85
    },
    backOrderedQty: {
        aliases: ['back ordered', 'backorder', 'back order qty', 'backorder qty', 'back_ordered_qty'],
        required: false,
        weight: 0.85
    },
    customerStockCode: {
        aliases: ['customer code', 'customer stock code', 'cust code', 'customer sku', 'customer_stock_code', 'spl item code', 'spl part id', 'spl code', 'customer part id', 'customer part'],
        required: false,
        weight: 1.05
    },
    range: {
        aliases: ['range', 'product range'],
        required: false,
        weight: 0.8 // High weight for specific 'Range' column
    },
    category: {
        aliases: ['category', 'cat', 'product category'],
        required: false,
        weight: 0.6
    },
    subCategory: {
        aliases: ['sub category', 'subcategory', 'sub cat', 'sub_category'],
        required: false,
        weight: 0.6
    },
    stockType: {
        aliases: ['stock type', 'stocktype', 'type', 'stock_type'],
        required: false,
        weight: 0.5
    },
    cartonQty: {
        aliases: ['carton qty', 'carton', 'carton quantity', 'carton_qty'],
        required: false,
        weight: 0.5
    },
    sellPrice: {
        aliases: ['sell $', 'sell price', 'unit price', 'price', 'cost', 'sell'],
        required: false,
        weight: 0.8
    },
    sohValueAtSell: {
        aliases: ['soh $ @ sell', 'stock value', 'value', 'soh value', 'soh $'],
        required: false,
        weight: 0.8
    },
    totalStockQty: {
        aliases: ['total stock', 'total qty', 'total soh'],
        required: false,
        weight: 0.8
    },
    incomingStockText: {
        aliases: ['new inventory arriving', 'incoming stock', 'incoming inventory', 'stock arriving', 'stock on order', 'on order', 'eta'],
        required: false,
        weight: 0.7
    }
};

/**
 * Normalizes a header string for matching
 */
function normalizeHeader(header: string): string {
    if (!header || typeof header !== 'string') return '';
    return header.toLowerCase().trim().replace(/[_\s-]+/g, ' ');
}

/**
 * Calculate similarity score between two strings using Levenshtein-like algorithm
 */
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = normalizeHeader(str1);
    const s2 = normalizeHeader(str2);
    
    // Exact match
    if (s1 === s2) return 1.0;
    
    // Contains match
    if (s1.includes(s2) || s2.includes(s1)) {
        const longer = Math.max(s1.length, s2.length);
        const shorter = Math.min(s1.length, s2.length);
        return 0.7 + (0.3 * (shorter / longer));
    }
    
    // Partial word match
    const words1 = s1.split(' ');
    const words2 = s2.split(' ');
    const matchingWords = words1.filter(w => words2.includes(w)).length;
    if (matchingWords > 0) {
        return 0.5 * (matchingWords / Math.max(words1.length, words2.length));
    }
    
    return 0;
}

/**
 * Detect if a column name represents a date for incoming stock
 */
function detectDateColumn(header: string): DateColumn | null {
    const normalized = normalizeHeader(header);
    
    // Pattern: "Jan 2026", "Feb 2026", etc.
    const monthYearPattern = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{4})$/i;
    const match = normalized.match(monthYearPattern);
    
    if (match) {
        const monthMap: Record<string, string> = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };
        
        const month = monthMap[match[1].toLowerCase()];
        const year = match[2];
        
        return {
            columnName: header,
            parsedDate: `${year}-${month}`,
            format: 'MMM YYYY',
            isIncomingStock: true
        };
    }
    
    // Pattern: "01/2026", "02/2026", etc.
    const slashPattern = /^(\d{1,2})\s*\/\s*(\d{4})$/;
    const slashMatch = normalized.match(slashPattern);
    
    if (slashMatch) {
        const month = slashMatch[1].padStart(2, '0');
        const year = slashMatch[2];
        
        return {
            columnName: header,
            parsedDate: `${year}-${month}`,
            format: 'MM/YYYY',
            isIncomingStock: true
        };
    }
    
    return null;
}

function flattenWorkbookText(rawRows: any[][]): string {
    return rawRows
        .flat()
        .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
        .map(value => String(value).toLowerCase().trim())
        .join(' ');
}

function includesAll(text: string, terms: string[]): boolean {
    return terms.every(term => text.includes(term));
}

/**
 * Determines if the flat workbook text or header text contains segment indicators
 * for suppliers that send separate files per customer segment (e.g. Simba).
 */
function detectSegment(text: string, headerText: string, fileName: string): 'Healthcare' | 'Accommodation' | null {
    const combined = `${text} ${headerText} ${fileName.toLowerCase()}`;
    const isHealthcare =
        combined.includes('healthcare') ||
        combined.includes('health care') ||
        combined.includes('health-care') ||
        /\bhc\b/.test(combined);
    const isAccommodation =
        combined.includes('accommodation') ||
        combined.includes('accomm') ||
        combined.includes('accomodation') ||
        combined.includes('hotel') ||
        /\bacc\b/.test(combined);
    if (isHealthcare && !isAccommodation) return 'Healthcare';
    if (isAccommodation && !isHealthcare) return 'Accommodation';
    return null;
}

function detectSupplierFromContent(
    rawRows: any[][],
    headers: string[],
    fileName: string = ''
): SupplierDetection | undefined {
    const text = flattenWorkbookText(rawRows);
    const headerText = headers.map(h => h.toLowerCase()).join(' ');
    const fileNameLower = fileName.toLowerCase();
    const candidates: SupplierDetection[] = [];

    // ── HOST Supplies ──────────────────────────────────────────────────────────
    if (includesAll(headerText, ['spl part id', 'supplier part id', 'unit price ex gst'])) {
        candidates.push({
            name: 'HOST Supplies',
            confidence: 0.96,
            evidence: ['Detected HOST stocklist schema: SPL Part ID, Supplier Part ID, Unit Price ex GST']
        });
    } else if (fileNameLower.includes('host') && (fileNameLower.includes('stock') || fileNameLower.includes('inventory'))) {
        candidates.push({
            name: 'HOST Supplies',
            confidence: 0.80,
            evidence: ['Filename contains HOST + stock/inventory indicator']
        });
    }

    // ── Frenkel Textiles ───────────────────────────────────────────────────────
    if (includesAll(text, ['inventory report', 'a.c.n 106 563 204']) || includesAll(headerText, ['item code', 'product description', 'new inventory arriving'])) {
        candidates.push({
            name: 'Frenkel Textiles',
            confidence: 0.95,
            evidence: ['Detected Frenkel inventory report structure and ACN/ABN metadata']
        });
    } else if (fileNameLower.includes('frenkel')) {
        candidates.push({
            name: 'Frenkel Textiles',
            confidence: 0.82,
            evidence: ['Filename contains Frenkel']
        });
    }

    // ── Simba (segment-aware) ──────────────────────────────────────────────────
    // Simba sends two separate files: one for Healthcare customers and one for
    // Accommodation customers. The segment is identified from body text, headers,
    // and the filename — in that priority order.
    const isSimbaByContent =
        (includesAll(text, ['stock report in quantity', 'stock group customer']) &&
         includesAll(headerText, ['sku', 'product', 'customer stock code', 'stocktype'])) ||
        includesAll(text, ['stock group customer']) && includesAll(headerText, ['customer stock code', 'stocktype']);

    const isSimbaByFilename =
        fileNameLower.includes('simba') &&
        (fileNameLower.includes('stock') || fileNameLower.includes('inventory') || fileNameLower.includes('report'));

    if (isSimbaByContent || isSimbaByFilename) {
        const baseConfidence = isSimbaByContent ? 0.94 : 0.82;
        const segment = detectSegment(text, headerText, fileName);

        if (segment === 'Healthcare') {
            candidates.push({
                name: 'Simba Healthcare',
                confidence: baseConfidence + 0.02,
                evidence: [
                    isSimbaByContent ? 'Detected Simba stock report structure' : 'Filename identifies Simba',
                    'Segment identified as Healthcare from file content/name'
                ]
            });
        } else if (segment === 'Accommodation') {
            candidates.push({
                name: 'Simba Accommodation',
                confidence: baseConfidence + 0.02,
                evidence: [
                    isSimbaByContent ? 'Detected Simba stock report structure' : 'Filename identifies Simba',
                    'Segment identified as Accommodation from file content/name'
                ]
            });
        } else {
            // No clear segment signal — fall back to generic Simba.
            // This is the safest fallback: the import will still succeed
            // if a supplier named 'Simba' exists in the supplier master.
            candidates.push({
                name: 'Simba',
                confidence: baseConfidence - 0.05,
                evidence: [
                    isSimbaByContent ? 'Detected Simba stock report structure' : 'Filename identifies Simba',
                    'WARNING: Could not determine Healthcare vs Accommodation segment — check the file title and sheet name'
                ]
            });
        }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence)[0];
}

/**
 * Maps headers to fields with confidence scoring
 */
function createMapping(headers: string[], rawDataRows?: any[][]): { mapping: ColumnMapping; dateColumns: DateColumn[] } {
    const mapping: ColumnMapping = {};
    const dateColumns: DateColumn[] = [];
    
    // Initialize all fields
    Object.keys(FIELD_DEFINITIONS).forEach(field => {
        mapping[field] = {
            sourceColumn: null,
            confidence: 0,
            alternatives: []
        };
    });
    
    // Process each header
    headers.forEach(header => {
        // Check if it's a date column first
        const dateCol = detectDateColumn(header);
        if (dateCol) {
            dateColumns.push(dateCol);
            return;
        }
        
        // Find best field match for this header
        Object.entries(FIELD_DEFINITIONS).forEach(([fieldName, fieldDef]) => {
            let maxSimilarity = 0;
            
            fieldDef.aliases.forEach(alias => {
                const similarity = calculateSimilarity(header, alias);
                if (similarity > maxSimilarity) {
                    maxSimilarity = similarity;
                }
            });
            
            // Apply field weight
            const weightedScore = maxSimilarity * fieldDef.weight;
            
            // If this is a better match than previous mapping for this field
            if (weightedScore > 0.4 && weightedScore > mapping[fieldName].confidence) {
                // If this header was previously used by another field, we don't handle that here
                // We just want the BEST header for EACH field.
                mapping[fieldName] = {
                    sourceColumn: header,
                    confidence: weightedScore,
                    alternatives: [] // Computed later if needed
                };
            }
        });
    });

    // Fallback logic for unmapped product name (e.g. empty headers in HOST STOCKLIST)
    if (!mapping.productName.sourceColumn) {
        const mappedColumns = new Set(Object.values(mapping).map(m => m.sourceColumn).filter(Boolean));
        for (let i = 0; i < headers.length; i++) {
            const h = headers[i];
            if (h && (h.startsWith('Column_') || h.toLowerCase() === 'description' || h.toLowerCase() === 'product')) {
                if (!mappedColumns.has(h)) {
                    let hasData = false;
                    if (rawDataRows) {
                        for (let r = 0; r < Math.min(rawDataRows.length, 10); r++) {
                            const val = rawDataRows[r][i];
                            if (val !== undefined && val !== null && String(val).trim().length > 0) {
                                hasData = true;
                                break;
                            }
                        }
                    } else {
                        hasData = true;
                    }
                    if (hasData) {
                        mapping.productName = {
                            sourceColumn: h,
                            confidence: 0.5,
                            alternatives: []
                        };
                        break;
                    }
                }
            }
        }
    }
    
    return { mapping, dateColumns };
}

/**
 * Intelligent scan to find the header row in a 2D array of data
 */
function findHeaderRow(data: any[][]): { index: number; dataStartIndex: number; headers: string[] } {
    let bestRowIndex = 0;
    let maxMatches = 0;
    let bestHeaders: string[] = [];

    // Scan first 20 rows
    const scanLimit = Math.min(data.length, 20);
    
    for (let i = 0; i < scanLimit; i++) {
        const row = data[i];
        if (!row || !Array.isArray(row)) continue;

        let matches = 0;
        const potentialHeaders: string[] = row.map((cell, idx) => String(cell || '').trim() || `Column_${idx}`);
        
        potentialHeaders.forEach(header => {
            if (!header || header.startsWith('Column_')) return;
            
            // Re-use logic from createMapping to see if this header matches ANY alias
            Object.values(FIELD_DEFINITIONS).forEach(fieldDef => {
                fieldDef.aliases.forEach(alias => {
                    if (calculateSimilarity(header, alias) > 0.7) {
                        matches++;
                    }
                });
            });
            
            // Also check for date columns
            if (detectDateColumn(header)) {
                matches += 1.5; // Date columns are a strong signal of a header row
            }
        });

        if (matches > maxMatches) {
            maxMatches = matches;
            bestRowIndex = i;
            bestHeaders = potentialHeaders;
        }
    }

    // Default to first row if no matches found
    if (maxMatches === 0 && data.length > 0) {
        bestHeaders = data[0].map((cell, idx) => String(cell || '').trim() || `Column_${idx}`);
    }

    let dataStartIndex = bestRowIndex + 1;

    // Some supplier reports, notably Simba, use staggered multi-row headers:
    // row A has SKU/Product while a lower row has SPL Item Code/Product Description.
    // Merge strong lower header labels into blank columns and start data below them.
    for (let i = bestRowIndex + 1; i < Math.min(data.length, bestRowIndex + 4); i++) {
        const row = data[i];
        if (!row || !Array.isArray(row)) continue;

        let mergedAny = false;
        const mergedHeaders = [...bestHeaders];
        row.forEach((cell, idx) => {
            const label = String(cell || '').trim();
            if (!label) return;
            const existing = mergedHeaders[idx] || '';
            if (existing && !existing.startsWith('Column_')) return;

            const matchesKnownField = Object.values(FIELD_DEFINITIONS).some(fieldDef =>
                fieldDef.aliases.some(alias => calculateSimilarity(label, alias) > 0.85)
            );
            if (matchesKnownField) {
                mergedHeaders[idx] = label;
                mergedAny = true;
            }
        });

        if (mergedAny) {
            bestHeaders = mergedHeaders;
            dataStartIndex = i + 1;
        }
    }

    return { index: bestRowIndex, dataStartIndex, headers: bestHeaders };
}

/**
 * Cleans a string value and converts it to a number, handling currency symbols, 
 * commas, and other formatting.
 */
function cleanNumericValue(value: any, isFloat: boolean = false): number | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') return value;
    
    // Convert to string and clean
    const str = String(value).trim();
    if (!str) return null;

    // Remove currency symbols, commas, and percentage signs
    // Keep digits, decimal point, and leading minus sign
    const cleaned = str.replace(/[^\d.-]/g, '');
    
    const parsed = isFloat ? parseFloat(cleaned) : parseInt(cleaned, 10);
    return isNaN(parsed) ? null : parsed;
}

function parseIncomingStockText(value: any): Array<{ month: string; qty: number }> {
    if (value === undefined || value === null) return [];

    const text = String(value).trim().toLowerCase();
    if (!text) return [];

    const monthMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
    if (!monthMatch) return [];

    const quantityMatch = text.match(/\b\d[\d\s,]*(?:\.\d+)?\b/);
    if (!quantityMatch) return [];

    const qty = cleanNumericValue(quantityMatch[0], false);
    if (!qty || qty <= 0) return [];

    const monthMap: Record<string, string> = {
        jan: '01', january: '01',
        feb: '02', february: '02',
        mar: '03', march: '03',
        apr: '04', april: '04',
        may: '05',
        jun: '06', june: '06',
        jul: '07', july: '07',
        aug: '08', august: '08',
        sep: '09', sept: '09', september: '09',
        oct: '10', october: '10',
        nov: '11', november: '11',
        dec: '12', december: '12'
    };

    const yearMatch = text.match(/\b(20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
    const month = monthMap[monthMatch[1]];
    return month ? [{ month: `${year}-${month}`, qty }] : [];
}

/**
 * Calculate overall mapping confidence
 */
function calculateConfidence(mapping: ColumnMapping): MappingConfidence {
    const requiredFields = Object.entries(FIELD_DEFINITIONS)
        .filter(([_, def]) => def.required)
        .map(([name, _]) => name);
    
    const missingRequired = requiredFields.filter(
        field => !mapping[field]?.sourceColumn
    );
    
    const mappedFields = Object.values(mapping).filter(m => m.sourceColumn !== null);
    const avgConfidence = mappedFields.length > 0
        ? mappedFields.reduce((sum, m) => sum + m.confidence, 0) / mappedFields.length
        : 0;
    
    return {
        overall: avgConfidence,
        hasErrors: missingRequired.length > 0,
        missingRequired
    };
}

/**
 * Parse data rows using the mapping
 */
export function parseDataRows(
    rawData: any[],
    mapping: ColumnMapping,
    dateColumns: DateColumn[]
): Partial<SupplierStockSnapshot>[] {
    const parsedData: Partial<SupplierStockSnapshot>[] = [];
    
    rawData.forEach((row, index) => {
        const snapshot: Record<string, any> = {};
        
        // Map standard fields
        Object.entries(mapping).forEach(([fieldName, fieldMapping]) => {
            if (!fieldMapping.sourceColumn) return;
            
            const value = row[fieldMapping.sourceColumn];
            if (value === undefined || value === null || value === '') return;
            
            switch (fieldName) {
                case 'supplierSku':
                case 'productName':
                case 'customerStockCode':
                case 'range':
                case 'category':
                case 'subCategory':
                case 'stockType':
                    snapshot[fieldName] = String(value).trim();
                    break;
                    
                case 'stockOnHand':
                case 'availableQty':
                case 'committedQty':
                case 'backOrderedQty':
                case 'cartonQty':
                case 'totalStockQty':
                    const numValue = cleanNumericValue(value, false);
                    if (numValue !== null) {
                        snapshot[fieldName] = numValue;
                    }
                    break;
                case 'incomingStockText':
                    snapshot.incomingStock = parseIncomingStockText(value);
                    break;

                case 'sellPrice':
                case 'sohValueAtSell':
                     const floatValue = cleanNumericValue(value, true);
                     if (floatValue !== null) {
                         snapshot[fieldName] = floatValue;
                     }
                     break;
            }
        });
        
        // Parse incoming stock from date columns
        const incomingStock: Array<{ month: string; qty: number }> = [];
        dateColumns.forEach(dateCol => {
            const value = row[dateCol.columnName];
            if (value !== undefined && value !== null && value !== '') {
                const qty = typeof value === 'number' ? value : parseInt(String(value).replace(/,/g, ''), 10);
                if (!isNaN(qty) && qty > 0) {
                    incomingStock.push({
                        month: dateCol.parsedDate,
                        qty
                    });
                }
            }
        });
        
        if (incomingStock.length > 0) {
            snapshot.incomingStock = incomingStock;
        }
        
        // Validate required fields - Skip rows with no SKU
        // User request: "when there is no SKU or Product found, these rows must be ignored"
        const hasSku = snapshot.supplierSku && snapshot.supplierSku.trim().length > 0 && snapshot.supplierSku !== '-';
        const normalizedSku = normalizeHeader(snapshot.supplierSku || '');
        const normalizedProduct = normalizeHeader(snapshot.productName || '');
        const isHeaderOrSummaryRow =
            ['sku', 'item code', 'spl item code', 'supplier part id'].includes(normalizedSku) ||
            normalizedProduct.includes('description') ||
            normalizedProduct.includes('category') ||
            (!/[a-z]/i.test(snapshot.productName || '') && !/[a-z]/i.test(snapshot.supplierSku || ''));
        
        if (hasSku && !isHeaderOrSummaryRow) {
            parsedData.push(snapshot as Partial<SupplierStockSnapshot>);
        }
    });
    
    return parsedData;
}

/**
 * Enhanced file parser with confidence scoring and mapping
 */
/**
 * Extract the effective "as at" date of a supplier report so we can reject
 * stale uploads (an older report overwriting newer inventory).
 *
 * Strategy (first match wins):
 *  1. A date embedded in the file name, e.g. "HOST SOH REPORT - 09.06.2026.xlsx"
 *     or "SPL ... 02_06_2026.zip". Day-first (Australian) is assumed.
 *  2. A date found in the first ~15 rows of the sheet (report header banners
 *     often carry "As at 09/06/2026" or "Report Date: 2026-06-09").
 *
 * Returns an ISO date string (YYYY-MM-DD) or undefined when nothing is found.
 */
export function extractReportDate(fileName: string, rawRows: any[][] = []): string | undefined {
    const clamp = (y: number, m: number, d: number): string | undefined => {
        if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
        const yyyy = y < 100 ? 2000 + y : y;
        if (yyyy < 2000 || yyyy > 2100) return undefined;
        const dt = new Date(Date.UTC(yyyy, m - 1, d));
        // Reject impossible dates (e.g. 31/02) that JS would roll over.
        if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
        // Reject absurd far-future dates from filename typos (e.g. "2036"
        // instead of "2026"). A future report date would permanently win the
        // staleness check and block every legitimate later upload. Allow a
        // small window for clock/timezone skew, otherwise fall back.
        if (dt.getTime() > Date.now() + 45 * 24 * 60 * 60 * 1000) return undefined;
        return `${yyyy}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    const fromText = (text: string): string | undefined => {
        if (!text) return undefined;
        // ISO first: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
        const iso = text.match(/(20\d{2})[._/-](\d{1,2})[._/-](\d{1,2})/);
        if (iso) {
            const hit = clamp(Number(iso[1]), Number(iso[2]), Number(iso[3]));
            if (hit) return hit;
        }
        // Day-first: DD-MM-YYYY / DD.MM.YYYY / DD_MM_YYYY / DD/MM/YY
        const dmy = text.match(/(\d{1,2})[._/-](\d{1,2})[._/-](\d{2,4})/);
        if (dmy) {
            const hit = clamp(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
            if (hit) return hit;
        }
        return undefined;
    };

    // 1. Filename
    const fromName = fromText(fileName || '');
    if (fromName) return fromName;

    // 2. Header banner rows
    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
        const rowText = (rawRows[i] || []).map(cell => (cell == null ? '' : String(cell))).join(' ');
        const hit = fromText(rowText);
        if (hit) return hit;
    }

    return undefined;
}

export function parseStockFileEnhanced(file: File): Promise<EnhancedParseResult> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                
                // Read as 2D array first to find headers
                const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
                
                if (rawRows.length === 0) {
                    resolve({
                        success: false,
                        mapping: {} as ColumnMapping,
                        confidence: { overall: 0, hasErrors: true, missingRequired: ['supplierSku'] },
                        errors: ['The file appears to be empty or has no data rows'],
                        warnings: [],
                        allColumns: [],
                        dateColumns: []
                    });
                    return;
                }
                
                // Find the intelligent header row
                const { index: headerIndex, dataStartIndex, headers } = findHeaderRow(rawRows);
                
                // Slice data starting from below headers
                const dataRows = rawRows.slice(dataStartIndex);
                
                // Convert to objects based on detected headers for current mapping logic compatibility
                const jsonData = dataRows.map(row => {
                    const obj: Record<string, any> = {};
                    headers.forEach((header, i) => {
                        if (header) obj[header] = row[i];
                    });
                    return obj;
                });

                // Create mapping
                const { mapping, dateColumns } = createMapping(headers, dataRows);
                const detectedSupplier = detectSupplierFromContent(rawRows, headers, file.name);
                const reportDate = extractReportDate(file.name, rawRows);
                const confidence = calculateConfidence(mapping);
                
                const errors: string[] = [];
                const warnings: string[] = [];
                
                if (headerIndex > 0) {
                    warnings.push(`Skipped ${headerIndex} header/metadata rows at the top of the file.`);
                }

                // Check for required fields
                if (confidence.missingRequired.length > 0) {
                    errors.push(
                        `Missing required fields: ${confidence.missingRequired.join(', ')}`
                    );
                }
                
                // Parse data if we have minimum requirements
                let parsedData: Partial<SupplierStockSnapshot>[] | undefined;
                if (!confidence.hasErrors) {
                    parsedData = parseDataRows(jsonData, mapping, dateColumns);
                    
                    if (parsedData.length === 0) {
                        warnings.push('No valid data rows found after parsing');
                    }
                }
                
                // Add warnings about confidence
                const lowConfidenceMappings = Object.entries(mapping)
                    .filter(([_, m]) => m.sourceColumn && m.confidence < 0.7)
                    .map(([field, m]) => `${field} → ${m.sourceColumn} (${Math.round(m.confidence * 100)}%)`);
                
                if (lowConfidenceMappings.length > 0) {
                    warnings.push(`Low confidence mappings: ${lowConfidenceMappings.join(', ')}`);
                }
                
                resolve({
                    success: !confidence.hasErrors,
                    data: parsedData,
                    mapping,
                    confidence,
                    errors,
                    warnings,
                    allColumns: headers,
                    dateColumns,
                    rawData: jsonData,  // Full data for processing
                    detectedSupplier,
                    reportDate
                });
                
            } catch (error: any) {
                resolve({
                    success: false,
                    mapping: {} as ColumnMapping,
                    confidence: { overall: 0, hasErrors: true, missingRequired: [] },
                    errors: [`Failed to parse file: ${error.message}`],
                    warnings: [],
                    allColumns: [],
                    dateColumns: []
                });
            }
        };
        
        reader.onerror = () => {
            resolve({
                success: false,
                mapping: {} as ColumnMapping,
                confidence: { overall: 0, hasErrors: true, missingRequired: [] },
                errors: ['Failed to read file'],
                warnings: [],
                allColumns: [],
                dateColumns: []
            });
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Keep original function for backward compatibility
export { parseStockFileEnhanced as parseStockFile };
