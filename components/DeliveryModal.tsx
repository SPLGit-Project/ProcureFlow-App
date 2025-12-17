
import React, { useState } from 'react';
import { DeliveryHeader, DeliveryLineItem, PORequest, User } from '../types';
import { X, AlertTriangle, Info, CheckSquare, Square } from 'lucide-react';

interface Props {
    po: PORequest;
    currentUser: User;
    onClose: () => void;
    onSubmit: (delivery: DeliveryHeader, closedLineIds: string[]) => void;
}

const DeliveryModal: React.FC<Props> = ({ po, currentUser, onClose, onSubmit }) => {
    const [docketNumber, setDocketNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [receipts, setReceipts] = useState<Record<string, number>>({});
    const [closedLines, setClosedLines] = useState<Set<string>>(new Set());
    
    // Only show lines that aren't fully received yet (calculated from PO state)
    // Actually, we should show all lines to allow corrections or extra receipts, 
    // but typically we only receive what's outstanding. 
    // Let's filter visually but allow access if needed? 
    // Existing logic filtered them. Let's keep showing only active lines for clarity.
    const activeLines = po.lines.filter(l => l.quantityReceived < l.quantityOrdered);

    // Calculate Variance Triggers
    const variances: Record<string, 'OVER' | 'SHORT' | null> = {};
    let hasAnyVariance = false;

    activeLines.forEach(line => {
        const inputQty = receipts[line.id] || 0;
        const remaining = line.quantityOrdered - line.quantityReceived;
        const isClosed = closedLines.has(line.id);

        if (inputQty > remaining) {
            variances[line.id] = 'OVER';
            hasAnyVariance = true;
        } else if (isClosed && inputQty < remaining) {
            variances[line.id] = 'SHORT'; // User explicitly closing short
            hasAnyVariance = true;
        }
    });

    const handleQtyChange = (lineId: string, val: string) => {
        const num = parseFloat(val); // Allow decimals if needed, or int? Assuming int for now based on types
        if (isNaN(num)) {
            const newReceipts = { ...receipts };
            delete newReceipts[lineId];
            setReceipts(newReceipts);
            return;
        }
        setReceipts(prev => ({ ...prev, [lineId]: Math.max(0, num) }));
    };

    const toggleCloseLine = (lineId: string) => {
        const newSet = new Set(closedLines);
        if (newSet.has(lineId)) newSet.delete(lineId);
        else newSet.add(lineId);
        setClosedLines(newSet);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const deliveryLines: DeliveryLineItem[] = Object.entries(receipts)
            .filter(([_, qty]) => (qty as number) > 0)
            .map(([lineId, qty]) => ({
                id: `dl-${Date.now()}-${lineId}`,
                poLineId: lineId,
                quantity: qty as number,
                isCapitalised: false, 
                invoiceNumber: '' 
            }));

        // Allow submitting short-closes even if qty is 0? 
        // If I want to close a line without receiving anything:
        // Then deliveryLines might be empty for that line, but we still pass closedLineIds.
        
        if (deliveryLines.length === 0 && closedLines.size === 0) return;

        const header: DeliveryHeader = {
            id: `del-${Date.now()}`,
            date,
            docketNumber,
            receivedBy: currentUser.name,
            lines: deliveryLines
        };
        
        onSubmit(header, Array.from(closedLines));
    };

    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh] animate-slide-up">
                <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            Record Delivery
                            {hasAnyVariance && (
                                <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200 flex items-center gap-1">
                                    <AlertTriangle size={12}/> Variance Approval Required
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ref: {po.lines[0]?.concurPoNumber || po.displayId || po.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-5 overflow-y-auto space-y-6">
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Docket / Packing Slip #</label>
                                <input 
                                    required={Object.keys(receipts).length > 0} // Only required if receiving goods
                                    type="text" 
                                    className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-[var(--color-brand)] outline-none"
                                    value={docketNumber} 
                                    onChange={e => setDocketNumber(e.target.value)} 
                                    placeholder="e.g. D-12345"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date Received</label>
                                <input 
                                    required
                                    type="date" 
                                    className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-[var(--color-brand)] outline-none"
                                    value={date} 
                                    onChange={e => setDate(e.target.value)} 
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Select Items to Receive</h3>
                            </div>
                            <div className="space-y-3">
                                {activeLines.map(line => {
                                    const remaining = Math.max(0, line.quantityOrdered - line.quantityReceived);
                                    const inputQty = receipts[line.id] || 0;
                                    const variance = variances[line.id];
                                    const isClosed = closedLines.has(line.id);

                                    return (
                                        <div key={line.id} className={`p-4 rounded-xl border transition-all ${
                                            variance 
                                                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' 
                                                : inputQty > 0 || isClosed
                                                    ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30' 
                                                    : 'bg-white dark:bg-[#15171e] border-gray-200 dark:border-gray-700'
                                        }`}>
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
                                                <div>
                                                    <span className="font-bold text-sm text-gray-900 dark:text-white block">{line.itemName}</span>
                                                    <span className="text-[10px] text-gray-500 font-mono">{line.sku}</span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[10px] text-gray-400">
                                                        Ord: {line.quantityOrdered} | Rec: {line.quantityReceived} | <span className="font-bold text-gray-900 dark:text-white">Rem: {remaining}</span>
                                                    </span>
                                                    {variance === 'OVER' && (
                                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                                            <AlertTriangle size={10}/> Over-receiving (+{inputQty - remaining})
                                                        </span>
                                                    )}
                                                    {variance === 'SHORT' && (
                                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                                            <AlertTriangle size={10}/> Closing Short (-{remaining - inputQty})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-4 items-end">
                                                <div className="w-32">
                                                     <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Qty</label>
                                                     <input 
                                                        type="number" 
                                                        min="0"
                                                        className="w-full p-2 bg-white dark:bg-[#2b2d3b] border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:border-[var(--color-brand)] outline-none"
                                                        value={receipts[line.id] === 0 ? '' : receipts[line.id]}
                                                        placeholder="0"
                                                        onChange={(e) => handleQtyChange(line.id, e.target.value)}
                                                     />
                                                </div>

                                                <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border transition-all select-none ${
                                                    isClosed 
                                                        ? 'bg-gray-200 dark:bg-white/10 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white' 
                                                        : 'hover:bg-gray-50 dark:hover:bg-white/5 border-transparent text-gray-500'
                                                }`}>
                                                    <input 
                                                        type="checkbox" 
                                                        className="hidden"
                                                        checked={isClosed}
                                                        onChange={() => toggleCloseLine(line.id)}
                                                    />
                                                    {isClosed ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                    <span className="text-xs font-medium">Mark Complete</span>
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                                {activeLines.length === 0 && (
                                    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
                                        <AlertTriangle size={32} className="mb-2 text-gray-400" />
                                        <p className="font-medium">No items available to receive.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#15171e] flex justify-end gap-3 rounded-b-2xl">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={Object.values(receipts).every(v => v === 0) && closedLines.size === 0}
                            className={`px-6 py-2.5 font-bold rounded-xl hover:opacity-90 shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2 ${
                                hasAnyVariance 
                                    ? 'bg-amber-500 text-white' 
                                    : 'bg-[var(--color-brand)] text-white'
                            }`}
                        >
                            {hasAnyVariance ? (
                                <>Submit for Approval <AlertTriangle size={16}/></>
                            ) : (
                                'Confirm Receipt'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeliveryModal;
