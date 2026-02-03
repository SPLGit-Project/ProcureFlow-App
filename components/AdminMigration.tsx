import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { db } from '../services/db';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, Edit2, Search, X, Calendar, Wand2, ArrowRight, ArrowLeft, Settings, Database, Truck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// --- Types ---

type MigrationStep = 'UPLOAD' | 'MAP' | 'PREVIEW' | 'IMPORTING' | 'DONE';

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
    { id: 'sku', label: 'Product Code', description: 'SKU / Item Code', required: true, aliases: ['sku', 'product code', 'item code', 'part no'] },
    { id: 'description', label: 'Product Description', description: 'Item description', aliases: ['description', 'product name', 'item name'] },
    { id: 'qtyOrdered', label: 'Quantity Ordered', description: 'Total quantity ordered', required: true, aliases: ['qty', 'order qty', 'quantity', 'amount'] },
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
    { id: 'docketNum', label: 'Docket / Invoice #', description: 'Delivery Docket or Invoice Number', aliases: ['docket', 'invoice', 'inv #', 'ref'] },
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
    const { items, sites } = useApp();
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
    
    // Helper State
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [mappingTargetSku, setMappingTargetSku] = useState<string>('');
    const [suggestions, setSuggestions] = useState<{ item: any, score: number }[]>([]);


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

    // --- STEP 2: PARSE WITH MAPPING ---
    const excelDateToJSDate = (serial: any) => {
       if (!serial) return undefined;
       if (typeof serial === 'string') return new Date(serial); 
       // Check if likely a serial number (Excel dates usually > 20000)
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
        addLog(`Processing ${rawRows.length} rows with user mapping...`);

        // Fetch Global Mappings
        let knownMappings: Record<string, string> = {};
        try {
            // @ts-ignore
            if (db.getMigrationMappings) knownMappings = await db.getMigrationMappings();
        } catch (err) { console.error(err); }

        const getVal = (row: any, fieldId: string) => {
            const header = columnMapping[fieldId];
            return header ? row[header] : undefined;
        };

        const poGroups: Record<string, ParsedPO> = {};

        rawRows.forEach((row, idx) => {
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
                    reason: undefined, // Removed form Mappable for brevity if needed
                    approver: getVal(row, 'approver'),
                    siteName: getVal(row, 'site'),
                    approvalComments: getVal(row, 'approvalComments'),
                    approvalStatus: getVal(row, 'approvalStatus')
                };
            }

            // Line Logic
            const sku = getVal(row, 'sku') ? String(getVal(row, 'sku')).trim() : '';
            let item = items.find(i => i.sku === sku);
            let mappedItemId: string | undefined;
            let mappedSku: string | undefined;

            if (!item) {
                const cleanSku = sku.toLowerCase();
                if (knownMappings[cleanSku]) {
                    const foundId = knownMappings[cleanSku];
                    const foundItem = items.find(i => i.id === foundId);
                    if (foundItem) {
                        mappedItemId = foundItem.id;
                        mappedSku = foundItem.sku;
                    }
                }
            }

            const isValid = !!item || !!mappedItemId;
            
            // Dates
            const capDate = excelDateToJSDate(getVal(row, 'capDate'));
            const goodsReceiptDate = excelDateToJSDate(getVal(row, 'goodsReceiptDate'));
            
            // Qty
            const qtyOrdered = Number(getVal(row, 'qtyOrdered')) || 0;
            const qtyReceived = Number(getVal(row, 'qtyReceived')) || 0;

            poGroups[poNum].lines.push({
                _rowIdx: idx + 2,
                sku,
                description: getVal(row, 'description'),
                qtyOrdered,
                qtyReceived,
                unitPrice: Number(getVal(row, 'unitPrice')) || 0,
                totalPrice: Number(getVal(row, 'totalPrice')) || 0,
                capDate,
                capComments: getVal(row, 'capComments'),
                assetTag: getVal(row, 'assetTag'),
                isValid,
                error: isValid ? undefined : `Unknown SKU: ${sku}`,
                mappedItemId,
                mappedSku,
                docketNum: getVal(row, 'docketNum'),
                invoiceNum: getVal(row, 'docketNum'), // Reuse if invoice specific field missing
                
                // New Fields
                goodsReceiptDate,
                includeDelivery: (qtyReceived > 0), // Default to true if received > 0
                includeCap: !!capDate // Default to true if cap date exists
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
             if (po.approvalStatus?.toLowerCase().includes('approved')) newStatus = 'APPROVED_PENDING_CONCUR'; // Keep active
             
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

    // --- STEP 3: PREVIEW & COMMIT ---
    const handleCommit = async () => {
        setStep('IMPORTING');
        setLogs([]);
        addLog('Starting Import Transaction...');
        
        const DEFAULT_REQUESTER_ID = 'a6e2810c-2b85-4ee1-81cb-a6fe3cc71378'; // Aaron Bell
        const DEFAULT_SITE_ID = sites[0]?.id || '33333333-3333-4333-8333-333333333333';

        let successCount = 0;
        let failCount = 0;

        for (const po of previewData) {
            if (!po.isValid && !allowImportErrors) {
                failCount++;
                continue;
            }

            try {
                // 1. PO Header
                const { data: existing } = await supabase.from('po_requests').select('id').eq('display_id', po.poNum).maybeSingle();
                let poId = existing?.id;

                if (!poId) {
                    const totalAmount = po.lines.reduce((sum, l) => sum + (l.totalPrice || 0), 0);
                    
                    // Smart Site Lookup
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
                    
                    // Approval
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

                 // Track Created Delivery Headers: { "docketNum": "delivery_id" }
                 const deliveryIDMap: Record<string, string> = {};

                 for (const line of po.lines) {
                    // Item Resolve
                    let finalItemId = line.mappedItemId;
                    if (!finalItemId) {
                         const item = items.find(i => i.sku === line.sku);
                         if (item) finalItemId = item.id;
                    }
                    if (!finalItemId && allowImportErrors) {
                        const placeholderSku = `UNMATCHED_${line.sku}`;
                        // See if exists
                        const {data} = await supabase.from('items').select('id').eq('sku', placeholderSku).maybeSingle();
                        if (data) finalItemId = data.id;
                        else {
                            // Create
                            const {data: newItem} = await supabase.from('items').insert({
                                id: uuidv4(),
                                name: `Unmatched: ${line.sku}`,
                                sku: placeholderSku,
                                description: 'Auto-created import',
                                category: 'Unmatched',
                                uom: 'EACH',
                                status: 'ACTIVE',
                                supplierId: 'unknown',
                                unitPrice: 0
                            }).select().single();
                            if (newItem) finalItemId = newItem.id;
                        }
                    }

                    if (!finalItemId) continue;

                    const { data: newLine, error: lineErr } = await supabase.from('po_lines').insert({
                        po_request_id: poId,
                        item_id: finalItemId,
                        sku: line.sku, // Keep original SKU for reference effectively
                        item_name: line.description,
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
                                quantity: line.qtyReceived
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

    // --- RENDER HELPERS ---
    const toggleDelivery = (poIdx: number, lineIdx: number) => {
        const newData = [...previewData];
        newData[poIdx].lines[lineIdx].includeDelivery = !newData[poIdx].lines[lineIdx].includeDelivery;
        setPreviewData(newData);
    };

    // --- UI COMPONENTS ---
    
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Stepper */}
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
                <div className="bg-white dark:bg-[#1e2029] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold">Map Your Columns</h2>
                        <div className="flex gap-2">
                             <button onClick={() => setStep('UPLOAD')} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-bold text-sm">Cancel</button>
                             <button onClick={runDetailedParse} className="px-6 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg flex items-center gap-2">
                                 Next: Preview Data <ArrowRight size={16} />
                             </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold uppercase text-gray-500 mb-4">Required Fields</h3>
                            {MAPPABLE_FIELDS.filter(f => f.required).map(field => (
                                <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#15171e] rounded-lg border border-gray-200 dark:border-gray-800">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${columnMapping[field.id] ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{field.label}</p>
                                            <p className="text-xs text-gray-500">{field.description}</p>
                                        </div>
                                    </div>
                                    <select 
                                        value={columnMapping[field.id] || ''} 
                                        onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-[var(--color-brand)] focus:ring-[var(--color-brand)] bg-white dark:bg-black/20 min-w-[150px]"
                                    >
                                        <option value="">-- Select Header --</option>
                                        {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                        
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold uppercase text-gray-500 mb-4">Optional Enrichment</h3>
                            {MAPPABLE_FIELDS.filter(f => !f.required).map(field => (
                                <div key={field.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#1e2029] rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${columnMapping[field.id] ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{field.label}</p>
                                            <p className="text-xs text-gray-500">{field.description}</p>
                                        </div>
                                    </div>
                                    <select 
                                        value={columnMapping[field.id] || ''} 
                                        onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-[var(--color-brand)] focus:ring-[var(--color-brand)] bg-white dark:bg-black/20 min-w-[150px]"
                                    >
                                        <option value="">-- Ignore --</option>
                                        {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Preview */}
            {(step === 'PREVIEW' || step === 'IMPORTING' || step === 'DONE') && (
                <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-[#15171e]">
                         <div className="flex items-center gap-4">
                             <button onClick={() => setStep('MAP')} className="text-gray-500 hover:text-gray-900"><ArrowLeft /></button>
                             <div>
                                 <h2 className="text-lg font-bold">Import Preview</h2>
                                 <p className="text-xs text-gray-500">
                                     Found <span className="font-bold">{previewData.length} POs</span>.
                                     Valid: <span className="text-green-600 font-bold">{previewData.filter(p => p.isValid).length}</span>.
                                     Issues: <span className="text-red-600 font-bold">{previewData.filter(p => !p.isValid).length}</span>
                                 </p>
                             </div>
                         </div>
                         <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50">
                                    <input type="checkbox" checked={allowImportErrors} onChange={e => setAllowImportErrors(e.target.checked)} />
                                    Force Import Unknown SKUs
                                </label>
                                <button 
                                    onClick={handleCommit}
                                    disabled={step === 'IMPORTING' || step === 'DONE'}
                                    className="px-6 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                                >
                                    {step === 'IMPORTING' ? <Loader2 className="animate-spin" /> : <Database size={16} />}
                                    {step === 'DONE' ? 'Import Complete' : 'Commit Import'}
                                </button>
                         </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Status</th>
                                    <th className="px-4 py-3">PO Details</th>
                                    <th className="px-4 py-3">Site / Approver</th>
                                    <th className="px-4 py-3">Lines</th>
                                    <th className="px-4 py-3">Data Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {previewData.map((po, poIdx) => (
                                    <tr key={poIdx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-4 align-top w-12 text-center">
                                            {po.isValid ? <CheckCircle size={18} className="text-green-500 mx-auto"/> : <AlertTriangle size={18} className="text-red-500 mx-auto"/>}
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <div className="font-bold text-gray-900 dark:text-gray-100">{po.poNum}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={10}/> {po.date.toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                             <div className="font-medium">{po.siteName || <span className="text-amber-500 italic">Default</span>}</div>
                                             <div className="text-xs text-gray-500">{po.approver}</div>
                                        </td>
                                        <td className="px-4 py-4 align-top max-w-md">
                                            <div className="space-y-2">
                                                {po.lines.map((line, lIdx) => (
                                                    <div key={lIdx} className={`p-2 rounded border ${line.isValid ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50'}`}>
                                                        <div className="flex justify-between">
                                                            <span className={`font-mono text-xs font-bold ${!line.isValid ? 'text-red-700' : ''}`}>
                                                                {line.sku} {line.mappedSku && <span className="text-green-600">→ {line.mappedSku}</span>}
                                                            </span>
                                                            <span className="text-xs">{line.qtyReceived}/{line.qtyOrdered}</span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 truncate">{line.description}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            {/* Row Level Controls */}
                                            {po.lines.map((line, lIdx) => (
                                                <div key={lIdx} className="mb-2 h-[58px] flex flax-col justify-center">
                                                    <div className="flex flex-col gap-1">
                                                        {line.goodsReceiptDate && (
                                                            <label title={`Received on ${line.goodsReceiptDate.toLocaleDateString()}`} className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded cursor-pointer border ${line.includeDelivery ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                                                <input type="checkbox" checked={line.includeDelivery} onChange={() => toggleDelivery(poIdx, lIdx)} />
                                                                <Truck size={10} /> Delivery Rec
                                                            </label>
                                                        )}
                                                        {line.capDate && (
                                                            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200 flex items-center gap-1">
                                                                <Database size={10} /> Asset Cap
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {/* Logs Area */}
            {logs.length > 0 && (
                <div className="bg-black/80 text-green-400 font-mono text-xs p-4 rounded-xl max-h-40 overflow-auto">
                    {logs.map((l, i) => <div key={i}>{l}</div>)}
                </div>
            )}
        </div>
    );
};

export default AdminMigration;
