
import React, { useState, useCallback } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone'; // Assuming react-dropzone is installed, if not we'll use simple input
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface AdminMigrationProps {
}

interface ParsedPO {
    poNum: string;
    date: Date;
    status: string;
    lines: any[];
    isValid: boolean;
    errors: string[];
}

const AdminMigration: React.FC<AdminMigrationProps> = () => {
    const { items, users, sites } = useApp();
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<ParsedPO[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'PARSING' | 'READY' | 'COMMITTING' | 'DONE' | 'ERROR'>('IDLE');
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            handleParse(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop, 
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        multiple: false 
    } as unknown as DropzoneOptions);

    const excelDateToJSDate = (serial: any) => {
       if (!serial) return new Date();
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
                            errors: []
                        };
                    }
                    poGroups[poNum].lines.push({ ...row, _rowIdx: idx + 2 });
                });

                // Validation
                Object.values(poGroups).forEach(po => {
                    // Check Items
                    po.lines.forEach(line => {
                        const sku = line['Product Code'];
                        const item = items.find(i => i.sku === sku);
                        if (!item) {
                            po.isValid = false;
                            po.errors.push(`Line ${line._rowIdx}: SKU '${sku}' not found.`);
                        }
                    });

                    // Check Site (Optional)
                    const siteName = po.lines[0]['Site'];
                    // We might map specific sites or default.
                    
                    // Check Requester? historical might not match current users.
                    // We'll default to current user if not found or skip.
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

    const handleCommit = async () => {
        if (uploadStatus !== 'READY') return;
        setUploadStatus('COMMITTING');
        setIsProcessing(true);
        addLog('Starting import...');

        // Hardcoded Defaults for MVP
        // In full version, we might let user select "Default Requester"
        const DEFAULT_REQUESTER_ID = 'a6e2810c-2b85-4ee1-81cb-a6fe3cc71378'; // Use Aaron Bell or fallback
        const DEFAULT_SITE_ID = sites[0]?.id || '33333333-3333-4333-8333-333333333333'; // Default site

        let successCount = 0;
        let failCount = 0;

        for (const po of previewData) {
            if (!po.isValid) {
                addLog(`Skipping Invalid PO: ${po.poNum}`);
                failCount++;
                continue;
            }

            try {
                // 1. Create Header
                // Check dupes first?
                const { data: existing } = await supabase.from('po_requests').select('id').eq('display_id', po.poNum).maybeSingle();
                
                let poId = existing?.id;
                
                if (!poId) {
                    const totalAmount = po.lines.reduce((sum, l) => sum + (l['Total Order Price'] || 0), 0);
                    
                    const { data: newPO, error: poErr } = await supabase.from('po_requests').insert({
                        display_id: po.poNum,
                        status: po.status,
                        request_date: po.date.toISOString(),
                        requester_id: DEFAULT_REQUESTER_ID,
                        site_id: DEFAULT_SITE_ID,
                        total_amount: totalAmount,
                        customer_name: po.lines[0]['Customer Name'] || 'Civeo',
                        reason_for_request: 'Historical Import',
                        comments: po.lines[0]['Comments']
                    }).select().single();

                    if (poErr) throw poErr;
                    poId = newPO.id;
                }

                // 2. Lines
                for (const line of po.lines) {
                    const sku = line['Product Code'];
                    const item = items.find(i => i.sku === sku);
                    if (!item) continue; // Should be caught by validation, but safety check

                    // Check if line exists? simplistic: just insert
                    const qtyOrdered = line['Order QTY'] || 0;
                    const qtyReceived = po.status === 'COMPLETED' ? qtyOrdered : (line['QTY Received'] || 0);

                    const { data: newLine, error: lineErr } = await supabase.from('po_lines').insert({
                        po_request_id: poId,
                        item_id: item.id,
                        sku: sku,
                        item_name: line['Product Description'],
                        quantity_ordered: qtyOrdered,
                        quantity_received: qtyReceived,
                        unit_price: line['Unit Price'] || 0,
                        total_price: line['Total Order Price'] || 0
                    }).select().single();

                    if (lineErr) throw lineErr;

                    // 3. Asset Capitalization
                    if (line['Capitalized Month']) {
                        const capDate = excelDateToJSDate(line['Capitalized Month']);
                        await supabase.from('asset_capitalization').insert({
                            po_line_id: newLine.id,
                            gl_code: 'HISTORICAL',
                            asset_tag: `AST-${po.poNum}-${sku}`,
                            capitalized_date: capDate.toISOString(),
                            comments: line['Capitalized Comments']
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
        addLog(`Create Job Complete. Success: ${successCount}, Skipped/Failed: ${failCount}`);
        alert(`Import Complete!\nSuccessful: ${successCount}\nFailed/Skipped: ${failCount}`);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1e2029] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Historical Data Import</h3>
                <p className="text-sm text-gray-500 mb-6">Upload an Excel file to import historical POs and asset capitalization data.</p>
                
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
                        <h3 className="font-bold">Preview ({previewData.length} POs)</h3>
                        <div className="flex gap-2">
                            {uploadStatus === 'READY' && (
                                <button 
                                    onClick={handleCommit}
                                    disabled={isProcessing}
                                    className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isProcessing && <Loader2 className="animate-spin" size={16} />}
                                    Commit Import
                                </button>
                            )}
                        </div>
                   </div>

                   <div className="h-64 overflow-y-auto mb-6 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800 p-4 font-mono text-xs">
                       {logs.map((log, i) => <div key={i}>{log}</div>)}
                   </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">PO #</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Lines</th>
                                    <th className="px-4 py-3">Issues</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {previewData.slice(0, 100).map((po) => (
                                    <tr key={po.poNum} className={po.isValid ? '' : 'bg-red-50 dark:bg-red-900/10'}>
                                        <td className="px-4 py-3">
                                            {po.isValid ? <CheckCircle size={16} className="text-green-500"/> : <AlertTriangle size={16} className="text-red-500"/>}
                                        </td>
                                        <td className="px-4 py-3 font-medium">{po.poNum}</td>
                                        <td className="px-4 py-3">{po.date.toLocaleDateString()}</td>
                                        <td className="px-4 py-3">{po.lines.length}</td>
                                        <td className="px-4 py-3 text-red-500 text-xs">
                                            {po.errors.slice(0, 2).map((e, i) => <div key={i}>{e}</div>)}
                                            {po.errors.length > 2 && <div>+{po.errors.length - 2} more</div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {previewData.length > 100 && <p className="text-center text-xs text-gray-500 p-2">Showing first 100 of {previewData.length}</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminMigration;
