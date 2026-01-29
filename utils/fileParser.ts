import * as XLSX from 'xlsx';
import { SupplierStockSnapshot } from '../types';

interface ParseResult {
    success: boolean;
    data?: Partial<SupplierStockSnapshot>[];
    errors?: string[];
    warnings?: string[];
}

// Column mapping dictionary with common aliases
const COLUMN_ALIASES: Record<string, string[]> = {
    supplierSku: ['sku', 'stock code', 'item code', 'product code', 'supplier sku', 'suppliersku', 'code'],
    productName: ['product', 'product name', 'item name', 'description', 'item', 'name'],
    stockOnHand: ['soh', 'stock on hand', 'stock', 'quantity', 'qty', 'on hand', 'stock_on_hand'],
    availableQty: ['available', 'avail', 'available qty', 'available stock', 'avail qty', 'available_qty'],
    committedQty: ['committed', 'committed qty', 'allocated', 'committed_qty'],
    backOrderedQty: ['back ordered', 'backorder', 'back order qty', 'backorder qty', 'back_ordered_qty'],
    customerStockCode: ['customer code', 'customer stock code', 'cust code', 'customer sku', 'customer_stock_code']
};

/**
 * Normalizes a header string for matching
 */
function normalizeHeader(header: string): string {
    return header.toLowerCase().trim().replace(/[_\s-]+/g, ' ');
}

/**
 * Maps a raw header to a known field
 */
function mapHeader(rawHeader: string): string | null {
    const normalized = normalizeHeader(rawHeader);
    
    for (const [fieldName, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.some(alias => normalized === normalizeHeader(alias))) {
            return fieldName;
        }
    }
    
    return null;
}

/**
 * Parses stock file (Excel, CSV, TSV) and returns structured data
 */
export function parseStockFile(file: File): Promise<ParseResult> {
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
                        errors: ['The file appears to be empty or has no data rows']
                    });
                    return;
                }
                
                // Analyze headers
                const firstRow = jsonData[0] as Record<string, any>;
                const headers = Object.keys(firstRow);
                const mapping: Record<string, string> = {};
                const unmappedHeaders: string[] = [];
                
                headers.forEach(header => {
                    const mappedField = mapHeader(header);
                    if (mappedField) {
                        mapping[header] = mappedField;
                    } else {
                        unmappedHeaders.push(header);
                    }
                });
                
                // Validate required fields
                const requiredFields = ['supplierSku'];
                const mappedFields = Object.values(mapping);
                const missingFields = requiredFields.filter(f => !mappedFields.includes(f));
                
                if (missingFields.length > 0) {
                    resolve({
                        success: false,
                        errors: [
                            `Missing required columns: ${missingFields.join(', ')}`,
                            `\nExpected columns (one of):`,
                            `  - SKU: ${COLUMN_ALIASES.supplierSku.join(', ')}`,
                            `\nFound columns: ${headers.join(', ')}`
                        ]
                    });
                    return;
                }
                
                // Parse rows
                const parsedData: Partial<SupplierStockSnapshot>[] = [];
                const warnings: string[] = [];
                
                jsonData.forEach((row: any, index) => {
                    const snapshot: Partial<SupplierStockSnapshot> = {};
                    
                    // Map each field
                    Object.entries(mapping).forEach(([originalHeader, fieldName]) => {
                        const value = row[originalHeader];
                        
                        switch (fieldName) {
                            case 'supplierSku':
                                snapshot.supplierSku = String(value).trim();
                                break;
                            case 'productName':
                                snapshot.productName = String(value).trim();
                                break;
                            case 'stockOnHand':
                                snapshot.stockOnHand = parseInt(value) || 0;
                                break;
                            case 'availableQty':
                                snapshot.availableQty = parseInt(value) || 0;
                                break;
                            case 'committedQty':
                                snapshot.committedQty = parseInt(value) || 0;
                                break;
                            case 'backOrderedQty':
                                snapshot.backOrderedQty = parseInt(value) || 0;
                                break;
                            case 'customerStockCode':
                                snapshot.customerStockCode = String(value).trim();
                                break;
                        }
                    });
                    
                    // Validate row has minimum required data
                    if (!snapshot.supplierSku) {
                        warnings.push(`Row ${index + 2}: Skipped (missing SKU)`);
                        return;
                    }
                    
                    parsedData.push(snapshot);
                });
                
                if (parsedData.length === 0) {
                    resolve({
                        success: false,
                        errors: ['No valid data rows found after parsing']
                    });
                    return;
                }
                
                // Add warnings about unmapped columns
                if (unmappedHeaders.length > 0) {
                    warnings.push(`Unmapped columns (ignored): ${unmappedHeaders.join(', ')}`);
                }
                
                resolve({
                    success: true,
                    data: parsedData,
                    warnings: warnings.length > 0 ? warnings : undefined
                });
                
            } catch (error: any) {
                resolve({
                    success: false,
                    errors: [`Failed to parse file: ${error.message}`]
                });
            }
        };
        
        reader.onerror = () => {
            resolve({
                success: false,
                errors: ['Failed to read file']
            });
        };
        
        reader.readAsArrayBuffer(file);
    });
}
