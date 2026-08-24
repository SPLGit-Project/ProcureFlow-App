import React from 'react';
import { X, Copy, Printer, FileText, CheckCircle2, DollarSign, Info } from 'lucide-react';
import { PORequest } from '../types';
import { calculateLinePricing, calculatePOTotals, formatCurrency } from '../utils/taxCalculations';

interface ConcurExportModalProps {
    po: PORequest;
    onClose: () => void;
}

const ConcurExportModal: React.FC<ConcurExportModalProps> = ({ po, onClose }) => {
    const totals = calculatePOTotals(po.lines);
    const [copied, setCopied] = React.useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleCopy = () => {
        const lineTexts = po.lines.map(l => {
            const pricing = calculateLinePricing(l.quantityOrdered, l.unitPrice, l.taxCode || 'GST', l.taxRate ?? 10.0);
            return `${pricing.quantityOrdered}x ${l.sku} - ${l.itemName} (Unit Ex: ${formatCurrency(pricing.unitPrice)}, GST: ${formatCurrency(pricing.taxAmount)}, Total Inc: ${formatCurrency(pricing.totalPriceIncGst)})`;
        }).join('\n');

        const clipboardText = [
            `========================================`,
            `SAP CONCUR PURCHASE ORDER ENTRY`,
            `========================================`,
            `ProcureFlow PO: ${po.displayId || po.id}`,
            `Supplier: ${po.supplierName}`,
            `Site: ${po.site || 'N/A'}`,
            `Date: ${new Date(po.requestDate).toLocaleDateString()}`,
            `----------------------------------------`,
            `LINE ITEMS:`,
            lineTexts,
            `----------------------------------------`,
            `FINANCIAL TOTALS (SAP CONCUR PARITY):`,
            `Subtotal (Ex-GST):   ${formatCurrency(totals.subtotalAmount)}`,
            `GST Total (10%):     ${formatCurrency(totals.taxTotalAmount)}`,
            `GROSS TOTAL (INC-GST): ${formatCurrency(totals.totalAmountIncGst)}`,
            `========================================`
        ].join('\n');

        navigator.clipboard.writeText(clipboardText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownloadCSV = () => {
        // Headers matching SAP Concur Import/Reconciliation spec
        const headers = [
            'PO Number',
            'Supplier',
            'Item Name',
            'SKU',
            'Quantity',
            'Unit Price (Ex GST)',
            'Tax Code',
            'Tax Rate %',
            'GST Amount',
            'Line Total (Ex GST)',
            'Line Total (Inc GST)'
        ];
        
        // Data Rows
        const rows = po.lines.map(l => {
            const pricing = calculateLinePricing(l.quantityOrdered, l.unitPrice, l.taxCode || 'GST', l.taxRate ?? 10.0);
            return [
                po.displayId || po.id,
                po.supplierName,
                l.itemName,
                l.sku,
                pricing.quantityOrdered,
                pricing.unitPrice.toFixed(2),
                pricing.taxCode,
                pricing.taxRate.toFixed(2),
                pricing.taxAmount.toFixed(2),
                pricing.totalPrice.toFixed(2),
                pricing.totalPriceIncGst.toFixed(2)
            ];
        });

        // Summary Row
        rows.push([
            'TOTAL',
            po.supplierName,
            'ALL ITEMS',
            '',
            po.lines.reduce((sum, l) => sum + (l.quantityOrdered || 0), 0),
            '',
            'GST',
            '10.00',
            totals.taxTotalAmount.toFixed(2),
            totals.subtotalAmount.toFixed(2),
            totals.totalAmountIncGst.toFixed(2)
        ]);

        // Validate content (handle commas in strings)
        const csvContent = [
            headers.join(','), 
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Create Blob and Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${po.displayId || 'PO'}_concur_gst_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in print:bg-white print:absolute print:inset-0">
            <div className="bg-white dark:bg-nocturne rounded-2xl shadow-2xl max-w-3xl w-full p-0 border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header - Hidden in Print */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 print:hidden">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                SAP Concur Entry Details
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">1:1 Financial Parity & GST Breakdown</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleCopy} 
                            className="px-3 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-colors" 
                            title="Copy to Clipboard"
                        >
                            {copied ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Copy size={15} />}
                            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
                        </button>
                        <button 
                            onClick={handleDownloadCSV} 
                            className="hidden sm:flex px-3 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 items-center gap-1.5 transition-colors"
                        >
                            <FileText size={15} /> CSV Export
                        </button>
                        <button 
                            onClick={handlePrint} 
                            className="hidden sm:flex px-3 py-2 bg-[var(--color-brand)] hover:opacity-90 rounded-lg text-xs font-semibold text-white items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <Printer size={15}/> Print / PDF
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors ml-1"
                        >
                            <X size={20}/>
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable on Screen, Full on Print */}
                <div className="p-6 overflow-y-auto print:overflow-visible print:p-0 space-y-6">
                    
                    <div className="print:hidden bg-blue-50/80 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-xl text-xs flex gap-3 border border-blue-100 dark:border-blue-800/40">
                        <div className="shrink-0 pt-0.5"><Info size={16} className="text-blue-600 dark:text-blue-400" /></div>
                        <div>
                            <p className="font-semibold mb-0.5">SAP Concur Order Entry Guidance</p>
                            <p className="text-blue-700 dark:text-blue-300">
                                Use the <b>Subtotal (Ex GST)</b>, <b>GST (10%)</b>, and <b>Total (Inc GST)</b> below to create or verify the Purchase Request in SAP Concur. The gross amount ensures 100% parity with supplier invoices and ERP ledgers.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Purchase Request Reference</span>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{po.displayId || po.id}</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Supplier: <b className="text-gray-800 dark:text-gray-200">{po.supplierName}</b></p>
                        </div>
                        <div className="text-left sm:text-right">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">SAP Concur Gross Total</span>
                            <div className="text-2xl font-black text-gray-900 dark:text-white">
                                {formatCurrency(totals.totalAmountIncGst)}
                            </div>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                ({formatCurrency(totals.subtotalAmount)} ex + {formatCurrency(totals.taxTotalAmount)} GST)
                            </span>
                        </div>
                    </div>

                    {/* Financial Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800">
                            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Subtotal (Ex GST)</p>
                            <p className="text-base font-bold text-gray-900 dark:text-white">{formatCurrency(totals.subtotalAmount)}</p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800">
                            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">GST (10%)</p>
                            <p className="text-base font-bold text-gray-900 dark:text-white">{formatCurrency(totals.taxTotalAmount)}</p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/30">
                            <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider mb-1">Total (Inc GST)</p>
                            <p className="text-base font-black text-emerald-900 dark:text-emerald-300">{formatCurrency(totals.totalAmountIncGst)}</p>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3">Item / Description</th>
                                    <th className="py-2.5 px-3">SKU</th>
                                    <th className="py-2.5 px-3 text-center">Qty</th>
                                    <th className="py-2.5 px-3 text-right">Unit Price (Ex)</th>
                                    <th className="py-2.5 px-3 text-center">Tax Code</th>
                                    <th className="py-2.5 px-3 text-right">GST (10%)</th>
                                    <th className="py-2.5 px-3 text-right">Total (Inc GST)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {po.lines.map(line => {
                                    const pricing = calculateLinePricing(line.quantityOrdered, line.unitPrice, line.taxCode || 'GST', line.taxRate ?? 10.0);
                                    return (
                                        <tr key={line.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-3 font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate">{line.itemName}</td>
                                            <td className="py-3 px-3 text-gray-500 dark:text-gray-400 font-mono">{line.sku}</td>
                                            <td className="py-3 px-3 text-center font-semibold text-gray-900 dark:text-gray-100">{pricing.quantityOrdered}</td>
                                            <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300 font-mono">{formatCurrency(pricing.unitPrice)}</td>
                                            <td className="py-3 px-3 text-center">
                                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                                    {pricing.taxCode}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300 font-mono">{formatCurrency(pricing.taxAmount)}</td>
                                            <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(pricing.totalPriceIncGst)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50/80 dark:bg-white/5 border-t-2 border-gray-200 dark:border-gray-800 font-semibold text-xs">
                                <tr>
                                    <td colSpan={4} className="py-2.5 px-3 text-right text-gray-500 uppercase text-[10px] font-bold">Subtotal (Ex GST):</td>
                                    <td colSpan={3} className="py-2.5 px-3 text-right font-mono text-gray-900 dark:text-white">{formatCurrency(totals.subtotalAmount)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="py-2 px-3 text-right text-gray-500 uppercase text-[10px] font-bold">Total GST (10%):</td>
                                    <td colSpan={3} className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">{formatCurrency(totals.taxTotalAmount)}</td>
                                </tr>
                                <tr className="border-t border-gray-200 dark:border-gray-700 bg-[var(--color-brand)]/5 dark:bg-[var(--color-brand)]/10">
                                    <td colSpan={4} className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white uppercase text-[11px]">SAP Concur Total (Inc GST):</td>
                                    <td colSpan={3} className="py-3 px-3 text-right font-black text-base text-[var(--color-brand)] font-mono">{formatCurrency(totals.totalAmountIncGst)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="pt-2 flex justify-between text-[11px] text-gray-400 dark:text-gray-500 print:text-black">
                         <span>Requested by: <b className="text-gray-600 dark:text-gray-300">{po.requesterName}</b></span>
                         <span>Date: {new Date(po.requestDate).toLocaleDateString()}</span>
                         <span>Delivery Site: <b className="text-gray-600 dark:text-gray-300">{po.site || 'Default'}</b></span>
                    </div>

                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-center bg-gray-50/50 dark:bg-white/5 print:hidden">
                    <button onClick={onClose} className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Close Preview</button>
                </div>
            </div>
        </div>
    );
};

export default ConcurExportModal;
