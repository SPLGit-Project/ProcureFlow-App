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
}

// Field definitions with aliases and confidence weights
const FIELD_DEFINITIONS = {
    supplierSku: {
        aliases: ['sku', 'stock code', 'item code', 'product code', 'supplier sku', 'suppliersku', 'code', 'customer stock code', 'cust code'],
        required: true,
        weight: 1.0
    },
    productName: {
        aliases: ['product', 'product name', 'item name', 'description', 'item', 'name', 'range'],
        required: false,
        weight: 0.9
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
        aliases: ['customer code', 'customer stock code', 'cust code', 'customer sku', 'customer_stock_code'],
        required: false,
        weight: 0.7
    },
    range: {
        aliases: ['range', 'product range', 'category'],
        required: false,
        weight: 0.6
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
    }
};

/**
 * Normalizes a header string for matching
 */
function normalizeHeader(header: string): string {
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

/**
 * Maps headers to fields with confidence scoring
 */
function createMapping(headers: string[]): { mapping: ColumnMapping; dateColumns: DateColumn[] } {
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
        
        // Find best field match
        let bestField: string | null = null;
        let bestScore = 0;
        const scores: Array<{ field: string; score: number }> = [];
        
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
            
            if (weightedScore > 0.4) {  // Minimum threshold
                scores.push({ field: fieldName, score: weightedScore });
            }
            
            if (weightedScore > bestScore) {
                bestScore = weightedScore;
                bestField = fieldName;
            }
        });
        
        // Assign best match
        if (bestField && bestScore > 0.4) {
            mapping[bestField] = {
                sourceColumn: header,
                confidence: bestScore,
                alternatives: scores
                    .filter(s => s.field !== bestField && s.score > 0.3)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3)
                    .map(s => s.field)
            };
        }
    });
    
    return { mapping, dateColumns };
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
                    const numValue = typeof value === 'number' ? value : parseInt(String(value).replace(/,/g, ''), 10);
                    if (!isNaN(numValue)) {
                        snapshot[fieldName] = numValue;
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
        
        // Only add if we have at least a SKU
        if (snapshot.supplierSku) {
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
                const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                
                if (jsonData.length === 0) {
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
                
                // Extract headers
                const firstRow = jsonData[0] as Record<string, any>;
                const headers = Object.keys(firstRow);
                
                // Create mapping
                const { mapping, dateColumns } = createMapping(headers);
                const confidence = calculateConfidence(mapping);
                
                const errors: string[] = [];
                const warnings: string[] = [];
                
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
                    rawData: jsonData.slice(0, 10)  // First 10 rows for preview
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
