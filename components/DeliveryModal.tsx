
import React, { useState, useRef, useEffect } from 'react';
import { DeliveryHeader, DeliveryLineItem, PORequest, User, POLineItem, Item } from '../types.ts';
import { X, AlertTriangle, CheckSquare, Square, Plus, Search } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../context/AppContext.tsx';
import { useSubmitGuard } from '../utils/useSubmitGuard.ts';

interface Props {
    po: PORequest;
    currentUser: User;
    onClose: () => void;
    onSubmit: (delivery: DeliveryHeader, closedLineIds: string[], newLines: POLineItem[]) => void;
}

const DeliveryModal = ({ po, currentUser, onClose, onSubmit }: Props) => {
    const { items } = useApp();
    const [docketNumber, setDocketNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [receipts, setReceipts] = useState<Record<string, number>>({});
    const [closedLines, setClosedLines] = useState<Set<string>>(new Set());
    
    // Unplanned Items State
    const [additionalLines, setAdditionalLines] = useState<POLineItem[]>([]);
    const [lineSearchQuery, setLineSearchQuery] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const { isSubmitting, guardedSubmit } = useSubmitGuard();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // Show all lines to allow corrections or extra receipts
    const activeLines = [...po.lines, ...additionalLines];
    const filteredActiveLines = activeLines.filter(line => 
        line.itemName.toLowerCase().includes(lineSearchQuery.toLowerCase()) || 
        line.sku.toLowerCase().includes(lineSearchQuery.toLowerCase())
    );

    const availableItems = items.filter(i => 
        i.activeFlag !== false && 
        !activeLines.some(l => l.itemId === i.id) &&
        (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku?.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 10);

    const handleAddUnplannedItem = (item: Item) => {
        const newLine: POLineItem = {
            id: uuidv4(),
            itemId: item.id,
            itemName: item.name,
            sku: item.sku || 'N/A',
            quantityOrdered: 0,
            quantityReceived: 0,
            unitPrice: item.unitPrice || 0,
            totalPrice: 0,
            isForceClosed: false
        };
        setAdditionalLines(prev => [...prev, newLine]);
        setSearchQuery('');
        setIsSearchOpen(false);
    };

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
        guardedSubmit(() => {
            const deliveryLines: DeliveryLineItem[] = Object.entries(receipts)
                .filter(([_, qty]) => (qty as number) > 0)
                .map(([lineId, qty]) => ({
                    id: uuidv4(),
                    poLineId: lineId,
                    quantity: qty as number,
                    isCapitalised: false, 
                    invoiceNumber: '' 
                }));

            if (deliveryLines.length === 0 && closedLines.size === 0) return;

            const header: DeliveryHeader = {
                id: uuidv4(),
                date,
                docketNumber,
                receivedBy: currentUser.name,
                lines: deliveryLines
            };
            
            onSubmit(header, Array.from(closedLines), additionalLines);
        });
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
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20}/>
                    </button>
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide shrink-0">Select Items to Receive</h3>
                                {activeLines.length > 5 && (
                                    <div className="relative flex-1 max-w-sm">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                            <Search size={14}/>
                                        </span>
                                        <input 
                                            type="text"
                                            placeholder="Filter items by name or SKU..."
                                            value={lineSearchQuery}
                                            onChange={e => setLineSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:border-[var(--color-brand)] dark:text-white transition-all"
                                        />
                                        {lineSearchQuery && (
                                            <button 
                                                type="button"
                                                onClick={() => setLineSearchQuery('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                            >
                                                <X size={12}/>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3">
                                {filteredActiveLines.map(line => {
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
                                {filteredActiveLines.length === 0 && (
                                    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
                                        <AlertTriangle size={32} className="mb-2 text-gray-400" />
                                        <p className="font-medium text-sm">
                                            {lineSearchQuery ? `No items match "${lineSearchQuery}"` : "No items available to receive."}
                                        </p>
                                        {lineSearchQuery && (
                                            <button 
                                                type="button" 
                                                onClick={() => setLineSearchQuery('')}
                                                className="mt-2 text-xs text-[var(--color-brand)] hover:underline font-medium"
                                            >
                                                Clear search filters
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Unplanned Item Search */}
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800" ref={searchRef}>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-3">Add Unplanned Item</h4>
                                    <div className="relative">
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-400"><Search size={18}/></span>
                                            <input 
                                                type="text"
                                                placeholder="Search master catalog..."
                                                value={searchQuery}
                                                onChange={e => {
                                                    setSearchQuery(e.target.value);
                                                    setIsSearchOpen(true);
                                                }}
                                                onFocus={() => setIsSearchOpen(true)}
                                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:border-blue-500 outline-none transition-all dark:text-white"
                                            />
                                        </div>
                                        
                                        {isSearchOpen && (searchQuery.length > 0 || availableItems.length > 0) && (
                                            <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
                                                {availableItems.length > 0 ? (
                                                    availableItems.map(item => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => handleAddUnplannedItem(item)}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex justify-between items-center group transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                                                        >
                                                            <div>
                                                                <span className="font-semibold text-gray-900 dark:text-white block text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400">{item.name}</span>
                                                                <span className="text-[10px] text-gray-500 font-mono">{item.sku}</span>
                                                            </div>
                                                            <Plus size={16} className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"/>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                                                        No matches found in master catalog
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Use this to receive items that arrived on the delivery but were not part of the original purchase order.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#15171e] flex justify-end gap-3 rounded-b-2xl">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting || (Object.values(receipts).every(v => v === 0) && closedLines.size === 0)}
                            className={`px-6 py-2.5 font-bold rounded-xl hover:opacity-90 shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2 ${
                                hasAnyVariance 
                                    ? 'bg-amber-500 text-white' 
                                    : 'bg-[var(--color-brand)] text-white'
                            }`}
                        >
                            {isSubmitting ? 'Submitting...' : hasAnyVariance ? (
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
