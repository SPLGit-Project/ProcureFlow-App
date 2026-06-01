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
        aliases: ['product', 'product name', 'item name', 'description', 'item', 'name'],
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
        aliases: ['customer code', 'customer stock code', 'cust code', 'customer sku', 'customer_stock_code', 'spl part id', 'spl code', 'customer part id', 'customer part'],
        required: false,
        weight: 0.7
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

function detectSupplierFromContent(rawRows: any[][], headers: string[]): SupplierDetection | undefined {
    const text = flattenWorkbookText(rawRows);
    const headerText = headers.map(h => h.toLowerCase()).join(' ');
    const candidates: SupplierDetection[] = [];

    if (includesAll(headerText, ['spl part id', 'supplier part id', 'unit price ex gst'])) {
        candidates.push({
            name: 'HOST Supplies',
            confidence: 0.96,
            evidence: ['Detected HOST stocklist schema: SPL Part ID, Supplier Part ID, Unit Price ex GST']
        });
    }

    if (includesAll(text, ['inventory report', 'a.c.n 106 563 204']) || includesAll(headerText, ['item code', 'product description', 'new inventory arriving'])) {
        candidates.push({
            name: 'Frenkel Textiles',
            confidence: 0.95,
            evidence: ['Detected Frenkel inventory report structure and ACN/ABN metadata']
        });
    }

    if (includesAll(text, ['stock report in quantity', 'stock group customer']) && includesAll(headerText, ['sku', 'product', 'customer stock code', 'stocktype'])) {
        candidates.push({
            name: 'Simba',
            confidence: 0.94,
            evidence: ['Detected Simba stock report structure; Accommodation/Healthcare values are SPL customer stock groups']
        });
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
function findHeaderRow(data: any[][]): { index: number; headers: string[] } {
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

    return { index: bestRowIndex, headers: bestHeaders };
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
                const { index: headerIndex, headers } = findHeaderRow(rawRows);
                
                // Slice data starting from below headers
                const dataRows = rawRows.slice(headerIndex + 1);
                
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
                const detectedSupplier = detectSupplierFromContent(rawRows, headers);
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
                    detectedSupplier
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
