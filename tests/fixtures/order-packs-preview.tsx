import React, { createContext, useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import POCreate from '../../components/POCreate.tsx';
import PODetail from '../../components/PODetail.tsx';
import { calculateItemRunningStock } from '../../utils/reservationUtils.ts';
import { assertOrderPackQuantities, getOrderPackRule } from '../../utils/orderPacks.ts';

const supplier = { id: 'ncc', name: 'NCC Apparel Pty Ltd' };
const alternate = { id: 'simba', name: 'Simba Healthcare' };
const items: any[] = [
  { id: 'scrub', sku: 'HSPG02', name: 'THT SCRUB PANT - M GREEN', upq: 1, unitPrice: 5.56, uom: 'Each', category: 'Scrubs', activeFlag: true },
  { id: 'unknown', sku: 'PACK-UNKNOWN', name: 'Item awaiting pack confirmation', upq: 1, unitPrice: 2, uom: 'Each', category: 'Other', activeFlag: true },
];
const suppliers: any[] = [supplier, alternate];
const mappings: any[] = suppliers.flatMap(s => items.map(i => ({
  id: s.id + i.id, supplierId: s.id, productId: i.id, supplierSku: i.sku, mappingStatus: 'CONFIRMED', packConversionFactor: 1
})));
const stockSnapshots: any[] = suppliers.flatMap(s => items.map(i => ({
  id: s.id + i.id, supplierId: s.id, supplierSku: i.sku, productName: i.name,
  snapshotDate: '2026-10-06T00:00:00Z', availableQty: 2640, stockOnHand: 2640,
  cartonQty: i.id === 'unknown' ? undefined : s.id === 'ncc' ? 30 : 25, sellPrice: s.id === 'ncc' ? 5.56 : 8.99,
  stockType: 'CUSTOM', customerStockCodeRaw: i.sku
})));
const currentUser = { id: 'preview-user', name: 'Preview User', role: 'ADMIN', permissions: [], siteIds: ['sydney'] };
const site = { id: 'sydney', name: 'SPL Sydney' };
const initialRequest: any = { id: 'preview-draft', displayId: 'PREVIEW-DRAFT', status: 'DRAFT',
  requesterId: currentUser.id, requesterName: currentUser.name, siteId: site.id, site: site.name,
  supplierId: supplier.id, supplierName: supplier.name, requestDate: '2026-10-07', reasonForRequest: 'Depletion',
  totalAmount: 172.36, lines: [{ id: 'legacy-line', itemId: 'scrub', sku: 'HSPG02', itemName: items[0].name,
    quantityOrdered: 31, quantityReceived: 0, unitPrice: 5.56, totalPrice: 172.36 }], approvalHistory: [], deliveries: [] };
const PreviewContext = createContext<any>(null);
export const usePreviewApp = () => useContext(PreviewContext);

function Preview() {
  const [pos, setPos] = useState<any[]>([initialRequest]);
  const [message, setMessage] = useState('');
  const validate = (po: any) => assertOrderPackQuantities(po.lines, po.supplierId, items, suppliers, mappings, stockSnapshots);
  const breakdown = (itemId: string, supplierId: string) => calculateItemRunningStock(itemId, supplierId,
    suppliers, mappings, stockSnapshots, [], getOrderPackRule(items.find(i => i.id === itemId), supplierId, suppliers, mappings, stockSnapshots).size || 1);
  const state: any = { items, suppliers, mappings, stockSnapshots, currentUser, pos, allPos: pos, sites: [site],
    userSites: [site], featureFlags: { uiRevampEnabled: false }, isStockReady: true,
    getStockBreakdown: breakdown, getEffectiveStock: (i: string, s: string) => breakdown(i, s).availableOrderQty,
    reloadData: async () => {}, hasPermission: () => true, isUserAdmin: () => true, canApproveOrder: () => false,
    canReceiveOrder: () => false, canApproveAmount: () => false,
    createPO: async (po: any) => { validate(po); setPos(prev => [...prev, po]); setMessage('Request recorded in local preview only.'); return true; },
    saveDraftPO: async (po: any) => { validate(po); setPos(prev => [...prev, { ...po, status: 'DRAFT' }]); setMessage('Draft saved in local preview only.'); return true; },
    submitDraftPO: async (id: string) => { const po = pos.find(p => p.id === id); validate(po); setPos(prev => prev.map(p => p.id === id ? { ...p, status: 'PENDING_APPROVAL' } : p)); },
    updatePendingPO: async (id: string, changes: any) => { const po = pos.find(p => p.id === id); validate({ ...po, ...changes }); setPos(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p)); },
  };
  return <PreviewContext.Provider value={state}><MemoryRouter initialEntries={['/create']}>
    <header style={{ background: '#fff3cd', padding: 12, marginBottom: 20 }}>
      <strong>Unreleased branch preview — fixture data only; no Supabase connection</strong>
      <nav style={{ display: 'flex', gap: 20, marginTop: 8 }}><Link to="/create">New request</Link>
        <Link to="/requests/preview-draft">Existing odd-quantity draft</Link></nav>
    </header>
    {message && <p role="status">{message}</p>}
    <Routes><Route path="/create" element={<POCreate />} /><Route path="/requests/:id" element={<PODetail />} />
      <Route path="/requests" element={<p>Local preview request recorded. No production data changed.</p>} /></Routes>
  </MemoryRouter></PreviewContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
