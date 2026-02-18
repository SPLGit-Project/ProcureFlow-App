import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { db } from '../services/db';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, Edit2, Search, X, Calendar, Wand2, ArrowRight, ArrowLeft, Settings, Database, Truck, Link as LinkIcon, Save, Trash2, History } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ItemWizard } from './ItemWizard';
import { Item } from '../types';

// --- Types ---

type MigrationStep = 'UPLOAD' | 'MAP' | 'RESOLVE' | 'PREVIEW' | 'IMPORTING' | 'DONE';

interface ColumnMapping {
    [key: string]: string; // AppFieldID -> ExcelHeader
}

interface MappableField {
    id: string;
    label: string;
    description: string;
    required?: boolean;
    aliases: string[]; // Keywords for fuzzy matching
}

const MAPPABLE_FIELDS: MappableField[] = [
    { id: 'poNum', label: 'PO Number', description: 'Unique identifier for the Purchase Order', required: true, aliases: ['po', 'po #', 'ref', 'order no', 'po number'] },
    { id: 'date', label: 'Order Date', description: 'Date the order was placed', required: true, aliases: ['date', 'order date', 'request date', 'created'] },
    { id: 'site', label: 'Site Name', description: 'Site location for the PO', aliases: ['site', 'location', 'branch', 'project'] },
    { id: 'sku', label: 'Product Code', description: 'SKU / Item Code', required: true, aliases: ['sku', 'product code', 'item code', 'part no', 'code'] },
    { id: 'description', label: 'Item Name / Description', description: 'Product name from supplier file (for reference)', required: false, aliases: ['desc', 'description', 'product name', 'item name'] },

    { id: 'qtyOrdered', label: 'Quantity Ordered', description: 'Total quantity ordered', required: true, aliases: ['qty', 'order qty', 'quantity', 'amount'] },
    // ... (This replaces the block to insert the field) ...

    { id: 'qtyReceived', label: 'Quantity Received', description: 'Total quantity received so far', aliases: ['inc', 'received', 'qty received', 'delivered'] },
    { id: 'unitPrice', label: 'Unit Price', description: 'Cost per unit', aliases: ['price', 'unit price', 'cost', 'rate'] },
    { id: 'totalPrice', label: 'Total Price', description: 'Total line value', aliases: ['total', 'total price', 'value', 'amount $'] },
    { id: 'approver', label: 'Approver Name', description: 'Who approved this PO', aliases: ['approver', 'approved by', 'manager'] },
    { id: 'approvalStatus', label: 'Approval Status', description: 'Current approval status', aliases: ['approval status', 'status'] },
    { id: 'approvalComments', label: 'Approval Comments', description: 'Comments from approver', aliases: ['approval comment', 'reason'] },
    { id: 'goodsReceiptDate', label: 'Goods Receipt Date', description: 'Date goods were physically received', aliases: ['gr date', 'receipt date', 'delivery date', 'received date'] },
    { id: 'capDate', label: 'Capitalized Month', description: 'Month/Date asset was capitalized', aliases: ['cap date', 'capitalized', 'cap month'] },
    { id: 'capComments', label: 'Capitalized Comments', description: 'Comments regarding capitalization', aliases: ['cap comment'] },
    { id: 'assetTag', label: 'Asset Tag', description: 'Historical Asset Tag', aliases: ['asset tag', 'tag', 'asset id'] },
    { id: 'docketNum', label: 'Delivery Docket #', description: 'Delivery Docket Number', aliases: ['docket', 'del docket', 'do #', 'delivery note'] },
    { id: 'invoiceNum', label: 'Invoice #', description: 'Invoice Number (for Finance)', aliases: ['invoice', 'inv #', 'inv no', 'ref'] },
    { id: 'customerName', label: 'Customer Name', description: 'End customer', aliases: ['customer', 'client'] },
    { id: 'comments', label: 'PO Comments', description: 'General comments', aliases: ['comment', 'notes'] },
];

interface ParsedLine {
    _rowIdx: number;
    sku: string;
    description: string;
    qtyOrdered: number;
    qtyReceived: number;
    unitPrice: number;
    totalPrice: number;
    
    // Capitalization
    capDate?: Date;
    capComments?: string;
    assetTag?: string; // Generated or from file

    // Validation / Mapping
    isValid: boolean;
    error?: string;
    mappedItemId?: string; // If manually fixed
    mappedSku?: string;
    
    // Historical Data
    docketNum?: string;
    invoiceNum?: string;
    concurPoNum?: string;
    goodsReceiptDate?: Date;

    // Row-Level Controls
    includeDelivery: boolean;
    includeCap: boolean;
    isNewItem?: boolean;
}

interface ParsedPO {
    poNum: string;
    date: Date;
    status: string;
    lines: ParsedLine[];
    isValid: boolean;
    errors: string[];
    customerName?: string;
    comments?: string;
    reason?: string;
    approver?: string;
    siteName?: string;
    approvalComments?: string;
    approvalStatus?: string;
}

// Levenshtein implementation
const levenshtein = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const AdminMigration = () => {
    const { items, sites, addItem, suppliers, attributeOptions, upsertAttributeOption } = useApp();
    const [step, setStep] = useState<MigrationStep>('UPLOAD');
    
    // Upload State
    const [file, setFile] = useState<File | null>(null);
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<any[]>([]); // Initial JSON parse before logic
    
    // Mapping State
    const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

    // Processing State
    const [previewData, setPreviewData] = useState<ParsedPO[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [allowImportErrors, setAllowImportErrors] = useState(false);
    
    // Resolution State
    const [unknownSkus, setUnknownSkus] = useState<Set<string>>(new Set());
    const [resolutionMap, setResolutionMap] = useState<Record<string, string>>({}); // ExcelSku -> ItemId
    const [searchTerm, setSearchTerm] = useState('');
    
    // Resolution UI State (Lifted from Resolver)
    const [activeSku, setActiveSku] = useState<string>('');
    const [inputValue, setInputValue] = useState(''); // Immediate input
    const [debouncedTerm, setDebouncedTerm] = useState(''); // Search term
    const [isSearching, setIsSearching] = useState(false);

    // Management State
    const [showManager, setShowManager] = useState(false);
    const [savedMappings, setSavedMappings] = useState<Record<string, string>>({});
    const [managerLoading, setManagerLoading] = useState(false);

    // Item Wizard State
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardInitialData, setWizardInitialData] = useState<Partial<Item>>({});

    // Debounce Search Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTerm(inputValue);
            setIsSearching(false);
        }, 300); // 300ms debounce

        if (inputValue !== debouncedTerm) {
            setIsSearching(true);
        }

        return () => clearTimeout(timer);
    }, [inputValue, debouncedTerm]);

    // Handle Map Logic (Lifted)
    const handleMap = (itemId: string) => {
        setResolutionMap(prev => ({ ...prev, [activeSku]: itemId }));
        const remaining = new Set(unknownSkus);
        remaining.delete(activeSku);
        
        // Reset Search
        setInputValue('');
        setDebouncedTerm('');
        
        if (remaining.size === 0) {
            finishResolution();
        } else {
            setUnknownSkus(remaining);
            setActiveSku(Array.from(remaining)[0]);
        }
    };

    // --- Item Wizard Logic ---
    const handleOpenWizard = (sku: string, desc: string) => {
        // Pre-fill data from context
        setWizardInitialData({
            sku,
            name: desc && desc !== 'No description found in file' ? desc : '',
            activeFlag: true
        });
        setIsWizardOpen(true);
    };

    const handleWizardSave = async (itemData: Partial<Item>) => {
        try {
            // Create the new item
            const newItem: Item = {
                ...itemData,
                id: uuidv4(),
                activeFlag: true
            } as Item; // Force type as we expect wizard to provide required fields
            
            await addItem(newItem);
            
            // Immediately resolve the current unknown item with this new ID
            handleMap(newItem.id);
            
            setIsWizardOpen(false);
            setWizardInitialData({});
        } catch (e) {
            console.error(e);
            alert('Failed to save new item');
        }
    };

    const openManager = async () => {
        setShowManager(true);
        setManagerLoading(true);
        try {
            // @ts-ignore
            if (db.getMigrationMappings) {
                // @ts-ignore
                const m = await db.getMigrationMappings();
                setSavedMappings(m);
            }
        } catch (e) { console.error(e); }
        setManagerLoading(false);
    };

    const handleDeleteMapping = async (excelVariant: string) => {
        try {
            // @ts-ignore
            if (db.deleteMigrationMapping) await db.deleteMigrationMapping(excelVariant);
            setSavedMappings(prev => {
                const next = { ...prev };
                delete next[excelVariant];
                return next;
            });
        } catch (e) {
            console.error(e);
            alert('Failed to delete mapping');
        }
    };

    const addLog = (msg: string) => setLogs(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev]);

    // --- STEP 1: UPLOAD & PRE-PARSE ---
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const f = acceptedFiles[0];
            setFile(f);
            preParseHeaders(f);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop, 
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        multiple: false 
    } as unknown as DropzoneOptions);

    const preParseHeaders = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            
            if (json.length > 0) {
                const headers = Object.keys(json[0]);
                setRawHeaders(headers);
                setRawRows(json); // Store raw data for next step
                
                // Trigger Auto-Map
                const autoMap = {};
                MAPPABLE_FIELDS.forEach(field => {
                    // Find best match
                    const bestMatch = headers.find(h => {
                        const hClean = h.toLowerCase().trim();
                        return field.aliases.some(alias => hClean === alias || hClean.includes(alias));
                    });
                    if (bestMatch) {
                        autoMap[field.id] = bestMatch;
                    }
                });
                setColumnMapping(autoMap);
                setStep('MAP');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // --- STEP 2: PARSE & RESOLVE ---
    const excelDateToJSDate = (serial: any) => {
       if (!serial) return undefined;
       if (typeof serial === 'string') return new Date(serial); 
       if (!serial && serial !== 0) return undefined;
       
       const num = parseFloat(serial);
       if (!isNaN(num) && num > 1000) {
           const utc_days  = Math.floor(num - 25569);
           const utc_value = utc_days * 86400;                                        
           return new Date(utc_value * 1000);
       }
       return undefined;
    }

    const runDetailedParse = async () => {
        setIsProcessing(true);
        setLogs([]);
        addLog(`Analyzing ${rawRows.length} rows...`);

        // Fetch Global Mappings
        let knownMappings: Record<string, string> = {};
        try {
            // @ts-ignore
            if (db.getMigrationMappings) knownMappings = await db.getMigrationMappings();
        } catch (err) { console.error('Error fetching mappings', err); }

        const getVal = (row: any, fieldId: string) => {
            const header = columnMapping[fieldId];
            return header ? row[header] : undefined;
        };

        const unknowns = new Set<string>();
        const workingResolutionMap = { ...resolutionMap }; // Keep existing resolutions if re-running

        // 1. First Pass - Identify Unknowns
        rawRows.forEach((row) => {
            const sku = getVal(row, 'sku') ? String(getVal(row, 'sku')).trim() : '';
            if (!sku) return;
            const cleanSku = sku.toLowerCase();
            
            const exactMatch = items.find(i => i.sku.toLowerCase() === cleanSku);
            if (exactMatch) return; // Found

            const mappedId = knownMappings[cleanSku];
            if (mappedId) {
                workingResolutionMap[sku] = mappedId; // Pre-fill resolution
                return;
            }

            // If not found and not mapped, add to unknowns
            if (!workingResolutionMap[sku]) unknowns.add(sku);
        });

        if (unknowns.size > 0) {
            setUnknownSkus(unknowns);
            setResolutionMap(workingResolutionMap);
            setActiveSku(Array.from(unknowns)[0]); // Set initial active SKU!
            setIsProcessing(false);
            setStep('RESOLVE'); // Go to resolution step
            return; 
        }

        // If no unknowns, proceed to Final Construction
        constructPreviewData(rawRows, workingResolutionMap);
    };

    const constructPreviewData = (rows: any[], resolutions: Record<string, string>) => {
        const getVal = (row: any, fieldId: string) => {
            const header = columnMapping[fieldId];
            return header ? row[header] : undefined;
        };

        const poGroups: Record<string, ParsedPO> = {};
        
        rows.forEach((row, idx) => {
             const poNum = getVal(row, 'poNum');
             if (!poNum) return;

             if (!poGroups[poNum]) {
                poGroups[poNum] = {
                    poNum,
                    date: excelDateToJSDate(getVal(row, 'date')) || new Date(),
                    status: 'ACTIVE',
                    lines: [],
                    isValid: true,
                    errors: [],
                    customerName: getVal(row, 'customerName'),
                    comments: getVal(row, 'comments'),
                    reason: undefined,
                    approver: getVal(row, 'approver'),
                    siteName: getVal(row, 'site'),
                    approvalComments: getVal(row, 'approvalComments'),
                    approvalStatus: getVal(row, 'approvalStatus')
                };
            }

            const sku = getVal(row, 'sku') ? String(getVal(row, 'sku')).trim() : '';
            
            // Auto-detect description header if not explicit
            // This is only for fallback/new item creation
            const descHeader = rawHeaders.find(h => h.toLowerCase().includes('desc') || h.toLowerCase().includes('name') || h.toLowerCase().includes('product'));
            let description = descHeader ? row[descHeader] : '';

            let finalItemId: string | undefined;
            let finalMappedSku: string | undefined;
            let isNewItem = false;

            // Resolve Item
            const exactItem = items.find(i => i.sku.toLowerCase() === sku.toLowerCase());
            if (exactItem) {
                finalItemId = exactItem.id;
                description = exactItem.name; // ALWAYS use Master Data description for matches
            } else if (resolutions[sku]) {
                const res = resolutions[sku];
                if (res === 'SKIP') {
                    return; // Skip this line completely
                } else if (res === 'CREATE_NEW') {
                    isNewItem = true;
                    // Keep description from file
                } else {
                    finalItemId = res;
                    const rItem = items.find(i => i.id === finalItemId);
                    if (rItem) {
                        finalMappedSku = rItem.sku;
                        description = rItem.name; // Override with mapped item name
                    }
                }
            }

            const isValid = !!finalItemId || isNewItem;

            const capDate = excelDateToJSDate(getVal(row, 'capDate'));
            const goodsReceiptDate = excelDateToJSDate(getVal(row, 'goodsReceiptDate'));
            const qtyOrdered = Number(getVal(row, 'qtyOrdered')) || 0;
            const qtyReceived = Number(getVal(row, 'qtyReceived')) || 0;

            poGroups[poNum].lines.push({
                _rowIdx: idx + 2,
                sku,
                description,
                qtyOrdered,
                qtyReceived,
                unitPrice: Number(getVal(row, 'unitPrice')) || 0,
                totalPrice: Number(getVal(row, 'totalPrice')) || 0,
                capDate,
                capComments: getVal(row, 'capComments'),
                assetTag: getVal(row, 'assetTag'),
                isValid,
                error: isValid ? undefined : `Unknown SKU: ${sku}`,
                mappedItemId: finalItemId,
                mappedSku: finalMappedSku,
                docketNum: getVal(row, 'docketNum'),
                invoiceNum: getVal(row, 'invoiceNum'),
                goodsReceiptDate,
                includeDelivery: (qtyReceived > 0),
                includeCap: !!capDate,
                isNewItem
            });
        });

        // Loop validation logic
        Object.values(poGroups).forEach(po => {
            const invalidLines = po.lines.filter(l => !l.isValid);
            if (invalidLines.length > 0) {
                po.isValid = false;
                po.errors.push(`${invalidLines.length} invalid lines`);
            }
             // Status logic
             const totalOrdered = po.lines.reduce((s, l) => s + (l.qtyOrdered || 0), 0);
             const totalReceived = po.lines.reduce((s, l) => s + (l.qtyReceived || 0), 0);
             
             let newStatus = 'APPROVED_PENDING_CONCUR';
             if (po.approvalStatus?.toLowerCase().includes('approved')) newStatus = 'APPROVED_PENDING_CONCUR'; 
             
             if (totalReceived >= totalOrdered && totalOrdered > 0) {
                newStatus = 'CLOSED';
             } else if (totalReceived > 0) {
                 newStatus = 'PARTIALLY_RECEIVED';
             }
             po.status = newStatus;
        });

        setPreviewData(Object.values(poGroups));
        setIsProcessing(false);
        setStep('PREVIEW');
    };

    const finishResolution = () => {
        constructPreviewData(rawRows, resolutionMap);
    };

    // --- STEP 3: PREVIEW & COMMIT ---
    const handleCommit = async () => {
        setStep('IMPORTING');
        setLogs([]);
        addLog('Starting Import Transaction...');
        
        // Save New Mappings Memory (Explicit mappings only)
        // Save New Mappings Memory (Explicit mappings only)
        Object.entries(resolutionMap).forEach(([excelSku, itemId]) => {
            // Don't save 'CREATE_NEW' flag (handled via dynamic creation below)
            if (itemId === 'CREATE_NEW') return;

            // 'SKIP' is saved as a special UUID in db.saveMigrationMapping
            // @ts-ignore
            if (db.saveMigrationMapping) db.saveMigrationMapping(excelSku, itemId);
        });

        const DEFAULT_REQUESTER_ID = 'a6e2810c-2b85-4ee1-81cb-a6fe3cc71378'; // Aaron Bell
        const DEFAULT_SITE_ID = sites[0]?.id || '33333333-3333-4333-8333-333333333333';
        // Fallback category for new items (Use first available or a known ID)
        const DEFAULT_CATEGORY_ID = items[0]?.category || '33333333-3333-4333-8333-333333333333'; 

        const createdItemCache: Record<string, string> = {}; // SKU -> UUID
        let successCount = 0;
        let failCount = 0;

        for (const po of previewData) {
            if (!po.isValid && !allowImportErrors) {
                failCount++;
                continue;
            }

            try {
                // PO Header
                const { data: existing } = await supabase.from('po_requests').select('id').eq('display_id', po.poNum).maybeSingle();
                let poId = existing?.id;

                if (!poId) {
                    const totalAmount = po.lines.reduce((sum, l) => sum + (l.totalPrice || 0), 0);
                    let siteId = DEFAULT_SITE_ID;
                    if (po.siteName) {
                        const foundSite = sites.find(s => s.name?.toLowerCase().trim() === po.siteName?.toLowerCase().trim());
                        if (foundSite) siteId = foundSite.id;
                        else addLog(`Warning: Site '${po.siteName}' not found. Used Default.`);
                    }

                    const { data: newPO, error } = await supabase.from('po_requests').insert({
                        display_id: po.poNum,
                        status: po.status,
                        request_date: po.date.toISOString(),
                        requester_id: DEFAULT_REQUESTER_ID,
                        site_id: siteId,
                        total_amount: totalAmount,
                        customer_name: po.customerName || 'Civeo',
                        comments: po.comments
                    }).select().single();
                    if (error) throw error;
                    poId = newPO.id;
                    
                    if (po.approver) {
                        await supabase.from('po_approvals').insert({
                            po_request_id: poId,
                            approver_name: po.approver,
                            action: 'APPROVED',
                            date: po.date.toISOString(),
                            comments: po.approvalComments || 'Historical Approval'
                        });
                    }
                }

                 const deliveryIDMap: Record<string, string> = {};

                 for (const line of po.lines) {
                    let finalItemId = line.mappedItemId;
                    
                    // Handle New Item Creation
                    if (line.isNewItem && !finalItemId) {
                        const cacheKey = line.sku.toLowerCase().trim();
                        if (createdItemCache[cacheKey]) {
                            finalItemId = createdItemCache[cacheKey];
                        } else {
                            // Create it
                            addLog(`Creating new Master Item: ${line.sku}...`);
                            const { data: newItem, error: createError } = await supabase.from('items').insert({
                                sku: line.sku,
                                name: line.description || `Imported Item ${line.sku}`,
                                category_id: DEFAULT_CATEGORY_ID,
                                description: line.description || 'Imported via Migration',
                                uom: 'EACH',
                                status: 'ACTIVE'
                            }).select().single();

                            if (createError) {
                                addLog(`Failed to create item ${line.sku}: ${createError.message}`);
                            } else if (newItem) {
                                finalItemId = newItem.id;
                                createdItemCache[cacheKey] = newItem.id;
                                // Save this link for future runs too!
                                // @ts-ignore
                                if (db.saveMigrationMapping) db.saveMigrationMapping(line.sku, newItem.id);
                            }
                        }
                    }

                    if (!finalItemId && allowImportErrors) {
                         // Fallback creation logic omitted for brevity, focusing on mapping
                         continue; 
                    }
                    if (!finalItemId) continue;

                    const { data: newLine, error: lineErr } = await supabase.from('po_lines').insert({
                        po_request_id: poId,
                        item_id: finalItemId,
                        sku: line.sku, 
                        item_name: line.description || '',
                        quantity_ordered: line.qtyOrdered,
                        quantity_received: line.qtyReceived,
                        unit_price: line.unitPrice,
                        total_price: line.totalPrice
                    }).select().single();

                    if (lineErr) throw lineErr;

                    // Asset Cap
                    if (line.includeCap && line.capDate) {
                        await supabase.from('asset_capitalization').insert({
                            po_line_id: newLine.id,
                            gl_code: 'HISTORICAL',
                            asset_tag: line.assetTag || `AST-${po.poNum}-${line.sku}`,
                            capitalized_date: line.capDate.toISOString(),
                            comments: line.capComments
                        });
                    }

                    // Delivery
                    if (line.includeDelivery && line.qtyReceived > 0) {
                        const docketKey = line.docketNum || `Unknown-${po.poNum}`;
                        let deliveryId = deliveryIDMap[docketKey];
                        
                        if (!deliveryId) {
                            const { data: newDel } = await supabase.from('deliveries').insert({
                                po_request_id: poId,
                                date: (line.goodsReceiptDate || line.capDate || po.date).toISOString(),
                                docket_number: docketKey,
                                received_by: 'Migration'
                            }).select().single();
                            if (newDel) {
                                deliveryId = newDel.id;
                                deliveryIDMap[docketKey] = deliveryId;
                            }
                        }

                    if (deliveryId) {
                        await supabase.from('delivery_lines').insert({
                            delivery_id: deliveryId,
                            po_line_id: newLine.id,
                            quantity: line.qtyReceived,
                            invoice_number: line.invoiceNum // Save Invoice Number
                        });
                    }
                    }
                 }
                 successCount++;
            } catch (err: any) {
                console.error(err);
                addLog(`Failed PO ${po.poNum}: ${err.message}`);
                failCount++;
            }
        }
        
        setStep('DONE');
        alert(`Import Complete. Success: ${successCount}. Failures: ${failCount}`);
    };

    // --- HELPER COMPONENT: RESOLVER ---
    const Resolver = () => {
        // Find suggestions
        const suggestions = useMemo(() => {
            if (!activeSku) return [];

            // 1. Search Mode (Text Search)
            if (debouncedTerm.length >= 2) {
                const term = debouncedTerm.toLowerCase();
                return items
                    .filter(i => (i.sku && i.sku.toLowerCase().includes(term)) || (i.name && i.name.toLowerCase().includes(term)))
                    .slice(0, 10)
                    .map(i => ({ item: i, score: 0 })); // No score needed for specific search
            }

            // 2. Fuzzy Suggestion Mode (Default, only if no search term)
            if (debouncedTerm.length > 0) return []; // Don't show fuzzy if searching but no results yet

            return items.map(i => {
                const sScore = levenshtein(activeSku.toLowerCase(), i.sku.toLowerCase());
                return { item: i, score: sScore };
            }).sort((a,b) => a.score - b.score).slice(0, 5); // Top 5
        }, [activeSku, items, debouncedTerm]);

        // Find sample row for context
        const contextRow = rawRows.find(r => {
             const h = columnMapping['sku'];
             return h && String(r[h]).trim() === activeSku;
        });
        
        // ... (Context Desc Logic remains same) ...
        const mappedDescHeader = columnMapping['description'];
        const contextDesc = useMemo(() => {
            if (!contextRow) return 'No context found';
            if (mappedDescHeader && contextRow[mappedDescHeader]) return contextRow[mappedDescHeader];
            
            const descHeader = rawHeaders.find(h => {
                const lower = h.toLowerCase();
                return (lower.includes('desc') || lower.includes('name') || lower.includes('product')) && !lower.includes('cat'); 
            });
            return descHeader ? contextRow[descHeader] : 'No description found in file';
        }, [contextRow, mappedDescHeader, rawHeaders]);

        const remainingCount = unknownSkus.size;

        return (
             <div className="bg-white dark:bg-[#1e2029] p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl max-w-4xl mx-auto animate-fade-in text-gray-900 dark:text-gray-100">
                 <div className="flex justify-between items-center mb-6">
                     <div>
                         <h2 className="text-2xl font-bold flex items-center gap-3">
                             <Wand2 className="text-[var(--color-brand)]" />
                             Resolve Unknown Items
                         </h2>
                         <p className="text-gray-500">We found <span className="font-bold text-red-500">{remainingCount}</span> items in your file that don't match our Master List.</p>
                     </div>
                     <div className="text-sm text-gray-400">Step 2.5 of 3</div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Left: Unknown Context & Search */}
                     <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-black/20 p-6 rounded-xl border border-gray-200 dark:border-gray-800">
                            <div className="text-xs font-bold uppercase text-gray-500 mb-2">Excel Data</div>
                            <div className="text-3xl font-bold text-[var(--color-brand)] break-all mb-4">{activeSku}</div>
                            <div className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                                <span className="font-bold text-xs uppercase text-gray-400">Description from File</span>
                                <span className="p-2 bg-white dark:bg-black/40 rounded border border-gray-100 dark:border-gray-700 block whitespace-pre-wrap break-words" title={String(contextDesc)}>{contextDesc}</span>
                            </div>
                        </div>

                        {/* Search Input - Debounced */}
                        <div className="relative">
                             <div className="absolute top-3 left-3 text-gray-400">
                                {isSearching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                             </div>
                             <input 
                                type="text"
                                placeholder="Search Master Item List..."
                                autoFocus
                                value={inputValue}
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-black/20 border border-gray-300 dark:border-gray-600 rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-[var(--color-brand)]"
                                onChange={(e) => setInputValue(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <button 
                                onClick={() => handleOpenWizard(activeSku, String(contextDesc))}
                                className="w-full py-4 rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2"
                            >
                                <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 flex items-center justify-center">+</div>
                                Create New Master Item
                            </button>
                            <button 
                                onClick={() => handleMap('SKIP')}
                                className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                            >
                                Ignore / Skip this SKU
                            </button>
                        </div>
                     </div>

                     {/* Right: Smart Suggestions Results */}
                     <div className="space-y-4">
                         <div className="flex justify-between items-center">
                            <div className="text-xs font-bold uppercase text-gray-500">{debouncedTerm ? 'Search Results' : 'Suggested Matches'}</div>
                            {debouncedTerm && <button onClick={() => { setInputValue(''); setDebouncedTerm(''); }} className="text-xs text-[var(--color-brand)]">Clear</button>}
                         </div>
                         
                         <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {suggestions.map(({item, score}) => (
                                <button 
                                    key={item.id}
                                    onClick={() => handleMap(item.id)}
                                    className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 transition-all group bg-white dark:bg-black/20"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="overflow-hidden">
                                            <div className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-[var(--color-brand)] truncate text-lg">{item.sku}</div>
                                            <div className="text-xs text-gray-500 truncate">{item.name}</div>
                                        </div>
                                        {!debouncedTerm && (
                                            <div className="text-[10px] font-mono bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                                                {score === 0 ? 'Exact' : `${score} diff`}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Enhanced Details Grid */}
                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 mt-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                                        {item.category && (
                                            <div><span className="font-semibold text-gray-400">Cat:</span> {item.category}</div>
                                        )}
                                        {item.uom && (
                                            <div><span className="font-semibold text-gray-400">UOM:</span> {item.uom}</div>
                                        )}
                                        {item.stockType && (
                                            <div><span className="font-semibold text-gray-400">Type:</span> {item.stockType}</div>
                                        )}
                                        {item.unitPrice > 0 && (
                                            <div><span className="font-semibold text-gray-400">Cost:</span> ${item.unitPrice.toFixed(2)}</div>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {suggestions.length === 0 && (
                                <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                                    {isSearching ? 'Searching...' : 'No matches found. Try searching or create new.'}
                                </div>
                            )}
                        </div>
                     </div>
                 </div>
                 
                 <div className="mt-8 text-center text-xs text-gray-400">
                     Resolving this item will save it to memory for future imports.
                 </div>
             </div>
        );
    };

    // --- RENDER HELPERS ---
    const toggleDelivery = (poIdx: number, lineIdx: number) => {
        const newData = [...previewData];
        newData[poIdx].lines[lineIdx].includeDelivery = !newData[poIdx].lines[lineIdx].includeDelivery;
        setPreviewData(newData);
    };

    const toggleCap = (poIdx: number, lineIdx: number) => {
        const newData = [...previewData];
        newData[poIdx].lines[lineIdx].includeCap = !newData[poIdx].lines[lineIdx].includeCap;
        setPreviewData(newData);
    };

    // --- UI COMPONENTS ---
    
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header & Controls */}
            <div className="flex justify-between items-center px-4">
                 <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-brand)] to-blue-600 bg-clip-text text-transparent">
                     Data Migration Wizard
                 </h1>
                 <button 
                    onClick={openManager}
                    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[var(--color-brand)] transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                 >
                     <History size={16} /> Manage Saved Memory
                 </button>
            </div>

            {/* Stepper */}
            {step !== 'RESOLVE' && (
                <div className="flex items-center justify-between mb-8 px-4">
                    {['Upload File', 'Map Columns', 'Review & Commit'].map((label, idx) => {
                        const steps: MigrationStep[] = ['UPLOAD', 'MAP', 'PREVIEW'];
                        const currentIdx = steps.indexOf(step === 'IMPORTING' || step === 'DONE' ? 'PREVIEW' : step);
                        const isActive = idx === currentIdx;
                        const isDone = idx < currentIdx;
                        
                        return (
                            <div key={label} className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isActive ? 'bg-[var(--color-brand)] text-white' : isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {isDone ? <CheckCircle size={16} /> : idx + 1}
                                </div>
                                <span className={`font-bold ${isActive ? 'text-[var(--color-brand)]' : 'text-gray-500'}`}>{label}</span>
                                {idx < 2 && <div className="w-12 h-1 bg-gray-200 mx-4" />}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Step 1: Upload */}
            {step === 'UPLOAD' && (
                <div className="bg-white dark:bg-[#1e2029] p-12 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-center">
                    <div {...getRootProps()} className="cursor-pointer">
                        <input {...getInputProps()} />
                        <div className="w-20 h-20 bg-[var(--color-brand)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Upload className="text-[var(--color-brand)]" size={40} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Upload Migration File</h2>
                        <p className="text-gray-500 mb-6">Drag & drop your Excel file here, or click to browse</p>
                        <button className="px-6 py-3 bg-[var(--color-brand)] text-white font-bold rounded-xl hover:opacity-90 transition-opacity">
                            Select File
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Mapping */}
            {step === 'MAP' && (
                <div className="bg-white dark:bg-[#1e2029] p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-fade-in">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-bold mb-1">Map Your Columns</h2>
                            <p className="text-gray-500">Connect your Excel column headers to the correct App fields. Use the sample data to verify.</p>
                        </div>
                        <div className="flex gap-3">
                             <button onClick={() => setStep('UPLOAD')} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-bold text-sm">Cancel</button>
                             <button onClick={runDetailedParse} className="px-6 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg flex items-center gap-2 shadow-lg hover:shadow-xl hover:opacity-90 transition-all">
                                 {isProcessing ? <Loader2 className="animate-spin" /> : 'Next: Analyze Data'} <ArrowRight size={16} />
                             </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Required Fields Group */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">REQUIRED</span>
                                <h3 className="text-sm font-bold text-gray-500">Core Data Points</h3>
                            </div>
                            
                            {MAPPABLE_FIELDS.filter(f => f.required).map(field => {
                                const selectedHeader = columnMapping[field.id];
                                const sampleValue = selectedHeader && rawRows.length > 0 ? rawRows[0][selectedHeader] : null;
                                
                                return (
                                    <div key={field.id} className="relative group">
                                        <div className={`p-4 rounded-xl border-2 transition-all duration-200 ${selectedHeader ? 'border-[var(--color-brand)]/20 bg-[var(--color-brand)]/5' : 'border-gray-100 bg-white dark:bg-[#15171e] dark:border-gray-800'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{field.label}</label>
                                                    <p className="text-xs text-gray-400">{field.description}</p>
                                                </div>
                                                <div className={`w-2 h-2 rounded-full mt-2 ${selectedHeader ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-400'}`} />
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <select 
                                                    value={selectedHeader || ''} 
                                                    onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                    className="flex-1 text-sm border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-[var(--color-brand)] focus:ring-[var(--color-brand)] bg-white dark:bg-gray-700 py-2"
                                                >
                                                    <option value="">-- Select Header --</option>
                                                    {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                
                                                {/* Sample Data Preview */}
                                                <div className="w-1/3 text-right">
                                                    <span className="text-[10px] items-center gap-1 text-gray-400 uppercase font-bold mb-0.5 flex justify-end">Sample <Search size={10}/></span>
                                                    <div className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                                                        {sampleValue !== null && sampleValue !== undefined ? String(sampleValue) : <span className="text-gray-400 italic">Empty</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Optional Fields Group */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">OPTIONAL</span>
                                <h3 className="text-sm font-bold text-gray-500">Enrichment Data</h3>
                            </div>

                            {MAPPABLE_FIELDS.filter(f => !f.required).map(field => {
                                const selectedHeader = columnMapping[field.id];
                                const sampleValue = selectedHeader && rawRows.length > 0 ? rawRows[0][selectedHeader] : null;

                                return (
                                    <div key={field.id} className="relative group">
                                        <div className={`p-4 rounded-xl border transition-all duration-200 ${selectedHeader ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100 bg-white dark:bg-[#15171e] dark:border-gray-800'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{field.label}</label>
                                                    <p className="text-xs text-gray-400">{field.description}</p>
                                                </div>
                                                <div className={`w-2 h-2 rounded-full mt-2 ${selectedHeader ? 'bg-green-500' : 'bg-gray-200'}`} />
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <select 
                                                    value={selectedHeader || ''} 
                                                    onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                    className="flex-1 text-sm border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-[var(--color-brand)] focus:ring-[var(--color-brand)] bg-white dark:bg-gray-700 py-2"
                                                >
                                                    <option value="">-- Ignore --</option>
                                                    {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>

                                                {/* Sample Data Preview */}
                                                <div className="w-1/3 text-right">
                                                     <div className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate bg-gray-50 dark:bg-gray-800 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 h-8 flex items-center justify-end">
                                                        {sampleValue !== null && sampleValue !== undefined ? String(sampleValue) : <span className="text-gray-400 italic text-[10px]">--</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Step 2.5: Resolver */}
            {step === 'RESOLVE' && <Resolver />}

            {/* Step 3: Preview */}
            {(step === 'PREVIEW' || step === 'IMPORTING' || step === 'DONE') && (
                <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col h-[600px] animate-fade-in">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-[#15171e]">
                         <div className="flex items-center gap-4 w-full md:w-auto">
                             <button onClick={() => setStep('MAP')} className="text-gray-500 hover:text-gray-900 transition-colors p-2 hover:bg-gray-200 rounded-lg"><ArrowLeft size={20} /></button>
                             <div>
                                 <h2 className="text-lg font-bold flex items-center gap-2">Import Preview <span className="text-xs font-normal text-gray-500 px-2 py-1 bg-white border rounded-full hidden sm:inline-flex">{previewData.length} Orders</span></h2>
                                 <p className="text-xs text-gray-500 hidden sm:block">
                                     Valid: <span className="text-green-600 font-bold">{previewData.filter(p => p.isValid).length}</span> &bull; 
                                     Issues: <span className="text-red-600 font-bold">{previewData.filter(p => !p.isValid).length}</span>
                                 </p>
                             </div>
                         </div>
                         <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 w-full justify-center sm:w-auto">
                                    <input type="checkbox" checked={allowImportErrors} onChange={e => setAllowImportErrors(e.target.checked)} className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]" />
                                    Force Import Unknowns
                                </label>
                                <button 
                                    onClick={handleCommit}
                                    disabled={step === 'IMPORTING' || step === 'DONE'}
                                    className="px-6 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 w-full sm:w-auto shadow-lg shadow-blue-500/20"
                                >
                                    {step === 'IMPORTING' ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                                    {step === 'DONE' ? 'Import Complete' : 'Commit Import'}
                                </button>
                         </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 space-y-4 bg-gray-50/50 dark:bg-black/10">
                        {previewData.map((po, poIdx) => (
                            <div key={poIdx} className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                                {/* PO Header */}
                                <div className="p-4 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${po.isValid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            {po.isValid ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-gray-100">{po.poNum}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                                <span className="flex items-center gap-1"><Calendar size={10}/> {po.date.toLocaleDateString()}</span>
                                                <span className="hidden sm:inline">&bull;</span>
                                                <span className="truncate max-w-[150px]">{po.siteName || 'Default Site'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {po.approver && (
                                        <div className="text-xs text-gray-400 bg-white dark:bg-black/20 px-2 py-1 rounded border border-gray-100 dark:border-gray-700">
                                            Appr: {po.approver}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Lines List */}
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {po.lines.map((line, lIdx) => (
                                        <div key={lIdx} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                            {/* Item Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${!line.isValid ? 'bg-red-100 text-red-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                        {line.sku}
                                                    </span>
                                                    {line.mappedSku && <ArrowRight size={10} className="text-gray-400" />}
                                                    {line.mappedSku && <span className="font-mono text-xs font-bold text-green-600">{line.mappedSku}</span>}
                                                </div>
                                                <div className="text-sm text-gray-700 dark:text-gray-300 truncate" title={line.description}>
                                                    {line.description || <span className="italic text-gray-400">No Description</span>}
                                                </div>
                                            </div>

                                            {/* Qty & Actions */}
                                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                                                <div className="text-xs text-gray-500 font-mono text-right min-w-[60px]">
                                                    <span className={line.qtyReceived > 0 ? "font-bold text-gray-900 dark:text-gray-100" : ""}>{line.qtyReceived}</span>
                                                    <span className="text-gray-300 mx-1">/</span>
                                                    <span>{line.qtyOrdered}</span>
                                                </div>

                                                <div className="flex gap-1 bg-gray-50 dark:bg-black/20 p-1 rounded-lg border border-gray-100 dark:border-gray-800">
                                                    {/* Delivery Toggle */}
                                                    {line.goodsReceiptDate ? (
                                                        <button 
                                                            onClick={() => toggleDelivery(poIdx, lIdx)}
                                                            title={`Delivery on ${line.goodsReceiptDate.toLocaleDateString()}`}
                                                            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                                                                line.includeDelivery 
                                                                ? 'bg-blue-500 text-white shadow-sm' 
                                                                : 'text-gray-300 hover:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                            }`}
                                                        >
                                                            <Truck size={14} />
                                                        </button>
                                                    ) : <div className="w-8 h-8 flex items-center justify-center opacity-10"><Truck size={14} /></div>}

                                                    {/* Cap Toggle */}
                                                    {line.capDate ? (
                                                        <button 
                                                            onClick={() => toggleCap(poIdx, lIdx)}
                                                            title={`Capitalize: ${line.capDate.toLocaleDateString()}`}
                                                            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                                                                line.includeCap 
                                                                ? 'bg-[var(--color-brand)] text-white shadow-sm' 
                                                                : 'text-gray-300 hover:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                            }`}
                                                        >
                                                            <Database size={14} />
                                                        </button>
                                                    ) : <div className="w-8 h-8 flex items-center justify-center opacity-10"><Database size={14} /></div>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Logs Area */}
            {logs.length > 0 && (
                <div className="bg-black/80 text-green-400 font-mono text-xs p-4 rounded-xl max-h-40 overflow-auto">
                    {logs.map((l, i) => <div key={i}>{l}</div>)}
                </div>
            )}
            {/* Manager Modal */}
            {showManager && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1e2029] w-full max-w-2xl rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold">Migration Memory Manager</h3>
                            <button onClick={() => setShowManager(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {managerLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
                            ) : Object.keys(savedMappings).length === 0 ? (
                                <div className="text-center py-12 text-gray-400">No saved mappings found.</div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="text-gray-500 border-b border-gray-200 dark:border-gray-800">
                                        <tr>
                                            <th className="pb-3">Excel Variant</th>
                                            <th className="pb-3">Mapped To Item</th>
                                            <th className="pb-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {Object.entries(savedMappings).map(([variant, itemId]) => {
                                            const item = items.find(i => i.id === itemId);
                                            return (
                                                <tr key={variant}>
                                                    <td className="py-3 font-medium">{variant}</td>
                                                    <td className="py-3 text-gray-500">
                                                        {item ? (
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-gray-900 dark:text-gray-100">{item.sku}</span>
                                                                <span className="text-xs">{item.name}</span>
                                                            </div>
                                                        ) : <span className="text-red-500">Unknown Item ({itemId})</span>}
                                                    </td>
                                                    <td className="py-3 text-right">
                                                        <button onClick={() => handleDeleteMapping(variant)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Item Wizard Modal */}
            <ItemWizard 
                isOpen={isWizardOpen}
                existingItem={Object.keys(wizardInitialData).length > 0 ? wizardInitialData as Item : null}
                onSave={handleWizardSave}
                onClose={() => setIsWizardOpen(false)}
                suppliers={suppliers}
                attributeOptions={attributeOptions}
                upsertAttributeOption={upsertAttributeOption}
            />
        </div>
    );
};

export default AdminMigration;
