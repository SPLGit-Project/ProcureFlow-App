
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Calendar, Filter, FileText, ChevronDown, ChevronRight, CheckCircle2, DollarSign } from 'lucide-react';
import ContextHelp from './ContextHelp';

const FinanceView = () => {
  const { pos, updateFinanceInfo } = useApp();
  const [filterSupplier, setFilterSupplier] = useState('');
  const [viewStatus, setViewStatus] = useState<'OUTSTANDING' | 'CAPITALISED'>('OUTSTANDING');
  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({});


  const togglePO = (poId: string) => {
    setExpandedPOs(prev => ({ ...prev, [poId]: !prev[poId] }));
  };
  
  // Group lines by PO -> Delivery
  const groupedData = pos.filter(po => 
      // Filter primarily by supplier at the top level
      po.supplierName.toLowerCase().includes(filterSupplier.toLowerCase()) || 
      po.lines.some(l => l.itemName.toLowerCase().includes(filterSupplier.toLowerCase()))
  ).map(po => {
      // Get all deliveries for this PO
      const deliveries = po.deliveries.map(del => {
          // Map lines within delivery and filter by viewStatus
          const lines = del.lines
            .filter(dLine => {
                const matchesSearch = po.supplierName.toLowerCase().includes(filterSupplier.toLowerCase()) || 
                                     po.lines.find(l => l.id === dLine.poLineId)?.itemName.toLowerCase().includes(filterSupplier.toLowerCase());
                
                const matchesStatus = viewStatus === 'OUTSTANDING' ? !dLine.isCapitalised : dLine.isCapitalised;
                
                return matchesSearch && matchesStatus;
            })
            .map(dLine => {
              const poLine = po.lines.find(l => l.id === dLine.poLineId);
              return {
                  lineId: dLine.id, 
                  poLineId: dLine.poLineId,
                  item: poLine?.itemName || 'Unknown',
                  sku: poLine?.sku || '',
                  qty: dLine.quantity,
                  unitPrice: poLine?.unitPrice || 0,
                  totalValue: (poLine?.unitPrice || 0) * dLine.quantity,
                  data: dLine 
              };
          });
          
          return {
              deliveryId: del.id,
              date: del.date,
              docket: del.docketNumber,
              receivedBy: del.receivedBy,
              lines,
              totalValue: lines.reduce((sum, l) => sum + l.totalValue, 0)
          };
      });


      return {
          poId: po.id,
          displayId: po.displayId || po.id.substring(0, 8).toUpperCase(),
          concurPo: po.lines[0]?.concurPoNumber || 'Pending',
          supplier: po.supplierName,
          requestDate: po.requestDate,
          totalAmount: po.totalAmount, // PO Total
          deliveries: deliveries.filter(d => d.lines.length > 0) // Only show deliveries with lines
      };
  }).filter(po => po.deliveries.length > 0); // Only show POs with deliveries

  const handleToggleCap = (poId: string, deliveryId: string, lineId: string, currentVal: boolean) => {
      // For month input, we use YYYY-MM
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      updateFinanceInfo(poId, deliveryId, lineId, { 
          isCapitalised: !currentVal, 
          capitalisedDate: !currentVal ? monthStr : undefined 
      });
  };


  const handleDateChange = (poId: string, deliveryId: string, lineId: string, newDate: string) => {
      updateFinanceInfo(poId, deliveryId, lineId, { capitalisedDate: newDate });
  };

  const handleInvoiceChange = (poId: string, deliveryId: string, lineId: string, val: string) => {
      updateFinanceInfo(poId, deliveryId, lineId, { invoiceNumber: val });
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Finance Review</h1>
            <ContextHelp 
                title="Finance & Capitalization" 
                description="Learn how to match invoices and capitalise assets correctly." 
                linkTarget="finance-capitalization"
            />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage capitalization and invoices for received goods.</p>
      </div>

      <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] flex flex-col md:flex-row items-center gap-4">
             <div className="relative w-full md:max-w-md">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                 <input 
                    type="text" 
                    placeholder="Search Supplier or Item..." 
                    className="pl-10 pr-4 py-2.5 w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] transition-all"
                    value={filterSupplier}
                    onChange={e => setFilterSupplier(e.target.value)}
                 />
             </div>

             <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                <button 
                  onClick={() => setViewStatus('OUTSTANDING')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewStatus === 'OUTSTANDING' ? 'bg-white dark:bg-[#2b2d3b] text-[var(--color-brand)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Outstanding
                </button>
                <button 
                  onClick={() => setViewStatus('CAPITALISED')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewStatus === 'CAPITALISED' ? 'bg-white dark:bg-[#2b2d3b] text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Capitalised
                </button>
             </div>

             <div className="w-full md:w-auto ml-auto text-sm text-gray-500 flex items-center justify-end gap-2 bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                 <Filter size={14}/> {groupedData.length} POs found
             </div>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {groupedData.map(po => {
                const isExpanded = expandedPOs[po.poId] !== false; // Default expanded? or default collapsed. Let's default expand for visibility
                const fullyCapitalised = po.deliveries.every(d => d.lines.every(l => l.data.isCapitalised));

                return (
                    <div key={po.poId} className="bg-white dark:bg-[#1e2029]">
                        {/* PO Header */}
                        <div 
                            className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2b2d3b] transition-colors"
                            onClick={() => togglePO(po.poId)}
                        >
                            <div className="flex items-center gap-4">
                                {isExpanded ? <ChevronDown size={20} className="text-gray-400"/> : <ChevronRight size={20} className="text-gray-400"/>}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white text-lg">{po.supplier}</span>
                                        {fullyCapitalised && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex items-center gap-1"><CheckCircle2 size={10}/> Fully Capitalised</span>}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                        <span className="font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">PO: {po.concurPo}</span>
                                        <span>Req: {po.requestDate}</span>
                                        <span>{po.deliveries.length} Deliveries</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-gray-900 dark:text-white text-lg">${po.totalAmount.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">Total PO Value</div>
                            </div>
                        </div>

                        {/* Expandable Content (Deliveries) */}
                        {isExpanded && (
                            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#15171e]/50 pl-4 md:pl-10 pr-4 pb-6 pt-2 space-y-4">
                                {po.deliveries.map(del => (
                                    <div key={del.deliveryId} className="bg-white dark:bg-[#1e2029] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 dark:bg-white/5 px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={12}/> Delivery: {del.date}
                                                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-1"></span>
                                                <span>Docket: {del.docket}</span>
                                            </div>
                                            <div>Received By: {del.receivedBy}</div>
                                        </div>
                                        
                                        <div className="overflow-x-auto">

                                            {/* Desktop Table View */}
                                            <table className="w-full text-sm text-left hidden md:table">
                                                <thead>
                                                    <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                                                        <th className="px-4 py-3 font-normal">Item Details</th>
                                                        <th className="px-4 py-3 font-normal text-center w-24">Qty</th>
                                                        <th className="px-4 py-3 font-normal text-right w-32">Value</th>
                                                        <th className="px-4 py-3 font-normal w-48">Invoice #</th>
                                                        <th className="px-4 py-3 font-normal w-40 text-center">Capitalisation</th>
                                                        <th className="px-4 py-3 font-normal w-40">Cap Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {del.lines.map(line => (
                                                        <tr key={line.lineId} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-gray-900 dark:text-white">{line.item}</div>
                                                                <div className="text-xs text-gray-400 font-mono">{line.sku}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                                                                {line.qty}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                                                ${line.totalValue.toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="relative">
                                                                    <FileText size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                                                                    <input 
                                                                        type="text"
                                                                        className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 pl-7 text-xs text-gray-900 dark:text-white focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] outline-none transition-all placeholder:text-gray-300"
                                                                        value={line.data.invoiceNumber || ''}
                                                                        placeholder="INV-..."
                                                                        onChange={(e) => handleInvoiceChange(po.poId, del.deliveryId, line.lineId, e.target.value)}
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button 
                                                                    onClick={() => handleToggleCap(po.poId, del.deliveryId, line.lineId, line.data.isCapitalised)}
                                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#1e2029] ${line.data.isCapitalised ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                                                                >
                                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${line.data.isCapitalised ? 'translate-x-6' : 'translate-x-1'}`} />
                                                                </button>
                                                                <div className="text-[10px] mt-1 text-gray-400">{line.data.isCapitalised ? 'Asset' : 'Expense'}</div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {line.data.isCapitalised && (
                                                                    <div className={`flex items-center gap-1 border rounded px-2 py-1 transition-all ${line.data.isCapitalised ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800' : 'border-gray-200'}`}>
                                                                        <Calendar size={12} className="text-green-600 dark:text-green-400"/>
                                                                        <input 
                                                                            type="month" 
                                                                            className="text-xs border-none bg-transparent focus:ring-0 cursor-pointer text-gray-700 dark:text-gray-300 w-full p-0 font-medium"
                                                                            value={line.data.capitalisedDate || ''}
                                                                            onChange={(e) => handleDateChange(po.poId, del.deliveryId, line.lineId, e.target.value)}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {/* Mobile Card View */}
                                            <div className="md:hidden space-y-3 p-3">
                                                {del.lines.map(line => (
                                                    <div key={line.lineId} className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 space-y-3 border border-gray-100 dark:border-gray-800">
                                                        <div className="flex justify-between items-start gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{line.item}</div>
                                                                <div className="text-xs text-gray-400 font-mono">{line.sku}</div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className="font-bold text-gray-900 dark:text-white text-sm">${line.totalValue.toLocaleString()}</div>
                                                                <div className="text-xs text-gray-500">Qty: {line.qty}</div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Invoice Number</label>
                                                                <div className="relative">
                                                                    <FileText size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                                                                    <input 
                                                                        type="text"
                                                                        className="w-full bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 pl-7 text-xs text-gray-900 dark:text-white focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] outline-none"
                                                                        value={line.data.invoiceNumber || ''}
                                                                        placeholder="INV-..."
                                                                        onChange={(e) => handleInvoiceChange(po.poId, del.deliveryId, line.lineId, e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between bg-white dark:bg-[#1e2029] p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Capitalise</span>
                                                                    <span className="text-[10px] text-gray-400">{line.data.isCapitalised ? 'Asset' : 'Expense'}</span>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleToggleCap(po.poId, del.deliveryId, line.lineId, line.data.isCapitalised)}
                                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${line.data.isCapitalised ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                                                                >
                                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${line.data.isCapitalised ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                                                </button>
                                                            </div>

                                                            {line.data.isCapitalised && (
                                                                <div>
                                                                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Cap Date</label>
                                                                    <div className="flex items-center gap-2 bg-white dark:bg-[#1e2029] border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                                                                        <Calendar size={14} className="text-green-600 dark:text-green-400"/>
                                                                        <input 
                                                                            type="month" 
                                                                            className="text-xs border-none bg-transparent focus:ring-0 cursor-pointer text-gray-700 dark:text-gray-300 w-full p-0 font-medium"
                                                                            value={line.data.capitalisedDate || ''}
                                                                            onChange={(e) => handleDateChange(po.poId, del.deliveryId, line.lineId, e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
             
            {groupedData.length === 0 && (
                <div className="text-center py-20">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-[#15171e] rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <DollarSign size={24}/>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Received Orders Found</h3>
                    <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">There are no received orders matching your search criteria. Confirm orders have been marked as 'received' to appear here.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default FinanceView;
