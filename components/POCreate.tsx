
import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../context/AppContext';
import { Item, ItemPriceOption, POLineItem, PORequest, Site } from '../types';
import { 
  ShoppingCart, 
  Search, 
  MapPin, 
  Package, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  ArrowRight,
  X,
  DollarSign,
  ChevronLeft,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ContextHelp from './ContextHelp';
import { getDefaultItemPriceOption, normalizeItemPriceOptions } from '../utils/itemPricing';

const PRICE_MATCH_TOLERANCE = 0.0001;

const getPriceOptionMatchKey = (priceOptionId?: string, priceOptionLabel?: string) => {
  if (priceOptionId && priceOptionId.trim()) return `id:${priceOptionId.trim()}`;
  if (priceOptionLabel && priceOptionLabel.trim()) return `label:${priceOptionLabel.trim().toLowerCase()}`;
  return 'manual';
};

const isSameCartPriceLine = (
  line: POLineItem,
  itemId: string,
  unitPrice: number,
  priceOptionId?: string,
  priceOptionLabel?: string
) => {
  if (line.itemId !== itemId) return false;
  if (Math.abs(Number(line.unitPrice || 0) - Number(unitPrice || 0)) > PRICE_MATCH_TOLERANCE) return false;
  return getPriceOptionMatchKey(line.priceOptionId, line.priceOptionLabel) === getPriceOptionMatchKey(priceOptionId, priceOptionLabel);
};

const POCreate = () => {
  const { items, suppliers, sites: allSites, userSites, mappings, stockSnapshots, currentUser, createPO, getEffectiveStock, reloadData } = useApp();
  // Use userSites for the dropdown (only sites user has access to), allSites for display lookups
  const sites = userSites;
  const navigate = useNavigate();
  
  // Auto-Refresh Data on Mount
  useEffect(() => {
      reloadData();
  }, [reloadData]);

  // Header State
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);
  
  // New Header Fields
  const [customerName, setCustomerName] = useState('');
  const [reasonForRequest, setReasonForRequest] = useState<'Depletion' | 'New Customer' | 'Other'>('Depletion');
  const [comments, setComments] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);

  
  // Cart & Item State
  const [cart, setCart] = useState<POLineItem[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [isCartExpanded, setIsCartExpanded] = useState(true);
  const [isCatalogExpanded, setIsCatalogExpanded] = useState(true); // Default open
  const [searchTerm, setSearchTerm] = useState('');
  
  // Mobile Cart Drawer State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  
  // Modal State
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalPrice, setModalPrice] = useState('');
  const [modalUpq, setModalUpq] = useState(1); // Default UPQ
  const [modalPriceOptionId, setModalPriceOptionId] = useState('');
  const [modalPriceOptions, setModalPriceOptions] = useState<ItemPriceOption[]>([]);

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  // Only active master items should be available for request creation.
  const activeMasterItems = useMemo(() => {
    return (items || []).filter(item => item.activeFlag !== false);
  }, [items]);

  const activeItemIds = useMemo(() => {
    return new Set(
      activeMasterItems
        .map(item => item.id)
        .filter((id): id is string => Boolean(id))
    );
  }, [activeMasterItems]);

  // Determine available items from active master list.
  const displayItems = useMemo(() => {
    if (!activeMasterItems.length) return [];

    const effectiveItems = activeMasterItems.filter(item => 
        (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (item.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return effectiveItems.map(internalItem => {
        let supplierSku = 'N/A';
        let supplierCode = 'N/A';
        const priceOptions = normalizeItemPriceOptions(internalItem);
        const defaultPriceOption = getDefaultItemPriceOption({ ...internalItem, priceOptions });
        let estimatedPrice = defaultPriceOption.price || internalItem.unitPrice || 0;
        let effectiveStock = 0;
        let isMapped = false;

        if (selectedSupplierId && mappings) {
             // Find mapping for THIS supplier
             const mapping = mappings.find(m => m.supplierId === selectedSupplierId && m.productId === internalItem.id && m.mappingStatus === 'CONFIRMED');
             
             if (mapping) {
                 isMapped = true;
                 supplierSku = mapping.supplierSku;
                 supplierCode = mapping.supplierCustomerStockCode || 'N/A';

                 // Look up Stock
                 const safeSnapshots = Array.isArray(stockSnapshots) ? stockSnapshots : [];
                 const latestSnapshot = safeSnapshots
                    .filter(s => s.supplierId === selectedSupplierId && s.supplierSku === mapping.supplierSku)
                    .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime())[0];
                
                 if (latestSnapshot) {
                     estimatedPrice = latestSnapshot.sellPrice || estimatedPrice;
                 }
                 
                 effectiveStock = getEffectiveStock(internalItem.id, selectedSupplierId);
             }
        }

        return {
            ...internalItem,
            priceOptions,
            priceOptionCount: priceOptions.length,
            supplierSku, // Now might be 'N/A'
            supplierCode, 
            price: estimatedPrice,
            effectiveStock,
            isMapped // Helper flag for UI if needed
        };
    });
  }, [selectedSupplierId, mappings, activeMasterItems, stockSnapshots, searchTerm, getEffectiveStock]);

  const getPrice = (itemId: string, defaultPrice: number) => {
      // return overridePrices[itemId] !== undefined ? overridePrices[itemId] : defaultPrice;
      return defaultPrice; // Overrides handled in Modal now
  };

  const sanitizeQuantity = (value: string, fallback: number): number => {
    const digitsOnly = (value || '').replace(/\D/g, '');
    if (!digitsOnly) return Math.max(1, fallback);
    const parsed = parseInt(digitsOnly, 10);
    if (isNaN(parsed)) return Math.max(1, fallback);
    return Math.max(1, parsed);
  };

  useEffect(() => {
    setQuantityDrafts(prev => {
      const next: Record<string, string> = {};
      cart.forEach(line => {
        next[line.id] = prev[line.id] !== undefined ? prev[line.id] : String(line.quantityOrdered);
      });
      return next;
    });
  }, [cart]);

  const addToCart = (item: any) => {
    // Quick Add: Default to 1 and estimated price
    const finalUnitPrice = item.price;
    const quantityToAdd = 1;
    const defaultPriceOption = getDefaultItemPriceOption(item);
    const selectedPriceOptionLabel = Math.abs((defaultPriceOption.price || 0) - Number(finalUnitPrice || 0)) < 0.0001
      ? defaultPriceOption.label
      : 'Estimated (Current Supplier)';
    const selectedPriceOptionId = Math.abs((defaultPriceOption.price || 0) - Number(finalUnitPrice || 0)) < 0.0001
      ? defaultPriceOption.id
      : 'estimated-current';
    
    setCart(prev => {
      const existing = prev.find(line =>
        isSameCartPriceLine(
          line,
          item.id,
          finalUnitPrice,
          selectedPriceOptionId,
          selectedPriceOptionLabel
        )
      );
      if (existing) {
        const newQty = existing.quantityOrdered + quantityToAdd;
        return prev.map(line => 
          line.id === existing.id
          ? {
              ...line,
              quantityOrdered: newQty,
              totalPrice: Number((newQty * line.unitPrice).toFixed(2)),
              priceOptionId: line.priceOptionId ?? selectedPriceOptionId,
              priceOptionLabel: line.priceOptionLabel ?? selectedPriceOptionLabel
            }
          : line
        );
      }
      return [...prev, {
        id: uuidv4(),
        itemId: item.id!,
        itemName: item.name!,
        sku: item.sku, 
        quantityOrdered: quantityToAdd,
        quantityReceived: 0,
        unitPrice: Number(finalUnitPrice || 0),
        totalPrice: Number((finalUnitPrice * quantityToAdd).toFixed(2)),
        priceOptionLabel: selectedPriceOptionLabel,
        priceOptionId: selectedPriceOptionId
      }];
    });
  };

  const updateQuantity = (lineId: string, delta: number) => {
    let nextQty = 1;
    setCart(prev => prev.map(line => {
      if (line.id === lineId) {
        const baseQty = sanitizeQuantity(
          quantityDrafts[line.id] ?? String(line.quantityOrdered),
          line.quantityOrdered
        );
        nextQty = Math.max(1, baseQty + delta);
        return { ...line, quantityOrdered: nextQty, totalPrice: nextQty * line.unitPrice };
      }
      return line;
    }));
    setQuantityDrafts(prev => ({ ...prev, [lineId]: String(nextQty) }));
  };

  const updateQuantityDraft = (lineId: string, quantityValue: string) => {
    const digitsOnly = (quantityValue || '').replace(/\D/g, '');
    setQuantityDrafts(prev => ({ ...prev, [lineId]: digitsOnly }));
  };

  const commitQuantityDraft = (lineId: string, quantityValue?: string) => {
    let parsedQty = 1;
    setCart(prev => prev.map(line => {
      if (line.id === lineId) {
        parsedQty = sanitizeQuantity(
          quantityValue ?? quantityDrafts[lineId] ?? String(line.quantityOrdered),
          line.quantityOrdered
        );
        return { ...line, quantityOrdered: parsedQty, totalPrice: parsedQty * line.unitPrice };
      }
      return line;
    }));
    setQuantityDrafts(prev => ({ ...prev, [lineId]: String(parsedQty) }));
  };

  const updateLinePrice = (lineId: string, newPriceVal: string) => {
    const newPrice = parseFloat(newPriceVal);
    if (isNaN(newPrice)) return;
    setCart(prev => prev.map(line => {
        if (line.id === lineId) {
            return { ...line, unitPrice: newPrice, totalPrice: line.quantityOrdered * newPrice };
        }
        return line;
    }));
  };

  const removeFromCart = (lineId: string) => {
    setCart(prev => prev.filter(l => l.id !== lineId));
  };
  
  // Modal Handlers
  const openItemDetail = (item: any) => {
      setSelectedDetailItem(item);
      setModalQuantity(1); // Default to 1, or check cart?
      // Check if already in cart
      const existingLine = cart.find(l => l.itemId === item.id);
      if (existingLine) {
          setModalQuantity(1); // Keep 1? Or pre-fill with extra? User said "select quantity". Usually means "add X".
      }
      const baseOptions = normalizeItemPriceOptions(item);
      const hasEstimatedMatch = baseOptions.some(opt => Math.abs(opt.price - Number(item.price || 0)) < 0.0001);
      const effectiveOptions = (!hasEstimatedMatch && Number(item.price || 0) > 0)
          ? [{ id: 'estimated-current', label: 'Estimated (Current Supplier)', price: Number(item.price || 0), isDefault: true, activeFlag: true }, ...baseOptions.map(opt => ({ ...opt, isDefault: false }))]
          : baseOptions;

      const defaultOption = effectiveOptions.find(opt => opt.isDefault) || effectiveOptions[0];
      setModalPriceOptions(effectiveOptions);
      setModalPriceOptionId(defaultOption?.id || '');
      setModalPrice((defaultOption?.price ?? item.price ?? 0).toString());
      setModalUpq(item.upq || 1);
  };

  const handleModalAdd = () => {
      if (!selectedDetailItem) return;
      
      const qty = modalQuantity;
      const price = Math.max(0, parseFloat(modalPrice) || 0);
      const upq = modalUpq;
      const selectedPriceOption = modalPriceOptions.find(opt => opt.id === modalPriceOptionId);
      const selectedPriceOptionId = selectedPriceOption?.id || modalPriceOptionId || undefined;
      const selectedPriceOptionLabel = selectedPriceOption?.label || undefined;
      
      if (qty <= 0) return;

      // Add to cart logic (similar to addToCart but specific values)
      setCart(prev => {
          const existing = prev.find(line =>
              isSameCartPriceLine(
                  line,
                  selectedDetailItem.id,
                  price,
                  selectedPriceOptionId,
                  selectedPriceOptionLabel
              )
          );
          if (existing) {
              const newQty = existing.quantityOrdered + qty;
              return prev.map(line => 
                  line.id === existing.id
                  ? {
                      ...line,
                      quantityOrdered: newQty,
                      totalPrice: Number((newQty * line.unitPrice).toFixed(2)),
                      priceOptionId: line.priceOptionId ?? selectedPriceOptionId,
                      priceOptionLabel: line.priceOptionLabel ?? selectedPriceOptionLabel
                    }
                  : line
              );
          }
          return [...prev, {
              id: uuidv4(),
              itemId: selectedDetailItem.id,
              itemName: selectedDetailItem.name,
              sku: selectedDetailItem.sku,
              quantityOrdered: qty,
              quantityReceived: 0,
              unitPrice: price,
              totalPrice: Number((price * qty).toFixed(2)),
              upq: upq,
              priceOptionId: selectedPriceOptionId,
              priceOptionLabel: selectedPriceOptionLabel
          }];
      });

      setSelectedDetailItem(null);
  };

  const handleSubmit = () => {
    if (!selectedSupplier || !selectedSite || cart.length === 0) return;

    const archivedCartLines = cart.filter(line => !activeItemIds.has(line.itemId));
    if (archivedCartLines.length > 0) {
        const removedNames = archivedCartLines.map(line => line.itemName).join(', ');
        setCart(prev => prev.filter(line => activeItemIds.has(line.itemId)));
        alert(`Some items were archived and removed from your cart: ${removedNames}. Please review and submit again.`);
        return;
    }

    if (reasonForRequest === 'Other' && !comments.trim()) {
        alert('Please provide Additional Comments when selecting "Other" as the reason.');
        return;
    }

    const newPO: PORequest = {
      id: uuidv4(),
      requestDate: requestDate,
      requesterId: currentUser.id,

      requesterName: currentUser.name,
      siteId: selectedSite.id,
      site: selectedSite.name,
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      status: 'PENDING_APPROVAL',
      totalAmount: cart.reduce((sum, line) => sum + line.totalPrice, 0),
      lines: cart,
      approvalHistory: [
        { id: uuidv4(), action: 'SUBMITTED', approverName: currentUser.name, date: new Date().toISOString() }
      ],
      deliveries: [],
      customerName,
      reasonForRequest,
      comments
    };

    createPO(newPO);
    navigate('/requests');
  };

  const cartTotal = cart.reduce((s, l) => s + l.totalPrice, 0);

  // Cart Component (Used in Desktop Sidebar and Mobile Drawer)
  const CartContent = () => (
      <div className="flex flex-col h-full animate-fade-in">
         <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-600 text-sm flex flex-col items-center">
                    <ShoppingCart size={48} className="mb-3 opacity-20" />
                    <p>Your cart is empty.</p>
                    <p className="text-xs">Add items from the catalog.</p>
                </div>
            ) : (
                cart.map(line => (
                    <div key={line.id} className="flex flex-col gap-3 border-b border-gray-100 dark:border-gray-800 pb-4 last:border-0">
                         <div className="flex justify-between items-start gap-2">
                             <div className="min-w-0">
                                 <p className="text-sm font-semibold text-gray-900 dark:text-gray-200 line-clamp-2">{line.itemName}</p>
                                 <p className="text-xs text-gray-500 font-mono mt-0.5">{line.sku}</p>
                                 {line.priceOptionLabel && (
                                     <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">{line.priceOptionLabel}</p>
                                 )}
                             </div>
                             <button onClick={() => removeFromCart(line.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 size={16}/></button>
                         </div>
                         
                         <div className="flex items-end justify-between gap-4">
                             <div className="flex items-center gap-3">
                                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#15171e]">
                                    <button onClick={() => updateQuantity(line.id, -1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500"><Minus size={14}/></button>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={quantityDrafts[line.id] ?? String(line.quantityOrdered)}
                                        onChange={(e) => updateQuantityDraft(line.id, e.target.value)}
                                        onBlur={(e) => commitQuantityDraft(line.id, e.target.value)}
                                        onFocus={(e) => e.currentTarget.select()}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.currentTarget.blur();
                                          }
                                        }}
                                        className="w-16 text-center text-sm font-semibold text-gray-900 dark:text-white bg-transparent outline-none"
                                    />
                                    <button onClick={() => updateQuantity(line.id, 1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500"><Plus size={14}/></button>
                                </div>
                             </div>
                             
                             <div className="flex flex-col items-end">
                                 <div className="flex items-center gap-1 mb-1">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold">Price</span>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.01"
                                        className="w-16 text-right bg-transparent border-b border-gray-300 dark:border-gray-700 p-0 text-sm text-gray-900 dark:text-white focus:border-[var(--color-brand)] outline-none"
                                        value={line.unitPrice}
                                        onChange={(e) => updateLinePrice(line.id, e.target.value)}
                                    />
                                 </div>
                                 <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                                     {line.quantityOrdered.toLocaleString()} x ${line.unitPrice.toFixed(2)}
                                 </span>
                                 <span className="font-bold text-gray-900 dark:text-white">${line.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                             </div>
                         </div>
                    </div>
                ))
            )}
         </div>
         <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#15171e] shrink-0 pb-safe-or-4">
             <div className="flex justify-between items-center mb-4">
                 <span className="text-gray-500 dark:text-gray-400 text-sm">Total Estimated</span>
                 <span className="text-xl font-bold text-gray-900 dark:text-white">
                     ${cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                 </span>
             </div>
             <button 
               onClick={handleSubmit}
               disabled={cart.length === 0}
               className="w-full bg-[var(--color-brand)] text-white py-3.5 rounded-xl font-bold shadow-lg shadow-[var(--color-brand)]/20 hover:opacity-90 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
             >
                Submit Request <ArrowRight size={18} />
             </button>
         </div>
      </div>
  );

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-8 max-w-[1600px] mx-auto min-h-0 md:h-[calc(100dvh-6rem)]">
      {/* Top Header */}
      <div className="shrink-0 flex justify-between items-start md:items-center">
        <div>
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Request</h1>
                <ContextHelp 
                    title="Creating Requests" 
                    description="Learn how to select suppliers, add items, and submit orders for approval." 
                    linkTarget="creating-requests"
                />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Build your order from supplier catalogs.</p>
        </div>
      </div>

      {/* Selection Panel */}
      <div className="shrink-0 bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 transition-all duration-300">
        {/* Toggle Header */}
        <div 
            className="p-4 flex items-center justify-between cursor-pointer group"
            onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
        >
             <div className="flex items-center gap-4 sm:gap-6 overflow-hidden">
                 {/* Site Summary */}
                 <div className="flex items-center gap-2 min-w-0">
                     <div className={`p-2 rounded-lg transition-colors ${selectedSite ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                         <MapPin size={18} />
                     </div>
                     <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Delivery Site</span>
                         <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                             {selectedSite ? selectedSite.name : 'Select Site...'}
                         </span>
                     </div>
                 </div>

                 {/* Divider */}
                 <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>

                 {/* Supplier Summary */}
                 <div className="flex items-center gap-2 min-w-0">
                     <div className={`p-2 rounded-lg transition-colors ${selectedSupplier ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                         <Package size={18} /> 
                     </div>
                     <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Supplier</span>
                         <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                             {selectedSupplier ? selectedSupplier.name : 'Select Supplier...'}
                         </span>
                     </div>
                 </div>

                 {/* Request Details Summary (if set) */}
                 {customerName && (
                     <>
                        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden lg:block"></div>
                        <div className="hidden lg:flex items-center gap-2 min-w-0">
                            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400">
                                <User size={18} /> 
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">For Customer</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                                    {customerName}
                                </span>
                            </div>
                        </div>
                     </>
                 )}
             </div>

             <div className="flex items-center gap-3">
                 <span className="text-xs text-gray-400 hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                     {isHeaderExpanded ? 'Collapse' : 'Expand'}
                 </span>
                 <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-500 transition-colors">
                     {isHeaderExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                 </button>
             </div>
        </div>

        {/* Expanded Content */}
        {isHeaderExpanded && (
            <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-800 animate-fade-in mt-2">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Column 1: Core Logistics */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Delivery Site <span className="text-red-500">*</span></label>
                            <select 
                                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                            >
                                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Supplier <span className="text-red-500">*</span></label>
                            <select 
                                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                                value={selectedSupplierId}
                                onChange={(e) => {
                                    setSelectedSupplierId(e.target.value);
                                    setCart([]); 
                                }}
                            >
                                <option value="">Select a supplier...</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {/* Column 2: Dates & References */}
                    <div className="space-y-4">
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Request Date <span className="text-red-500">*</span></label>
                             <div className="relative">
                                 <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                 <input 
                                    type="date"
                                    className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-3 py-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                                    value={requestDate}
                                    onChange={(e) => setRequestDate(e.target.value)}
                                 />
                             </div>
                        </div>

                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customer Name</label>
                             <input 
                                type="text"
                                placeholder="E.g. Hilton Hotel, Crown Casino"
                                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                             />
                        </div>
                    </div>

                    {/* Column 3: Request Details */}
                    <div className="space-y-4">
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reason for Request <span className="text-red-500">*</span></label>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                 {['Depletion', 'New Customer', 'Other'].map(option => (
                                     <button
                                        key={option}
                                        onClick={() => setReasonForRequest(option as any)}
                                        className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${reasonForRequest === option 
                                            ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)] shadow-sm' 
                                            : 'bg-white dark:bg-[#15171e] text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                                     >
                                         {option}
                                     </button>
                                 ))}
                             </div>
                        </div>
                    </div>

                    {/* Column 4: Comments & Logic */}
                    <div className="space-y-4 flex flex-col">
                        <div className="flex-1">
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                 Additional Comments {reasonForRequest === 'Other' && <span className="text-red-500">*</span>}
                             </label>
                             <textarea 
                                placeholder={reasonForRequest === 'Other' ? "Please explain the reason for this request..." : "Any special delivery instructions?"}
                                className={`w-full bg-gray-50 dark:bg-[#15171e] border rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] transition-all resize-none h-[118px] ${reasonForRequest === 'Other' && !comments ? 'border-red-300 dark:border-red-900/50' : 'border-gray-200 dark:border-gray-700'}`}
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                             />
                        </div>
                    </div>
                </div>

            </div>
        )}
      </div>

      {/* Main Split View */}
      {selectedSupplierId ? (
        <div className="flex-1 flex gap-6 min-h-0">
          
          {/* Left: Catalog Grid */}
          <div 
             className={`flex flex-col bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 min-h-0 transition-all duration-300 ${isCatalogExpanded ? 'flex-1' : 'w-20 py-6 items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5'}`}
             onClick={!isCatalogExpanded ? () => setIsCatalogExpanded(true) : undefined}
          >
             <div className={`p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] flex items-center gap-3 shrink-0 rounded-t-2xl ${isCatalogExpanded ? '' : 'justify-center border-none bg-transparent p-0'}`}>
                {isCatalogExpanded ? (
                    <>
                        <Search size={18} className="text-gray-400"/>
                        <input 
                          type="text" 
                          placeholder="Search catalog items..." 
                          className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button onClick={() => setIsCatalogExpanded(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 transition-colors">
                            <ChevronLeft size={18}/>
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-6">
                        <button onClick={(e) => { e.stopPropagation(); setIsCatalogExpanded(true); }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 transition-colors">
                            <ChevronRight size={20}/>
                        </button>
                         <div className="rotate-180" style={{ writingMode: 'vertical-rl' }}>
                               <span className="font-bold text-gray-400 text-xs tracking-widest uppercase whitespace-nowrap">Catalog Items</span>
                          </div>
                    </div>
                )}
             </div>
             
             {isCatalogExpanded && (
               <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 content-start">
                 {displayItems.map(item => (
                    <div 
                        key={item.id} 
                        onClick={() => openItemDetail(item)}
                        className="group flex items-center justify-between gap-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#15171e] rounded-xl p-3 hover:border-[var(--color-brand)] hover:shadow-md transition-all cursor-pointer"
                    >
                       {/* Left: Info */}
                       <div className="flex-1 min-w-0 flex items-center gap-4">
                           <div className="shrink-0 flex flex-col items-center gap-1 w-12">
                                <span className="text-[10px] font-mono bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-transparent">
                                    {item.sku}
                                </span>
                           </div>
                           <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">{item.name}</h4>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${item.effectiveStock > 0 ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-500 border-green-200 dark:border-green-500/20' : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-500 border-red-200 dark:border-red-500/20'}`}>
                                        {item.effectiveStock > 0 ? `${item.effectiveStock}` : '0'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 truncate">{item.category || item.subCategory || ''}</p>
                           </div>
                       </div>
                       
                       {/* Right: Price & Action */}
                       <div className="flex items-center gap-4 shrink-0">
                           <div className="text-right">
                               <span className="block text-sm font-bold text-gray-900 dark:text-white">${item.price.toFixed(2)}</span>
                               {item.priceOptionCount > 1 && (
                                   <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400">{item.priceOptionCount} price options</span>
                               )}
                               <span className="text-[10px] text-gray-400 uppercase">{item.uom || 'Unit'}</span>
                           </div>
                           <button 
                                className="bg-gray-50 dark:bg-[#2b2d3b] text-[var(--color-brand)] border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-sm hover:bg-[var(--color-brand)] hover:text-white hover:border-[var(--color-brand)] transition-all"
                            >
                                <Plus size={18} />
                            </button>
                       </div>
                    </div>
                 ))}
                 {displayItems.length === 0 && (
                     <div className="py-12 text-center text-gray-400">
                         No items found matching your search.
                     </div>
                 )}
               </div>
             )}
          </div>

          {/* Item Detail Modal */}
          {selectedDetailItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-start bg-gray-50 dark:bg-white/5">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedDetailItem.name}</h3>
                            <p className="text-sm text-gray-500 font-mono mt-1">{selectedDetailItem.sku} • {selectedDetailItem.category}</p>
                        </div>
                        <button onClick={() => setSelectedDetailItem(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto space-y-6">
                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-gray-800">
                                <span className="block text-xs uppercase font-bold text-gray-400 mb-1">Supplier Ref</span>
                                <span className="font-mono text-gray-900 dark:text-white">{selectedDetailItem.supplierCode || 'N/A'}</span>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-gray-800">
                                <span className="block text-xs uppercase font-bold text-gray-400 mb-1">Stock Available</span>
                                <span className={`font-bold ${selectedDetailItem.effectiveStock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {selectedDetailItem.effectiveStock} {selectedDetailItem.uom || 'Units'}
                                </span>
                            </div>
                        </div>

                        {selectedDetailItem.description && (
                            <div>
                                <h4 className="text-xs uppercase font-bold text-gray-500 mb-2">Description</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                    {selectedDetailItem.description}
                                </p>
                            </div>
                        )}

                        {modalPriceOptions.length > 1 && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Price Option</label>
                                <select
                                    className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] outline-none"
                                    value={modalPriceOptionId}
                                    onChange={(e) => {
                                        const nextId = e.target.value;
                                        setModalPriceOptionId(nextId);
                                        const nextOption = modalPriceOptions.find(opt => opt.id === nextId);
                                        if (nextOption) {
                                            setModalPrice(nextOption.price.toString());
                                        }
                                    }}
                                >
                                    {modalPriceOptions.map(option => (
                                        <option key={option.id} value={option.id}>
                                            {option.label} - ${option.price.toFixed(2)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex gap-4 items-end pt-4 border-t border-gray-100 dark:border-gray-800">
                             <div className="w-1/3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unit Price ($)</label>
                                <div className="relative">
                                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    <input 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl pl-8 pr-3 py-2.5 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] outline-none"
                                        value={modalPrice}
                                        onChange={e => setModalPrice(e.target.value)}
                                    />
                                </div>
                             </div>

                             
                             <div className="w-1/4">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">UPQ</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        min="1"
                                        className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] outline-none"
                                        value={modalUpq}
                                        onChange={e => setModalUpq(Math.max(1, parseInt(e.target.value) || 1))}
                                    />
                                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">x</span>
                                </div>
                             </div>

                             <div className="w-1/3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity</label>
                                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#15171e] shadow-sm">
                                    <button 
                                        onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                                        className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors"
                                    >
                                        <Minus size={16}/>
                                    </button>
                                    <input 
                                        type="number" 
                                        className="w-full text-center bg-transparent border-none p-0 text-sm font-bold focus:ring-0"
                                        value={modalQuantity}
                                        onChange={e => setModalQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                                    />
                                    <button 
                                        onClick={() => setModalQuantity(modalQuantity + 1)}
                                        className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors"
                                    >
                                        <Plus size={16}/>
                                    </button>
                                </div>
                             </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setSelectedDetailItem(null)}
                            className="btn-secondary w-full justify-center"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleModalAdd}
                            className="btn-primary w-full justify-center flex items-center gap-2"
                        >
                            <Plus size={18} /> Add to Order
                        </button>
                    </div>
                </div>
            </div>
          )}

          {/* Desktop Right: Sticky Cart */}
          <div className={`hidden md:flex flex-col bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 min-h-0 transition-all duration-300 ${isCartExpanded ? (isCatalogExpanded ? 'w-[380px]' : 'flex-1') : 'w-20'}`}>
             <div className={`p-4 border-b border-gray-200 dark:border-gray-800 flex items-center ${isCartExpanded ? 'justify-between' : 'justify-center'} bg-white dark:bg-[#1e2029] rounded-t-2xl transition-all`}>
                {isCartExpanded ? (
                    <>
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
                            <ShoppingCart size={20} className="text-[var(--color-brand)]" /> Order Summary
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full">{cart.length}</span>
                            <button onClick={() => setIsCartExpanded(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 transition-colors">
                                <ChevronRight size={18}/>
                            </button>
                        </div>
                    </>
                ) : (
                    <button onClick={() => setIsCartExpanded(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 transition-colors">
                        <ChevronLeft size={20}/>
                    </button>
                )}
             </div>
             
             {isCartExpanded ? (
                 <CartContent />
             ) : (
                 <div className="flex-1 flex flex-col items-center py-6 gap-6 overflow-hidden cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" onClick={() => setIsCartExpanded(true)}>
                     <div className="relative shrink-0">
                         <ShoppingCart size={24} className="text-[var(--color-brand)]" />
                         {cart.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-pulse">
                                {cart.length}
                            </span>
                         )}
                     </div>
                     
                     <div className="flex-1 flex items-center justify-center">
                         <div className="rotate-180" style={{ writingMode: 'vertical-rl' }}>
                               <span className="font-bold text-gray-400 text-xs tracking-widest uppercase whitespace-nowrap">Order Summary</span>
                         </div>
                     </div>

                     <div className="shrink-0 font-bold text-xs text-gray-900 dark:text-white transform -rotate-90 whitespace-nowrap mb-2">
                         ${cartTotal.toLocaleString(undefined, { notation: 'compact' })}
                     </div>
                 </div>
             )}
          </div>

        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white dark:bg-[#1e2029] rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 min-h-[400px]">
            <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Package size={32} />
            </div>
            <p className="font-medium text-gray-500">Select a supplier above to start ordering.</p>
        </div>
      )}

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed inset-x-0 bottom-0 md:hidden z-30">
          <div className="bg-white dark:bg-[#1e2029] border-t border-gray-200 dark:border-gray-800 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
              <div className="mx-auto w-full max-w-screen-sm flex flex-col gap-2 px-3 pt-3 pb-safe">
                  <button
                      type="button"
                      onClick={() => setIsMobileCartOpen(true)}
                      className="w-full text-left rounded-xl px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-0.5">
                          <ShoppingCart size={12}/> {cart.length} items <ChevronUp size={12}/>
                      </div>
                      <div className="font-bold text-xl text-gray-900 dark:text-white truncate">
                          ${cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                  </button>
                  <button 
                      onClick={handleSubmit}
                      disabled={cart.length === 0}
                      className="w-full bg-[var(--color-brand)] text-white px-5 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none"
                  >
                      Review
                  </button>
              </div>
          </div>
      </div>

      {/* Mobile Cart Drawer */}
      {isMobileCartOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileCartOpen(false)}></div>
              <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1e2029] rounded-t-2xl shadow-2xl h-[85vh] flex flex-col transition-transform transform translate-y-0 pb-safe">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">Current Order</h3>
                      <button onClick={() => setIsMobileCartOpen(false)} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full"><X size={18}/></button>
                  </div>
                  <CartContent />
              </div>
          </div>
      )}
    </div>
  );
};

export default POCreate;
