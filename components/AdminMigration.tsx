
import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, Edit2, Search, X } from 'lucide-react';
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
}

const AdminMigration: React.FC<AdminMigrationProps> = () => {
    const { items, sites } = useApp();
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<ParsedPO[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'PARSING' | 'READY' | 'COMMITTING' | 'DONE' | 'ERROR'>('IDLE');
    const [logs, setLogs] = useState<string[]>([]);
    
    // Mapping Modal State
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [mappingTargetSku, setMappingTargetSku] = useState<string>('');
    const [mappingSearch, setMappingSearch] = useState('');

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

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
       if (!serial) return new Date();
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
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

                addLog(`Found ${rows.length} rows.`);

                // Group by PO
                const poGroups: Record<string, ParsedPO> = {};
                
                rows.forEach((row, idx) => {
                    const poNum = row['PO #'];
                    if (!poNum) return;

                    if (!poGroups[poNum]) {
                        poGroups[poNum] = {
                            poNum,
                            date: excelDateToJSDate(row['Order Date']),
                            status: row['Order Status'] === 'Received in Full' ? 'COMPLETED' : 'PENDING_DELIVERY',
                            lines: [],
                            isValid: true,
                            errors: [],
                            customerName: row['Customer Name'],
                            comments: row['Comments']
                        };
                    }

                    // Line parsing
                    const sku = row['Product Code'] ? String(row['Product Code']).trim() : '';
                    let item = items.find(i => i.sku === sku);
                    const isValid = !!item;

                    // Cap Data
                    let capDate = undefined;
                    if (row['Capitalized Month']) {
                        capDate = excelDateToJSDate(row['Capitalized Month']);
                    }

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
                    });
                });

                // Post-process Validation
                Object.values(poGroups).forEach(po => {
                    const invalidLines = po.lines.filter(l => !l.isValid);
                    if (invalidLines.length > 0) {
                        po.isValid = false;
                        po.errors.push(`${invalidLines.length} invalid lines (Unknown SKUs)`);
                    }
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

    // --- Mapping Logic ---
    const openMappingModal = (invalidSku: string) => {
        setMappingTargetSku(invalidSku);
        setMappingSearch('');
        setIsMappingModalOpen(true);
    };

    const applyMapping = (newItemId: string) => {
        const newItem = items.find(i => i.id === newItemId);
        if (!newItem) return;

        // Update all instances of this SKU in the preview data
        setPreviewData(prev => {
            return prev.map(po => {
                let poModified = false;
                const newLines = po.lines.map(line => {
                    if (line.sku === mappingTargetSku && !line.isValid) {
                        poModified = true;
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

                // Re-evaluate PO validity
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
        });
        
        addLog(`Mapped '${mappingTargetSku}' to '${newItem.sku}'`);
        setIsMappingModalOpen(false);
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

        for (const po of previewData) {
            // Skip ONLY if still invalid (user didn't map)
            if (!po.isValid) {
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
                        reason_for_request: 'Historical Import',
                        comments: po.comments
                    }).select().single();

                    if (poErr) throw poErr;
                    poId = newPO.id;
                }

                // 2. Lines
                for (const line of po.lines) {
                    // Item ID resolution: Mapped OR Original lookup
                    let finalItemId = line.mappedItemId;
                    let finalSku = line.mappedSku;
                    
                    if (!finalItemId) {
                         const item = items.find(i => i.sku === line.sku);
                         if (item) {
                             finalItemId = item.id;
                             finalSku = item.sku;
                         }
                    }

                    if (!finalItemId) {
                         // Should not happen if filtered by isValid, but safety
                         addLog(`Error: Could not resolve item for line ${line.sku} in PO ${po.poNum}`);
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
                        total_price: line.totalPrice
                    }).select().single();

                    if (lineErr) throw lineErr;

                    // 3. Asset Capitalization
                    if (line.capDate) {
                        await supabase.from('asset_capitalization').insert({
                            po_line_id: newLine.id,
                            gl_code: 'HISTORICAL',
                             // Use provided tag or generate one
                            asset_tag: line.assetTag || `AST-${po.poNum}-${finalSku}`,
                            capitalized_date: line.capDate.toISOString(),
                            comments: line.capComments
                        });
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
        addLog(`Import Complete. Success: ${successCount}, Failed/Skipped: ${failCount}`);
        alert(`Import Complete!\nSuccessful: ${successCount}\nFailed/Skipped: ${failCount}`);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1e2029] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Historical Data Import</h3>
                <p className="text-sm text-gray-500 mb-6">Upload an Excel file to import historical POs. The system will look for Product Codes, QTY Received, and Capitalization columns.</p>
                
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
                   
                   <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold">Preview ({previewData.length} POs)</h3>
                            <div className="text-xs text-gray-500">
                                Valid: <span className="text-green-600 font-bold">{previewData.filter(p => p.isValid).length}</span>{' '}
                                • Issues: <span className="text-red-500 font-bold">{previewData.filter(p => !p.isValid).length}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {(uploadStatus === 'READY' || uploadStatus === 'DONE') && (
                                <button 
                                    onClick={handleCommit}
                                    disabled={isProcessing || previewData.filter(p => p.isValid).length === 0}
                                    className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isProcessing && <Loader2 className="animate-spin" size={16} />}
                                    Commit Import
                                </button>
                            )}
                        </div>
                   </div>

                   <div className="h-32 overflow-y-auto mb-6 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800 p-4 font-mono text-xs">
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
                                                                    className="px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-[10px] font-bold border border-red-200"
                                                                 >
                                                                     FIX
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
                                                {po.lines.some(l => l.capDate) ? <span className="text-green-600 font-bold">YES</span> : '-'}
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
                                The file contains SKU <b>"{mappingTargetSku}"</b> which was not found in the system.
                                Select the correct system item to map.
                            </p>
                        </div>

                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                            <input 
                                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                placeholder="Search system items..."
                                value={mappingSearch}
                                onChange={e => setMappingSearch(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl">
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
                            {items.length === 0 && <div className="p-4 text-center text-xs text-gray-400">No items found in system.</div>}
                        </div>
                        
                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setIsMappingModalOpen(false)} className="px-4 py-2 text-gray-500 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AdminMigration;
