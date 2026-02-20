
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Download, Filter, Search, BarChart3, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { POStatus, PORequest } from '../types';

type ReportType = 'OUTSTANDING_DELIVERIES' | 'FINANCE_SUMMARY' | 'PO_STATUS';

const ReportingView = () => {
    const { pos } = useApp();
    const [activeReport, setActiveReport] = useState<ReportType>('OUTSTANDING_DELIVERIES');
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState<any[]>([]);
    const [lastRun, setLastRun] = useState<string | null>(null);

    const runReport = () => {
        setIsLoading(true);
        // Simulate calculation delay
        setTimeout(() => {
            let data: any[] = [];
            
            if (activeReport === 'OUTSTANDING_DELIVERIES') {
                // Filter POs that are ACTIVE or PARTIALLY_RECEIVED or APPROVED_PENDING_CONCUR (if they have lines to show)
                const activePos = pos.filter(po => ['ACTIVE', 'PARTIALLY_RECEIVED', 'APPROVED_PENDING_CONCUR'].includes(po.status));
                
                activePos.forEach(po => {
                    po.lines.forEach(line => {
                         const receivedQty = line.quantityReceived || 0;
                         const remaining = line.quantityOrdered - receivedQty;
                         
                         if (remaining > 0) {
                             data.push({
                                 id: line.id,
                                 poNumber: po.lines[0]?.concurPoNumber || 'Pending',
                                 supplier: po.supplierName,
                                 site: po.site,
                                 item: line.itemName,
                                 ordered: line.quantityOrdered,
                                 received: receivedQty,
                                 remaining: remaining,
                                 status: po.status
                             });
                         }
                    });
                });
            } else if (activeReport === 'FINANCE_SUMMARY') {
                 // Flatten all deliveries
                 pos.forEach(po => {
                     if (!po.deliveries || po.deliveries.length === 0) return;
                     
                     po.deliveries.forEach(del => {
                         del.lines.forEach(line => {
                             const poLine = po.lines.find(l => l.id === line.poLineId);
                             data.push({
                                 id: line.id,
                                 poNumber: poLine?.concurPoNumber || po.lines[0]?.concurPoNumber || 'Pending',
                                 supplier: po.supplierName,
                                 invoice: line.invoiceNumber || '-',
                                 docket: del.docketNumber,
                                 receivedDate: del.date,
                                 amount: line.quantity * (poLine?.unitPrice || 0),
                                 isCapitalised: line.isCapitalised ? 'Yes' : 'No',
                                 capDate: line.capitalisedDate || '-'
                             });
                         });
                     });
                 });
            } else if (activeReport === 'PO_STATUS') {
                data = pos.map(po => ({
                    id: po.id,
                    displayId: po.displayId,
                    supplier: po.supplierName,
                    requester: po.requesterName,
                    date: po.requestDate,
                    total: po.totalAmount,
                    status: po.status,
                    lineCount: po.lines.length
                }));
            }

            setReportData(data);
            setLastRun(new Date().toLocaleTimeString());
            setIsLoading(false);
        }, 800);
    };

    // --- Export Logic ---
    const exportCSV = () => {
        if (reportData.length === 0) return;

        const headers = Object.keys(reportData[0]).join(',');
        const rows = reportData.map(row => Object.values(row).map(val => `"${val}"`).join(',')).join('\n');
        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${activeReport}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
                <p className="text-secondary dark:text-gray-400 text-sm mt-1">Generate reports for delivery tracking and financial auditing.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* valid reports sidebar */}
                <div className="xl:col-span-1 space-y-2">
                    <div className="bg-white dark:bg-[#1e2029] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-2">
                        <div className="flex flex-col sm:flex-row xl:flex-col gap-2">
                            <button 
                                onClick={() => { setActiveReport('OUTSTANDING_DELIVERIES'); setReportData([]); }}
                                className={`w-full sm:shrink-0 xl:w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeReport === 'OUTSTANDING_DELIVERIES' ? 'bg-[var(--color-brand)] text-white' : 'text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                                <AlertCircle size={18}/>
                                Outstanding Deliveries
                            </button>
                            <button 
                                onClick={() => { setActiveReport('FINANCE_SUMMARY'); setReportData([]); }}
                                className={`w-full sm:shrink-0 xl:w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeReport === 'FINANCE_SUMMARY' ? 'bg-[var(--color-brand)] text-white' : 'text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                                <TrendingUp size={18}/>
                                Finance Summary
                            </button>
                            <button 
                                onClick={() => { setActiveReport('PO_STATUS'); setReportData([]); }}
                                className={`w-full sm:shrink-0 xl:w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeReport === 'PO_STATUS' ? 'bg-[var(--color-brand)] text-white' : 'text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                                <FileText size={18}/>
                                PO Status Report
                            </button>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-2">Report Description</h4>
                        <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                            {activeReport === 'OUTSTANDING_DELIVERIES' && "Shows all PO line items that have been approved or active but not yet fully received. Useful for tracking backorders and pending shipments."}
                            {activeReport === 'FINANCE_SUMMARY' && "Detailed breakdown of all received goods with their capitalization status and invoice numbers. Use this for month-end reconciliation."}
                            {activeReport === 'PO_STATUS' && "High-level overview of all Purchase Orders and their current approval status in the workflow."}
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="xl:col-span-3">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 min-h-[420px] md:min-h-[500px] flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div className="min-w-0">
                                <h2 className="font-bold text-gray-900 dark:text-white">
                                    {activeReport === 'OUTSTANDING_DELIVERIES' && 'Outstanding Deliveries Report'}
                                    {activeReport === 'FINANCE_SUMMARY' && 'Finance Capitalization Summary'}
                                    {activeReport === 'PO_STATUS' && 'All PO Status Report'}
                                </h2>
                                {lastRun && <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 flex items-center gap-1"><CheckCircle2 size={10}/> Data updated at: {lastRun}</p>}
                            </div>
                            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                                <button onClick={runReport} disabled={isLoading} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
                                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <BarChart3 size={16}/>}
                                    Run Report
                                </button>
                                <button onClick={exportCSV} className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto" disabled={reportData.length === 0}>
                                    <Download size={16}/> Export CSV
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 p-0 overflow-x-auto">
                            {reportData.length === 0 && !isLoading ? (
                                <div className="flex flex-col items-center justify-center h-full text-tertiary dark:text-gray-400 space-y-4 py-20">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center">
                                        <BarChart3 size={32} className="opacity-50"/>
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">No Data Generated</h3>
                                        <p className="text-xs mt-1">Click "Run report" to generate the latest data.</p>
                                    </div>
                                </div>
                            ) : (
                                <table className="w-full min-w-[760px] text-sm text-left">
                                    <thead className="text-xs text-secondary dark:text-gray-500 uppercase bg-gray-50 dark:bg-[#15171e] font-bold border-b border-gray-200 dark:border-gray-800 sticky top-0">
                                        <tr>
                                            {activeReport === 'OUTSTANDING_DELIVERIES' && (
                                                <>
                                                    <th className="px-6 py-4">PO # / Supplier</th>
                                                    <th className="px-6 py-4">Site</th>
                                                    <th className="px-6 py-4">Item</th>
                                                    <th className="px-6 py-4 text-center">Ordered</th>
                                                    <th className="px-6 py-4 text-center">Received</th>
                                                    <th className="px-6 py-4 text-center text-orange-500">Remaining</th>
                                                </>
                                            )}
                                            {activeReport === 'FINANCE_SUMMARY' && (
                                                <>
                                                    <th className="px-6 py-4">Received / Docket</th>
                                                    <th className="px-6 py-4">Supplier</th>
                                                    <th className="px-6 py-4">Invoice #</th>
                                                    <th className="px-6 py-4 text-right">Value</th>
                                                    <th className="px-6 py-4 text-center">Capitalised</th>
                                                    <th className="px-6 py-4">Date</th>
                                                </>
                                            )}
                                            {activeReport === 'PO_STATUS' && (
                                                <>
                                                    <th className="px-6 py-4">PO Details</th>
                                                    <th className="px-6 py-4">Requester</th>
                                                    <th className="px-6 py-4 text-right">Total</th>
                                                    <th className="px-6 py-4 text-center">Lines</th>
                                                    <th className="px-6 py-4">Status</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {reportData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                 {activeReport === 'OUTSTANDING_DELIVERIES' && (
                                                    <>
                                                        <td className="px-6 py-3">
                                                            <div className="font-bold text-gray-900 dark:text-white">{row.supplier}</div>
                                                            <div className="text-xs text-tertiary dark:text-gray-500 font-mono">{row.poNumber}</div>
                                                        </td>
                                                        <td className="px-6 py-3">{row.site}</td>
                                                        <td className="px-6 py-3 text-secondary dark:text-gray-300">{row.item}</td>
                                                        <td className="px-6 py-3 text-center">{row.ordered}</td>
                                                        <td className="px-6 py-3 text-center text-green-600">{row.received}</td>
                                                        <td className="px-6 py-3 text-center font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/10">{row.remaining}</td>
                                                    </>
                                                )}
                                                {activeReport === 'FINANCE_SUMMARY' && (
                                                    <>
                                                        <td className="px-6 py-3">
                                                            <div className="font-bold text-gray-900 dark:text-white">{row.receivedDate}</div>
                                                            <div className="text-xs text-tertiary dark:text-gray-500">{row.docket}</div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="font-medium">{row.supplier}</div>
                                                            <div className="text-xs text-tertiary dark:text-gray-400">{row.poNumber}</div>
                                                        </td>
                                                        <td className="px-6 py-3 font-mono text-xs">{row.invoice}</td>
                                                        <td className="px-6 py-3 text-right font-medium">${row.amount.toLocaleString()}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${row.isCapitalised === 'Yes' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-secondary dark:bg-white/10 dark:text-gray-400'}`}>
                                                                {row.isCapitalised}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-xs text-secondary dark:text-gray-500">{row.capDate}</td>
                                                    </>
                                                )}
                                                 {activeReport === 'PO_STATUS' && (
                                                    <>
                                                        <td className="px-6 py-3">
                                                            <div className="font-bold text-gray-900 dark:text-white">{row.displayId || row.id.substring(0,8)}</div>
                                                            <div className="text-xs text-tertiary dark:text-gray-500">{row.supplier}</div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="text-sm">{row.requester}</div>
                                                            <div className="text-xs text-tertiary dark:text-gray-400">{row.date}</div>
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-medium">${row.total.toLocaleString()}</td>
                                                        <td className="px-6 py-3 text-center">{row.lineCount}</td>
                                                        <td className="px-6 py-3">
                                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${
                                                                row.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                row.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                'bg-gray-50 text-secondary border-gray-200'
                                                            }`}>
                                                                {row.status.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportingView;
