
import React from 'react';
import { X, Copy, Printer, FileText } from 'lucide-react';
import { PORequest } from '../types';

interface ConcurExportModalProps {
    po: PORequest;
    onClose: () => void;
}

const ConcurExportModal: React.FC<ConcurExportModalProps> = ({ po, onClose }) => {
    
    const handlePrint = () => {
        window.print();
    };

    const handleCopy = () => {
        const text = po.lines.map(l => `${l.quantityOrdered}x ${l.sku} - ${l.itemName} ($${l.unitPrice})`).join('\n');
        navigator.clipboard.writeText(`PO Request ${po.displayId}\nSupplier: ${po.supplierName}\n\n${text}`);
    };

    const handleDownloadCSV = () => {
        // Headers
        const headers = ['PO Number', 'Supplier', 'Item Name', 'SKU', 'Quantity', 'Unit Price', 'Total Price'];
        
        // Data Rows
        const rows = po.lines.map(l => [
            po.displayId || po.id,
            po.supplierName,
            l.itemName,
            l.sku,
            l.quantityOrdered,
            l.unitPrice.toFixed(2),
            l.totalPrice.toFixed(2)
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
        link.setAttribute('download', `${po.displayId || 'PO'}_concur_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in print:bg-white print:absolute print:inset-0">
            <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl max-w-2xl w-full p-0 border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header - Hidden in Print */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center print:hidden">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText size={20} className="text-[var(--color-brand)]"/> 
                        Concur Entry Details
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={handleCopy} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors" title="Copy to Clipboard">
                            <Copy size={18}/>
                        </button>
                        <button onClick={handleDownloadCSV} className="hidden sm:flex px-3 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 items-center gap-2 transition-colors">
                            CSV
                        </button>
                        <button onClick={handlePrint} className="hidden sm:flex px-3 py-2 bg-[var(--color-brand)] hover:opacity-90 rounded-lg text-xs font-semibold text-white items-center gap-2 transition-colors shadow-lg shadow-[var(--color-brand)]/20">
                            <Printer size={16}/> Print / PDF
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors">
                            <X size={20}/>
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable on Screen, Full on Print */}
                <div className="p-6 overflow-y-auto print:overflow-visible print:p-0">
                    
                    <div className="print:hidden bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-4 rounded-xl mb-6 text-sm flex gap-3">
                        <div className="shrink-0 pt-0.5"><InfoIcon size={16}/></div>
                        <p>Use the details below to manually create the Purchase Request in SAP Concur. Ensure the totals match exactly.</p>
                    </div>

                    <div className="print:mb-8 mb-6">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-black mb-1">Purchase Request Details</h1>
                        <p className="text-gray-500 dark:text-gray-600 font-mono">{po.displayId || po.id}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                            <p className="text-xs uppercase text-gray-400 font-bold tracking-wider mb-1">Supplier</p>
                            <p className="font-bold text-gray-900 dark:text-black text-lg">{po.supplierName}</p>
                        </div>
                        <div className="text-right">
                             <p className="text-xs uppercase text-gray-400 font-bold tracking-wider mb-1">Total Amount</p>
                             <p className="font-bold text-gray-900 dark:text-black text-lg">${po.totalAmount.toLocaleString()}</p>
                        </div>
                    </div>

                    <table className="w-full text-sm text-left">
                        <thead className="border-b-2 border-gray-200 dark:border-gray-300 text-gray-500 uppercase text-xs font-bold">
                            <tr>
                                <th className="py-3">Description</th>
                                <th className="py-3">SKU</th>
                                <th className="py-3 text-center">Qty</th>
                                <th className="py-3 text-right">Unit Price</th>
                                <th className="py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-200">
                             {po.lines.map(line => (
                                 <tr key={line.id}>
                                     <td className="py-3 font-medium text-gray-900 dark:text-black">{line.itemName}</td>
                                     <td className="py-3 text-gray-500 font-mono">{line.sku}</td>
                                     <td className="py-3 text-center text-gray-900 dark:text-black">{line.quantityOrdered}</td>
                                     <td className="py-3 text-right text-gray-900 dark:text-black">${line.unitPrice.toFixed(2)}</td>
                                     <td className="py-3 text-right font-bold text-gray-900 dark:text-black">${line.totalPrice.toFixed(2)}</td>
                                 </tr>
                             ))}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-200">
                            <tr>
                                <td colSpan={3}></td>
                                <td className="py-4 text-right font-bold text-gray-500 dark:text-black uppercase text-xs">Total (Ex GST)</td>
                                <td className="py-4 text-right font-bold text-gray-900 dark:text-black text-lg">${po.totalAmount.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="mt-8 border-t border-gray-200 pt-4 flex justify-between text-xs text-gray-400 print:text-black">
                         <span>Requested by: {po.requesterName}</span>
                         <span>Date: {new Date(po.requestDate).toLocaleDateString()}</span>
                    </div>

                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-center print:hidden">
                    <button onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Close Preview</button>
                </div>
            </div>
        </div>
    );
};

const InfoIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
);

export default ConcurExportModal;
