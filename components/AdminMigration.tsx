
import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { db } from '../services/db';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, Edit2, Search, X, Calendar, Wand2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface AdminMigrationProps {
}

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
    // New: Original Status Logic
    isPartial?: boolean;
    // New: Historical Data
    docketNum?: string;
    invoiceNum?: string;
    concurPoNum?: string;
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
    const { items, sites, addItem } = useApp();
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<ParsedPO[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'PARSING' | 'READY' | 'COMMITTING' | 'DONE' | 'ERROR'>('IDLE');
    const [logs, setLogs] = useState<string[]>([]);
    const [allowImportErrors, setAllowImportErrors] = useState(false);
    
    // Mapping Modal State
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [mappingTargetSku, setMappingTargetSku] = useState<string>('');
    const [mappingSearch, setMappingSearch] = useState('');
    const [suggestions, setSuggestions] = useState<{ item: any, score: number }[]>([]);

    // Date Edit Modal State
    const [isDateEditOpen, setIsDateEditOpen] = useState(false);
    const [editingDateLine, setEditingDateLine] = useState<{ poNum: string, lineIdx: number, date?: string } | null>(null);


    const addLog = (msg: string) => setLogs(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            handleParse(acceptedFiles[0]);
        }
    }, [items]); // Rely on items for initial validation

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop, 
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        multiple: false 
    } as unknown as DropzoneOptions);

    const excelDateToJSDate = (serial: any) => {
       if (!serial) return undefined;
       if (typeof serial === 'string') return new Date(serial); // Attempt normal parse if invalid excel date
       const utc_days  = Math.floor(serial - 25569);
       const utc_value = utc_days * 86400;                                        
       return new Date(utc_value * 1000);
    }

    const handleParse = async (fileToParse: File) => {
        setUploadStatus('PARSING');
        setPreviewData([]);
        setLogs([]);
        addLog(`Parsing file: ${fileToParse.name}`);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

                addLog(`Found ${rows.length} rows.`);

                addLog(`Found ${rows.length} rows.`);

                // Fetch Global Migration Mappings
                let knownMappings: Record<string, string> = {};
                addLog('Fetching existing migration mappings...');
                try {
                    knownMappings = await db.getMigrationMappings();
                    addLog(`Loaded ${Object.keys(knownMappings).length} known mappings.`);
                } catch (err) {
                    console.error('Failed to load mappings', err);
                }


                
                // Group by PO
                const poGroups: Record<string, ParsedPO> = {};
                
                rows.forEach((row, idx) => {
                    const poNum = row['PO #'];
                    if (!poNum) return;

                    if (!poGroups[poNum]) {
                        // Smart Status Logic
                        // We will calculate this after lines are added, or defaulted here.
                        // Actually, we need to sum lines to know real status?
                        // Let's set default here and update later.
                        poGroups[poNum] = {
                            poNum,
                            date: excelDateToJSDate(row['Order Date']) || new Date(),
                            status: 'ACTIVE', // Default, will refine
                            lines: [],
                            isValid: true,
                            errors: [],
                            customerName: row['Customer Name'],
                            comments: row['Comments'],
                            reason: row['Purchase Order Reason'],
                            approver: row['Approver']
                        };
                    }

                    // Line parsing
                    const sku = row['Product Code'] ? String(row['Product Code']).trim() : '';
                    let item = items.find(i => i.sku === sku);
                    
                    let mappedItemId: string | undefined;
                    let mappedSku: string | undefined;



                    // Try Known Global Mapping
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

                    // Cap Data
                    let capDate = excelDateToJSDate(row['Capitalized Month']);

                    poGroups[poNum].lines.push({
                        _rowIdx: idx + 2,
                        sku,
                        description: row['Product Description'],
                        qtyOrdered: row['Order QTY'] || 0,
                        qtyReceived: row['QTY Received'] || (row['Order Status'] === 'Received in Full' ? (row['Order QTY'] || 0) : 0),
                        unitPrice: row['Unit Price'] || 0,
                        totalPrice: row['Total Order Price'] || 0,
                        capDate,
                        capComments: row['Capitalized Comments'],
                        assetTag: row['Asset Tag'], // If exists in sheet
                        isValid,
                        error: isValid ? undefined : `Unknown SKU: ${sku}`,
                        mappedItemId,
                        mappedSku,
                        docketNum: row['Inv #'] || row['Delivery Docket'], // Prioritize Inv # for Docket as header
                        invoiceNum: row['Inv #'],
                        concurPoNum: row['Concur PO']
                    });
                });

                // Post-process Validation
                Object.values(poGroups).forEach(po => {
                    const invalidLines = po.lines.filter(l => !l.isValid);
                    if (invalidLines.length > 0) {
                        po.isValid = false;
                        po.errors.push(`${invalidLines.length} invalid lines (Unknown SKUs)`);
                    }

                    // Refine Status based on Quantities
                    // Refine Status based on Concur & Quantities
                    const totalOrdered = po.lines.reduce((s, l) => s + (l.qtyOrdered || 0), 0);
                    const totalReceived = po.lines.reduce((s, l) => s + (l.qtyReceived || 0), 0);
                    const hasConcur = po.lines.some(l => !!l.concurPoNum); // Check if any line has Concur #

                    // Base status
                    let newStatus = hasConcur ? 'ACTIVE' : 'APPROVED_PENDING_CONCUR';

                    if (totalReceived >= totalOrdered && totalOrdered > 0) {
                         newStatus = 'CLOSED'; // Was COMPLETED, fixed to CLOSED for type safety
                    } else if (totalReceived > 0) {
                        newStatus = 'PARTIALLY_RECEIVED'; // Explicitly set partial
                    }
                    
                    po.status = newStatus;
                });

                setPreviewData(Object.values(poGroups));
                setUploadStatus('READY');
                addLog(`Parsed ${Object.keys(poGroups).length} POs.`);

            } catch (err: any) {
                console.error(err);
                addLog(`Error parsing: ${err.message}`);
                setUploadStatus('ERROR');
            }
        };
        reader.readAsArrayBuffer(fileToParse);
    };

    // --- Fuzzy Matching & Suggestions ---
    const generateSuggestions = (targetSku: string) => {
        if (!targetSku) return;
        const target = targetSku.toLowerCase();
        
        const scored = items.map(item => {
            // Enhanced Matching:
            // 1. Strip common suffixes like (RFID), -RFID, etc from BOTH
            const clean = (s: string) => s.toLowerCase().replace(/[\(\)\-_\s]rfid/g, '').replace(/[\(\)\-_\s]colour/g, '').trim();
            
            const tClean = clean(target);
            const iClean = clean(item.sku || '');
            const iNameClean = clean(item.name || '');

            const skuScore = levenshtein(tClean, iClean);
            const nameScore = levenshtein(tClean, iNameClean);
            
            // Normalize score (0-1, 1 is best)
            // Length based normalization
            const maxLenSku = Math.max(tClean.length, iClean.length);
            let normSku = 1 - (skuScore / maxLenSku);

            const maxLenName = Math.max(tClean.length, iNameClean.length);
            const normName = 1 - (nameScore / maxLenName);

            // Boosts
            if (iClean.includes(tClean) || tClean.includes(iClean)) {
                normSku += 0.2; // Significant boost for containment (e.g. PCC1 inside PCC1RFID)
            }

            return {
                item,
                score: Math.max(normSku, normName * 0.8) // Bias towards SKU match
            };
        });

        // Filter valid suggestions (> 0.4) and sort
        const top = scored
            .filter(s => s.score > 0.4)
            .sort((a,b) => b.score - a.score)
            .slice(0, 5);
        
        setSuggestions(top);
    };

    // --- Mapping Logic ---
    const openMappingModal = (invalidSku: string) => {
        setMappingTargetSku(invalidSku);
        setMappingSearch('');
        generateSuggestions(invalidSku);
        setIsMappingModalOpen(true);
    };

    const applyMapping = async (newItemId: string) => {
        const newItem = items.find(i => i.id === newItemId);
        if (!newItem) return;

        // Normalization helper for robust matching
        // Removes all whitespace and casing issues
        const normalize = (str: string) => str.toLowerCase().replace(/[\s\u00A0_-]+/g, '');
        const target = normalize(mappingTargetSku);

        let updateCount = 0;

        // Calculate functionality synchronously using current state
        // This ensures consistent application and accurate counting
        const nextPreviewData = previewData.map(po => {
            let poModified = false;
            const newLines = po.lines.map(line => {
                // Check against normalized target
                // Also check if line is invalid OR if it's the exact target we are fixing
                // (Even if somehow marked valid, if we are explicitly fixing it, we should update it)
                const lineSkuNorm = normalize(line.sku);
                
                if (lineSkuNorm === target && (!line.isValid || line.mappedItemId !== newItem.id)) {
                    poModified = true;
                    updateCount++;
                    return {
                        ...line,
                        isValid: true,
                        error: undefined,
                        mappedItemId: newItem.id,
                        mappedSku: newItem.sku
                    };
                }
                return line;
            });

            if (poModified) {
                const stillInvalid = newLines.some(l => !l.isValid);
                return {
                    ...po,
                    lines: newLines,
                    isValid: !stillInvalid,
                    errors: stillInvalid ? [`${newLines.filter(l => !l.isValid).length} invalid lines left`] : [] 
                };
            }
            return po;
        });

        if (updateCount === 0) {
            // Fallback debugging
            console.log('Smart Fix Failed. Target:', target);
            console.log('Available Invalid SKUs:', previewData.flatMap(p => p.lines.filter(l => !l.isValid).map(l => normalize(l.sku))));
            alert(`No matches found for '${mappingTargetSku}'. This might be an exact string mismatch.`);
            return;
        }

        setPreviewData(nextPreviewData);

        // Persistent Mapping Update (Global)
        try {
            await db.saveMigrationMapping(mappingTargetSku, newItemId);
            addLog(`Saved global mapping for future imports.`);
        } catch (err) {
            console.error('Failed to save mapping', err);
        }
        
        addLog(`Smart Fix: Mapped ${updateCount} occurrences of '${mappingTargetSku}' to '${newItem.sku}'`);
        // Small delay to ensure UI render before alert (optional, but good UX)

        setTimeout(() => {
             alert(`Successfully mapped ${updateCount} items to ${newItem.sku}`);
        }, 100);
        
        setIsMappingModalOpen(false);
    };

    // --- Date Editing ---
    const openDateEdit = (po: ParsedPO, lineIdx: number) => {
        const line = po.lines[lineIdx];
        setEditingDateLine({
            poNum: po.poNum,
            lineIdx,
            date: line.capDate ? line.capDate.toISOString().split('T')[0] : ''
        });
        setIsDateEditOpen(true);
    };

    const saveDateEdit = () => {
        if (!editingDateLine) return;
        
        setPreviewData(prev => prev.map(po => {
            if (po.poNum !== editingDateLine.poNum) return po;
            const newLines = [...po.lines];
            const line = newLines[editingDateLine.lineIdx];
            
            // Update line
            newLines[editingDateLine.lineIdx] = {
                ...line,
                capDate: editingDateLine.date ? new Date(editingDateLine.date) : undefined
            };

            return { ...po, lines: newLines };
        }));

        setIsDateEditOpen(false);
        setEditingDateLine(null);
    };


    // --- Commit Logic ---
    const handleCommit = async () => {
        if (uploadStatus !== 'READY') return;
        setUploadStatus('COMMITTING');
        setIsProcessing(true);
        addLog('Starting import...');

        const DEFAULT_REQUESTER_ID = 'a6e2810c-2b85-4ee1-81cb-a6fe3cc71378'; // Aaron Bell
        const DEFAULT_SITE_ID = sites[0]?.id || '33333333-3333-4333-8333-333333333333';

        let successCount = 0;
        let failCount = 0;
        let createdItemsCount = 0;

        // Pre-flight: Create Unmatched Items if needed
        const uniqueUnknownSkus = new Set<string>();
        if (allowImportErrors) {
            previewData.forEach(po => {
                po.lines.forEach(line => {
                    if (!line.isValid && !line.mappedItemId) {
                        uniqueUnknownSkus.add(line.sku);
                    }
                });
            });

            if (uniqueUnknownSkus.size > 0) {
                addLog(`Creating ${uniqueUnknownSkus.size} placeholder items for unknown SKUs...`);
                // Process sequentially to be safe with DB
                for (const sku of Array.from(uniqueUnknownSkus)) {
                    // Check if already exists (incase run twice)
                    const existing = items.find(i => i.sku === `UNMATCHED_${sku}`);
                    if (!existing) {
                        // Create it
                        try {
                            const newId = uuidv4();
                            const newPlaceholder = {
                                id: newId,
                                name: `Unmatched Import: ${sku}`,
                                sku: `UNMATCHED_${sku}`, // Safe key
                                description: `Automatically created during migration for unknown SKU: ${sku}`,
                                category: 'Unmatched Import',
                                uom: 'EACH',
                                status: 'ACTIVE',
                                supplierId: 'unknown',
                                unitPrice: 0
                            };
                            
                            // Insert to DB
                            const { error } = await supabase.from('items').insert(newPlaceholder);
                            if (error) {
                                console.error('Failed to create placeholder', error);
                                addLog(`Failed to create placeholder for ${sku}`);
                            } else {
                                // Update local cache so we can find it in the loop below
                                // Actually we should add it to 'items' context but reloadData might be slow.
                                // We'll just rely on DB fetch or local array for now, but simple valid lookup in loop:
                                createdItemsCount++;
                            }
                        } catch (e) { console.error(e); }
                    }
                }
                // Refresh items to ensure we can find them below? 
                // Alternatively, we just know the schema `UNMATCHED_${sku}` and hope validation passes or we fetch id?
                // Better to simple fetch them or assume success and insert using known ID if we generated it?
                // Let's assume we can query them or just try to insert PO Line with new ID if we tracked it.
                // Re-fetching items is safest.
                // But simplified: We insert them now. In the loop, if isValid is false, we look for `UNMATCHED_${sku}` in *refreshed* list?
                // Or just standard fallback logic.
            }
        }

        // We need the items to be available.
        // Let's reload items quickly? Or just handle ID resolution manually in loop.
        // Loop approach:
        
        for (const po of previewData) {
            // Skip ONLY if still invalid AND errors not allowed
            if (!po.isValid && !allowImportErrors) {
                addLog(`Skipping Invalid PO: ${po.poNum}`);
                failCount++;
                continue;
            }

            try {
                // 1. Check / Create Header
                const { data: existing } = await supabase.from('po_requests').select('id').eq('display_id', po.poNum).maybeSingle();
                let poId = existing?.id;
                
                if (!poId) {
                    const totalAmount = po.lines.reduce((sum, l) => sum + (l.totalPrice || 0), 0);
                    
                    const { data: newPO, error: poErr } = await supabase.from('po_requests').insert({
                        display_id: po.poNum,
                        status: po.status,
                        request_date: po.date.toISOString(),
                        requester_id: DEFAULT_REQUESTER_ID,
                        site_id: DEFAULT_SITE_ID,
                        total_amount: totalAmount,
                        customer_name: po.customerName || 'Civeo',
                        reason_for_request: po.reason || 'Historical Import',
                        comments: po.comments
                    }).select().single();

                    if (poErr) throw poErr;
                    if (poErr) throw poErr;
                    poId = newPO.id;

                    // 1b. Insert Approval
                    if (po.approver) {
                         await supabase.from('po_approvals').insert({
                            po_request_id: poId,
                            approver_name: po.approver,
                            action: 'APPROVED',
                            date: po.date.toISOString(), 
                            comments: 'Historical Approval'
                        });
                    }
                }
                
                // Track Created Delivery Headers: { "docketNum": "delivery_id" }
                const deliveryIDMap: Record<string, string> = {};

                // 2. Lines
                for (const line of po.lines) {
                    // Item ID resolution
                    let finalItemId = line.mappedItemId;
                    let finalSku = line.mappedSku;
                    
                    if (!finalItemId) {
                         const item = items.find(i => i.sku === line.sku);
                         if (item) {
                             finalItemId = item.id;
                             finalSku = item.sku;
                         } else if (allowImportErrors) {
                             // Try to find the placeholder we just created
                             // We constructed SKU as `UNMATCHED_${line.sku}`
                             // We need to fetch its ID.
                             // Optimization: We could have stored map. 
                             // Fallback: SELECT id FROM items WHERE sku = ...
                             const { data: placeholder, error } = await supabase.from('items').select('id, sku').eq('sku', `UNMATCHED_${line.sku}`).maybeSingle();
                             if (placeholder) {
                                 finalItemId = placeholder.id;
                                 finalSku = placeholder.sku;
                             }
                         }
                    }

                    if (!finalItemId) {
                         addLog(`Error: Could not resolve item for line ${line.sku} in PO ${po.poNum} (Skipping Line)`);
                         continue; 
                    }

                    const { data: newLine, error: lineErr } = await supabase.from('po_lines').insert({
                        po_request_id: poId,
                        item_id: finalItemId,
                        sku: finalSku,
                        item_name: line.description,
                        quantity_ordered: line.qtyOrdered,
                        quantity_received: line.qtyReceived,
                        unit_price: line.unitPrice,
                        total_price: line.totalPrice,
                        concur_po_number: line.concurPoNum
                    }).select().single();

                    if (lineErr) throw lineErr;

                    // 3. Asset Capitalization
                    if (line.capDate) {
                        await supabase.from('asset_capitalization').insert({
                            po_line_id: newLine.id,
                            gl_code: 'HISTORICAL',
                            asset_tag: line.assetTag || `AST-${po.poNum}-${finalSku}`,
                            capitalized_date: line.capDate.toISOString(),
                            comments: line.capComments
                        });
                    }

                    // 4. Delivery Creation
                     if (line.qtyReceived > 0) {
                         const docketKey = line.docketNum || `Unknown`;
                         
                         let deliveryId = deliveryIDMap[docketKey];
                         if (!deliveryId) {
                             // Create Header
                             const { data: newDel, error: delErr } = await supabase.from('deliveries').insert({
                                 po_request_id: poId,
                                 date: (line.capDate || po.date).toISOString(),
                                 docket_number: docketKey,
                                 received_by: 'Migration'
                             }).select().single();
                             
                             if (delErr) {
                                  console.error("Delivery Header Error", delErr);
                             } else {
                                  deliveryId = newDel.id;
                                  deliveryIDMap[docketKey] = deliveryId;
                             }
                         }

                         if (deliveryId) {
                             await supabase.from('delivery_lines').insert({
                                 delivery_id: deliveryId,
                                 po_line_id: newLine.id,
                                 quantity: line.qtyReceived,
                                 invoice_number: line.invoiceNum
                             });
                         }
                    }
                }
                successCount++;
                addLog(`Imported PO: ${po.poNum}`);

            } catch (err: any) {
                console.error(err);
                addLog(`Failed to import PO ${po.poNum}: ${err.message}`);
                failCount++;
            }
        }

        setIsProcessing(false);
        setUploadStatus('DONE');
        addLog(`Import Complete. Success: ${successCount}, Failed/Skipped: ${failCount}, Created Placeholders: ${createdItemsCount}`);
        alert(`Import Complete!\nSuccessful: ${successCount}\nFailed/Skipped: ${failCount}\nCreated Placeholders: ${createdItemsCount}`);

        // Auto-Refresh / Reset on Success
        if (successCount > 0) {
             setTimeout(() => {
                 setPreviewData([]);
                 setFile(null);
                 setUploadStatus('IDLE');
                 setLogs([]);
             }, 500);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / Upload */}
            <div className="bg-white dark:bg-[#1e2029] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Historical Data Import</h3>
                <p className="text-sm text-gray-500 mb-6">Upload an Excel file. Use the generic "Force Import" option to auto-create placeholder items for unknown SKUs.</p>
                
                <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'}`}>
                    <input {...getInputProps()} />
                    <Upload className="mx-auto text-gray-400 mb-4" size={48} />

                    {file ? (
                        <p className="font-bold text-[var(--color-brand)]">{file.name}</p>
                    ) : (
                        <p className="text-gray-500">Drag & drop excel file here, or click to select</p>
                    )}
                </div>
            </div>

            {uploadStatus !== 'IDLE' && (
                <div className="bg-white dark:bg-[#1e2029] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                   
                   <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                        <div>
                            <h3 className="font-bold">Preview ({previewData.length} POs)</h3>
                            <div className="text-xs text-gray-500">
                                Valid: <span className="text-green-600 font-bold">{previewData.filter(p => p.isValid).length}</span>{' '}
                                • Issues: <span className="text-red-500 font-bold">{previewData.filter(p => !p.isValid).length}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={allowImportErrors} 
                                    onChange={e => setAllowImportErrors(e.target.checked)}
                                    className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                                />
                                Allow Import with Errors (Auto-Create Items)
                            </label>

                            {(uploadStatus === 'READY' || uploadStatus === 'DONE') && (
                                <button 
                                    onClick={handleCommit}
                                    disabled={isProcessing || (!allowImportErrors && previewData.filter(p => p.isValid).length === 0)}
                                    className={`px-4 py-2 text-white rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 ${allowImportErrors ? 'bg-amber-600' : 'bg-[var(--color-brand)]'}`}
                                >
                                    {isProcessing && <Loader2 className="animate-spin" size={16} />}
                                    {allowImportErrors ? 'Force Commit Import' : 'Commit Valid Import'}
                                </button>
                            )}
                        </div>
                   </div>

                   <div className="h-32 overflow-y-auto mb-6 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800 p-4 font-mono text-xs text-gray-600 dark:text-gray-400">
                       {logs.map((log, i) => <div key={i}>{log}</div>)}
                   </div>

                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">PO #</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Lines</th>
                                    <th className="px-4 py-3">Issues / Mapping</th>
                                    <th className="px-4 py-3 text-right">Delivery</th>
                                    <th className="px-4 py-3 text-right">Cap?</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {previewData.slice(0, 100).map((po) => (
                                    <React.Fragment key={po.poNum}>
                                        <tr className={po.isValid ? '' : 'bg-red-50 dark:bg-red-900/10'}>
                                            <td className="px-4 py-3">
                                                {po.isValid ? <CheckCircle size={16} className="text-green-500"/> : <AlertTriangle size={16} className="text-red-500"/>}
                                            </td>
                                            <td className="px-4 py-3 font-medium">{po.poNum}</td>
                                            <td className="px-4 py-3">{po.date.toLocaleDateString()}</td>
                                            <td className="px-4 py-3">{po.lines.length}</td>
                                            <td className="px-4 py-3 text-xs">
                                                 {/* Line Detail for Errors */}
                                                 {po.isValid ? (
                                                     <span className="text-gray-400">OK</span>
                                                 ) : (
                                                     <div className="space-y-1">
                                                         {po.lines.filter(l => !l.isValid).slice(0, 3).map((line, idx) => (
                                                             <div key={idx} className="flex items-center gap-2 text-red-600 bg-white dark:bg-black/20 p-1 rounded border border-red-100 dark:border-red-900/30">
                                                                 <span>Unknown: <b>{line.sku}</b></span>
                                                                 <button 
                                                                    onClick={() => openMappingModal(line.sku)}
                                                                    className="px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-[10px] font-bold border border-red-200 flex items-center gap-1"
                                                                 >
                                                                     <Wand2 size={10} /> FIX
                                                                 </button>
                                                             </div>
                                                         ))}
                                                         {po.lines.filter(l => !l.isValid).length > 3 && (
                                                             <span className="text-gray-500">+{po.lines.filter(l => !l.isValid).length - 3} more</span>
                                                         )}
                                                     </div>
                                                 )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {po.lines.reduce((acc, l) => acc + l.qtyReceived, 0)} / {po.lines.reduce((acc, l) => acc + l.qtyOrdered, 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex flex-col gap-1 items-end">
                                                    {po.lines.map((l, i) => (
                                                        l.capDate && (
                                                            <button 
                                                                key={i} 
                                                                onClick={() => openDateEdit(po, i)}
                                                                className="text-[10px] font-mono bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-green-200"
                                                            >
                                                                {l.capDate.toLocaleDateString()} <Edit2 size={8} />
                                                            </button>
                                                        )
                                                    ))}
                                                    {!po.lines.some(l => l.capDate) && <span className="text-gray-300">-</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                        {previewData.length > 100 && <p className="text-center text-xs text-gray-500 p-2">Showing first 100 of {previewData.length}</p>}
                    </div>
                </div>
            )}

            {/* Mapping Modal */}
            {isMappingModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-lg p-6 animate-slide-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Fix Unknown SKU</h2>
                            <button onClick={() => setIsMappingModalOpen(false)}><X size={20} className="text-gray-400"/></button>
                        </div>
                        
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800 mb-4">
                            <p className="text-xs text-red-800 dark:text-red-200">
                                SKU <b>"{mappingTargetSku}"</b> was not found.
                                Select a replacement below.
                            </p>
                        </div>

                        {suggestions.length > 0 && (
                            <div className="mb-4">
                                <div className="text-[10px] uppercase font-bold text-gray-500 mb-2">Suggested Matches</div>
                                <div className="space-y-1">
                                    {suggestions.map((s, idx) => (
                                        <button 
                                            key={s.item.id}
                                            onClick={() => applyMapping(s.item.id)}
                                            className="w-full text-left p-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-lg flex justify-between items-center hover:bg-amber-100 transition-colors"
                                        >
                                            <div>
                                                <div className="font-bold text-xs text-amber-900 dark:text-amber-100">{s.item.name}</div>
                                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">{s.item.sku}</div>
                                            </div>
                                            <div className="text-[10px] font-bold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100 px-1.5 py-0.5 rounded">
                                                {Math.round(s.score * 100)}% Match
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                            <input 
                                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                placeholder="Search all system items..."
                                value={mappingSearch}
                                onChange={e => {
                                    setMappingSearch(e.target.value);
                                    // Optional: dynamic suggestions if needed, but standard filtering below is fine
                                }}
                                autoFocus
                            />
                        </div>

                        <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                            {items
                                .filter(i => (i.name || '').toLowerCase().includes(mappingSearch.toLowerCase()) || (i.sku || '').toLowerCase().includes(mappingSearch.toLowerCase()))
                                .slice(0, 50)
                                .map(item => (
                                    <button 
                                        key={item.id}
                                        onClick={() => applyMapping(item.id)}
                                        className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-100 dark:border-gray-800 last:border-0 flex justify-between items-center group transition-colors"
                                    >
                                        <div>
                                            <div className="font-bold text-sm text-gray-900 dark:text-gray-200">{item.name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{item.sku}</div>
                                        </div>
                                        <div className="text-xs font-bold text-[var(--color-brand)] opacity-0 group-hover:opacity-100">Select</div>
                                    </button>
                                ))
                            }
                            {items.length === 0 && <div className="p-4 text-center text-xs text-gray-400">No items found.</div>}
                        </div>
                        
                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setIsMappingModalOpen(false)} className="px-4 py-2 text-gray-500 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Date Edit Modal */}
            {isDateEditOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-[95%] max-w-sm p-6 animate-slide-up">
                         <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit Capitalization Date</h2>
                         <div className="mb-6">
                             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Date</label>
                             <input 
                                type="date"
                                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:border-[var(--color-brand)]"
                                value={editingDateLine?.date || ''}
                                onChange={e => setEditingDateLine(prev => prev ? ({ ...prev, date: e.target.value }) : null)}
                             />
                         </div>
                         <div className="flex justify-end gap-3">
                            <button onClick={() => setIsDateEditOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={saveDateEdit} className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold shadow-lg shadow-[var(--color-brand)]/20">Save Change</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AdminMigration;
