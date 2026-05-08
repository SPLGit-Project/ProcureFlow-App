import React, { useState, useEffect, useMemo } from 'react';
import { 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  Save, 
  Plus, 
  DollarSign, 
  Percent, 
  Calendar, 
  FileText, 
  Lock,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  getCostBasisForItem, 
  getMarginThreshold, 
  createSellPrice, 
  getSellPricesForItem 
} from '../services/sellPricingService';
import { updateRequestStatus } from '../services/itemRequestService';
import { triggerApprovalEngine } from '../services/approvalEngineService';
import { ItemSellPrice, SellPriceType } from '../types';

interface SellPricingFormProps {
  itemId: string;
  requestId: string;
  onComplete: () => void;
}

export const SellPricingForm: React.FC<SellPricingFormProps> = ({ itemId, requestId, onComplete }) => {
  const { hasPermission } = useApp();
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [costBasis, setCostBasis] = useState<number>(0);
  const [marginThreshold, setMarginThreshold] = useState<number>(25);
  const [existingPrices, setExistingPrices] = useState<ItemSellPrice[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    price_type: 'STANDARD' as SellPriceType,
    customer_reference: '',
    sale_uom: 'EACH',
    sell_price_ex_gst: 0,
    tax_code: 'GST',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    publish_to_salesforce: false,
    publish_to_bundle: false,
    publish_to_linenhub: false,
    notes: ''
  });

  const canManage = hasPermission('manage_sell_pricing');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [basis, threshold, prices] = await Promise.all([
          getCostBasisForItem(itemId),
          getMarginThreshold(),
          getSellPricesForItem(itemId)
        ]);
        setCostBasis(basis);
        setMarginThreshold(threshold);
        setExistingPrices(prices);
      } catch (err: any) {
        setError(err.message || 'Failed to load pricing data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [itemId]);

  // Derived Values
  const marginDetails = useMemo(() => {
    const sellPrice = formData.sell_price_ex_gst;
    if (sellPrice <= 0) return { percent: 0, amount: 0, color: 'text-tertiary', warning: false };

    const amount = sellPrice - costBasis;
    const percent = (amount / sellPrice) * 100;
    
    let color = 'var(--text-tertiary)';
    let warning = false;

    if (percent >= marginThreshold) {
      color = '#10b981'; // green-500
    } else if (percent >= marginThreshold - 5) {
      color = '#f59e0b'; // amber-500
      warning = true;
    } else {
      color = '#ef4444'; // red-500
      warning = true;
    }

    return { 
      percent: percent.toFixed(2), 
      amount: amount.toFixed(2), 
      color,
      isBelowThreshold: percent < marginThreshold
    };
  }, [formData.sell_price_ex_gst, costBasis, marginThreshold]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      setSaveLoading(true);
      setError(null);
      
      // Destructure out customer_reference — not a DB column (removed in P02 correction)
      const { customer_reference: _cr, ...priceFields } = formData;
      const newPrice = await createSellPrice({
        item_id: itemId,
        ...priceFields,
        cost_basis: costBasis
      });

      setExistingPrices(prev => [newPrice, ...prev]);
      // Reset some form fields but keep others for quick entry
      setFormData(prev => ({
        ...prev,
        sell_price_ex_gst: 0,
        customer_reference: '',
        notes: ''
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to save sell price');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    if (existingPrices.length === 0) {
      setError('Please add at least one sell price before completing this stage.');
      return;
    }

    try {
      setCompleteLoading(true);
      await updateRequestStatus(requestId, 'APPROVAL_PENDING');
      await triggerApprovalEngine(requestId);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to update request status');
    } finally {
      setCompleteLoading(false);
    }
  };

  if (!hasPermission('manage_sell_pricing') && !hasPermission('view_sell_pricing')) {
    return (
      <div className="bg-surface-raised border-default border p-8 rounded-xl text-center">
        <Lock className="mx-auto mb-4 text-tertiary" size={48} />
        <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
        <p className="text-secondary">This section is managed by the Sales/Finance team.</p>
      </div>
    );
  }

  return (
    <div className="animate-page-entry space-y-6">
      {/* Header Info */}
      <div className="bg-surface border-default border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <DollarSign className="text-tranquil" />
          Sell Pricing Management
        </h2>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-4 items-start mb-6 dark:bg-blue-900/20 dark:border-blue-800">
          <div className="bg-blue-100 p-2 rounded-full dark:bg-blue-800/40">
            <Info className="text-blue-600 dark:text-blue-400" size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Cost Basis Information</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Cost basis (landed cost): <span className="font-bold">${costBasis.toFixed(2)}</span> — This is the preferred supplier's landed cost and is used to calculate your margin. Supplier details are managed by the Procurement team.
            </p>
          </div>
        </div>

        {/* Existing Prices Table */}
        {existingPrices.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-tertiary mb-3">Existing Pricing Versions</h3>
            <div className="overflow-x-auto border border-default rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-raised border-b border-default text-secondary font-medium">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Price (ex GST)</th>
                    <th className="px-4 py-3">Margin %</th>
                    <th className="px-4 py-3">Effective</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {existingPrices.map((price) => (
                    <tr key={price.id} className="hover:bg-surface-raised transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {price.price_type}
                      </td>
                      <td className="px-4 py-3">${price.sell_price_ex_gst.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${parseFloat(price.margin_percent.toString()) < marginThreshold ? 'text-amber-600' : 'text-green-600'}`}>
                          {price.margin_percent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-tertiary">
                        {price.effective_from} {price.effective_to ? `to ${price.effective_to}` : '(Indefinite)'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          price.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                          price.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {price.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* New Price Form */}
        {canManage && (
          <form onSubmit={handleSave} className="space-y-6 bg-surface-raised p-6 rounded-xl border border-default">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Plus size={18} className="text-tranquil" />
              Add New Pricing Version
            </h3>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3 animate-slide-down">
                <AlertTriangle size={20} />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-tertiary uppercase mb-1.5 ml-1">Price Type</label>
                  <select
                    name="price_type"
                    value={formData.price_type}
                    onChange={handleInputChange}
                    className="input-field"
                    required
                  >
                    <option value="STANDARD">Standard (Default)</option>
                    <option value="GROUP">Customer Group</option>
                    <option value="CUSTOMER_SPECIFIC">Customer-Specific</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="PROMOTIONAL">Promotional</option>
                  </select>
                </div>

                {(formData.price_type === 'CUSTOMER_SPECIFIC' || formData.price_type === 'CONTRACT') && (
                  <div>
                    <label className="block text-xs font-bold text-tertiary uppercase mb-1.5 ml-1">Customer Reference / ID</label>
                    <input
                      type="text"
                      name="customer_reference"
                      value={formData.customer_reference}
                      onChange={handleInputChange}
                      placeholder="e.g. CUST-12345 or ABC Logistics"
                      className="input-field"
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-tertiary uppercase mb-1.5 ml-1">Sale UOM</label>
                    <input
                      type="text"
                      name="sale_uom"
                      value={formData.sale_uom}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-tertiary uppercase mb-1.5 ml-1">Tax Code</label>
                    <select
                      name="tax_code"
                      value={formData.tax_code}
                      onChange={handleInputChange}
                      className="input-field"
                    >
                      <option value="GST">GST</option>
                      <option value="GST-FREE">GST-FREE</option>
                      <option value="EXEMPT">EXEMPT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-tertiary uppercase mb-1.5 ml-1">Sell Price ex-GST</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary">$</span>
                    <input
                      type="number"
                      step="0.01"
                      name="sell_price_ex_gst"
                      value={formData.sell_price_ex_gst || ''}
                      onChange={handleInputChange}
                      className="input-field pl-8 font-mono text-lg"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-tertiary uppercase mb-1.5 ml-1">Effective From</label>
                    <input
                      type="date"
                      name="effective_from"
                      value={formData.effective_from}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-tertiary uppercase mb-1.5 ml-1">Effective To</label>
                    <input
                      type="date"
                      name="effective_to"
                      value={formData.effective_to}
                      onChange={handleInputChange}
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-tertiary uppercase mb-1.5 ml-1">Publication & Visibility</label>
                  <div className="grid grid-cols-1 gap-2 p-3 bg-surface rounded-lg border border-default">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="publish_to_salesforce"
                        checked={formData.publish_to_salesforce}
                        onChange={handleInputChange}
                        className="w-4 h-4 rounded border-gray-300 text-tranquil focus:ring-tranquil"
                      />
                      <span className="text-sm">Publish to Salesforce</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="publish_to_bundle"
                        checked={formData.publish_to_bundle}
                        onChange={handleInputChange}
                        className="w-4 h-4 rounded border-gray-300 text-tranquil focus:ring-tranquil"
                      />
                      <span className="text-sm">Publish to Bundle</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="publish_to_linenhub"
                        checked={formData.publish_to_linenhub}
                        onChange={handleInputChange}
                        className="w-4 h-4 rounded border-gray-300 text-tranquil focus:ring-tranquil"
                      />
                      <span className="text-sm">Publish to LinenHub</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-tertiary uppercase mb-1.5 ml-1">Internal Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="input-field min-h-[85px] resize-none"
                    placeholder="Rationale for this price point..."
                  />
                </div>
              </div>
            </div>

            {/* Live Margin Card */}
            <div className="bg-surface border-default border rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex gap-8">
                <div className="text-center">
                  <div className="text-xs font-bold text-tertiary uppercase mb-1">Projected Margin %</div>
                  <div className="text-3xl font-mono font-bold" style={{ color: marginDetails.color }}>
                    {marginDetails.percent}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-tertiary uppercase mb-1">Projected Margin $</div>
                  <div className="text-3xl font-mono font-bold" style={{ color: marginDetails.color }}>
                    ${marginDetails.amount}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saveLoading || formData.sell_price_ex_gst <= 0}
                className="w-full md:w-auto px-8 py-3 bg-tranquil hover:bg-tranquil/90 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveLoading ? <span className="animate-spin">●</span> : <Save size={20} />}
                {saveLoading ? 'Saving...' : 'Add Pricing Version'}
              </button>
            </div>

            {/* Margin Warning Callout */}
            {marginDetails.isBelowThreshold && formData.sell_price_ex_gst > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex gap-4 items-start animate-slide-up dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100">
                <AlertTriangle className="text-amber-600 shrink-0" size={24} />
                <p className="text-sm font-medium">
                  This price results in a margin of <span className="font-bold">{marginDetails.percent}%</span>, which is below the <span className="font-bold">{marginThreshold}%</span> approval threshold. This item will be routed to the Commercial Manager for additional approval. You may still submit.
                </p>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Completion Action */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleMarkComplete}
          disabled={completeLoading || existingPrices.length === 0}
          className="px-10 py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {completeLoading ? <span className="animate-spin">●</span> : <CheckCircle size={24} />}
          {completeLoading ? 'Processing...' : 'Mark Sell Pricing Complete'}
          {!completeLoading && <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />}
        </button>
      </div>
    </div>
  );
};

export default SellPricingForm;
