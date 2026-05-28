import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, ChevronUp, Save, Info, AlertCircle, CheckCircle2, 
  Package, Ruler, Settings, BarChart2, Hash
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ItemRequest } from '../types';
import { updateRequestStatus } from '../services/itemRequestService';

interface ItemDefinitionFormProps {
  request: ItemRequest;
  onComplete: (itemId: string) => void;
}

export const ItemDefinitionForm: React.FC<ItemDefinitionFormProps> = ({ request, onComplete }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: request.item_description || '',
    category: '',
    sub_category: '',
    item_type: '',
    item_weight: 0,
    item_size: '',
    item_colour: '',
    item_material: '',
    gsm: 0,
    rfid_flag: false,
    cog_flag: false,
    cog_customer: '',
    purchase_enabled: true,
    sale_enabled: true,
    bundle_enabled: false,
    linenhub_enabled: false,
    salesforce_visible: false,
    uom: 'EA',
    sap_item_code: '',
    item_pool: '',
    item_catalog: '',
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [itemTypes, setItemTypes] = useState<string[]>([]);
  const [uoms, setUoms] = useState<string[]>(['EA', 'KG', 'DZ', 'PK', 'BX', 'RL']);
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    core: true,
    physical: true,
    system: false,
    sap: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      // Fetch categories from items table as requested
      const { data: catData } = await supabase.from('items').select('category');
      if (catData) {
        const uniqueCats = Array.from(new Set(catData.map(i => i.category).filter(Boolean)));
        setCategories(uniqueCats as string[]);
      }

      // Also try to get from attribute_options if possible for more variety
      const { data: attrData } = await supabase.from('attribute_options').select('value, type');
      if (attrData) {
        const types = attrData.filter(a => a.type === 'TYPE').map(a => a.value);
        if (types.length > 0) setItemTypes(types);
        
        const existingUoms = attrData.filter(a => a.type === 'UOM').map(a => a.value);
        if (existingUoms.length > 0) setUoms(existingUoms);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.name || !formData.description || !formData.category) {
      setError('Please fill in all required fields (Name, Description, Category).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create the item record
      // The database trigger will handle the SKU generation
      const { data: newItem, error: itemError } = await supabase
        .from('items')
        .insert({
          sku: 'PENDING', // Will be overwritten by trigger
          name: formData.name,
          description: formData.description,
          category: formData.category,
          sub_category: formData.sub_category,
          item_type: formData.item_type,
          item_weight: formData.item_weight,
          item_size: formData.item_size,
          item_colour: formData.item_colour,
          item_material: formData.item_material,
          specs: {
            gsm: formData.gsm,
          },
          rfid_flag: formData.rfid_flag,
          cog_flag: formData.cog_flag,
          cog_customer: formData.cog_customer,
          active_flag: true,
          uom: formData.uom,
          sap_item_code_raw: formData.sap_item_code,
          item_pool: formData.item_pool,
          item_catalog: formData.item_catalog
          // Purchase/Sale flags usually go in item_publication or similar, 
          // but for now we might store them in specs or a separate table if available.
          // Based on schema.sql, items table doesn't have all these flags as top-level columns.
        })
        .select()
        .single();

      if (itemError) throw new Error(itemError.message);

      // 2. Update item_requests.resulting_item_id and status
      const { error: requestError } = await supabase
        .from('item_requests')
        .update({
          resulting_item_id: newItem.id,
          status: 'PRICING_REVIEW'
        })
        .eq('id', request.id);

      if (requestError) throw new Error(requestError.message);

      onComplete(newItem.id);
    } catch (err: any) {
      setError(err.message || 'Failed to save item definition.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SKU Preview logic
  const categoryPrefix = formData.category ? formData.category.substring(0, 3).toUpperCase() : '???';
  const typeCode = formData.item_type ? '01' : '00'; // Mock logic for preview
  const skuPreview = `${categoryPrefix}-${typeCode}-XXXX`;

  const isTextile = ['Towelling', 'Sheeting', 'Pillowcase'].includes(formData.category);

  return (
    <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden animate-page-entry">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#181a21]/50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Item Definition</h2>
          <p className="text-sm text-gray-500">Configure technical attributes and system mappings for the new item.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Request Ref</p>
                <p className="text-xs font-mono font-bold text-[#129DC0]">{request.request_number}</p>
            </div>
            <div className="w-10 h-10 bg-[#129DC0]/10 rounded-full flex items-center justify-center text-[#129DC0]">
                <Settings size={20} />
            </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Core Identity */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Package className="text-[#129DC0]" size={18} />
            <h3 className="font-bold text-gray-900 dark:text-white">Core Identity</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Item Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="input-field"
                placeholder="e.g. Luxury Bath Towel White"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="input-field"
              >
                <option value="">Select Category...</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                <option value="Towelling">Towelling</option>
                <option value="Sheeting">Sheeting</option>
                <option value="Pillowcase">Pillowcase</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="input-field h-24 resize-none"
                placeholder="Detailed technical description..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Sub-Category</label>
              <select
                name="sub_category"
                value={formData.sub_category}
                onChange={handleInputChange}
                className="input-field"
              >
                <option value="">Select Sub-Category...</option>
                {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Item Type</label>
              <select
                name="item_type"
                value={formData.item_type}
                onChange={handleInputChange}
                className="input-field"
              >
                <option value="">Select Type...</option>
                {itemTypes.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="Standard">Standard</option>
                <option value="Premium">Premium</option>
              </select>
            </div>
          </div>
        </div>

        {/* Physical Attributes */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <button 
            onClick={() => toggleSection('physical')}
            className="w-full p-4 bg-gray-50 dark:bg-[#1a1c23] flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Ruler className="text-[#129DC0]" size={18} />
              <span className="font-bold text-gray-900 dark:text-white">Physical Attributes</span>
            </div>
            {expandedSections.physical ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          
          {expandedSections.physical && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-[#1e2029] border-t border-gray-200 dark:border-gray-800 animate-slide-down">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Weight (kg)</label>
                <input type="number" name="item_weight" value={formData.item_weight} onChange={handleInputChange} className="input-field" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Size</label>
                <input type="text" name="item_size" value={formData.item_size} onChange={handleInputChange} className="input-field" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Colour</label>
                <input type="text" name="item_colour" value={formData.item_colour} onChange={handleInputChange} className="input-field" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Material</label>
                <input type="text" name="item_material" value={formData.item_material} onChange={handleInputChange} className="input-field" />
              </div>
              
              {isTextile && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">GSM</label>
                  <input type="number" name="gsm" value={formData.gsm} onChange={handleInputChange} className="input-field" />
                </div>
              )}

              <div className="md:col-span-3 flex flex-wrap gap-8 py-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" name="rfid_flag" checked={formData.rfid_flag} onChange={handleInputChange} className="w-5 h-5 rounded border-gray-300 text-[#129DC0] focus:ring-[#129DC0]" />
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-[#129DC0] transition-colors">RFID Flag</p>
                    <p className="text-[10px] text-gray-500">Track via electronic tag</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" name="cog_flag" checked={formData.cog_flag} onChange={handleInputChange} className="w-5 h-5 rounded border-gray-300 text-[#129DC0] focus:ring-[#129DC0]" />
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-[#129DC0] transition-colors">COG Flag</p>
                    <p className="text-[10px] text-gray-500">Customer Owned Goods</p>
                  </div>
                </label>
              </div>

              {formData.cog_flag && (
                <div className="md:col-span-3 space-y-2 animate-slide-down">
                  <label className="text-xs font-black uppercase tracking-widest text-[#129DC0]">Customer *</label>
                  <input type="text" name="cog_customer" value={formData.cog_customer} onChange={handleInputChange} className="input-field border-[#129DC0]/30" placeholder="Name of customer owning this stock" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* System Configuration */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <button 
            onClick={() => toggleSection('system')}
            className="w-full p-4 bg-gray-50 dark:bg-[#1a1c23] flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BarChart2 className="text-[#129DC0]" size={18} />
              <span className="font-bold text-gray-900 dark:text-white">System Configuration</span>
            </div>
            {expandedSections.system ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          
          {expandedSections.system && (
            <div className="p-6 bg-white dark:bg-[#1e2029] border-t border-gray-200 dark:border-gray-800 animate-slide-down">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="purchase_enabled" checked={formData.purchase_enabled} onChange={handleInputChange} className="w-4 h-4 rounded border-gray-300 text-[#129DC0]" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Purchase Enabled</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="sale_enabled" checked={formData.sale_enabled} onChange={handleInputChange} className="w-4 h-4 rounded border-gray-300 text-[#129DC0]" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sale Enabled</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="bundle_enabled" checked={formData.bundle_enabled} onChange={handleInputChange} className="w-4 h-4 rounded border-gray-300 text-[#129DC0]" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bundle Enabled</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="linenhub_enabled" checked={formData.linenhub_enabled} onChange={handleInputChange} className="w-4 h-4 rounded border-gray-300 text-[#129DC0]" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">LinenHub Enabled</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="salesforce_visible" checked={formData.salesforce_visible} onChange={handleInputChange} className="w-4 h-4 rounded border-gray-300 text-[#129DC0]" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Salesforce Visible</span>
                            </label>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Unit of Measure (UOM)</label>
                        <select name="uom" value={formData.uom} onChange={handleInputChange} className="input-field">
                            {uoms.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* SAP Mapping */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <button 
            onClick={() => toggleSection('sap')}
            className="w-full p-4 bg-gray-50 dark:bg-[#1a1c23] flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Hash className="text-[#129DC0]" size={18} />
              <span className="font-bold text-gray-900 dark:text-white">Financial Mapping (SAP)</span>
            </div>
            {expandedSections.sap ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          
          {expandedSections.sap && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-[#1e2029] border-t border-gray-200 dark:border-gray-800 animate-slide-down">
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">SAP Item Code</label>
                    <input type="text" name="sap_item_code" value={formData.sap_item_code} onChange={handleInputChange} className="input-field" placeholder="e.g. 104231" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Item Pool</label>
                    <input type="text" name="item_pool" value={formData.item_pool} onChange={handleInputChange} className="input-field" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Item Catalog</label>
                    <input type="text" name="item_catalog" value={formData.item_catalog} onChange={handleInputChange} className="input-field" />
                </div>
            </div>
          )}
        </div>

        {/* SKU Preview */}
        <div className="p-6 bg-[#129DC0]/5 dark:bg-[#129DC0]/10 rounded-2xl border border-[#129DC0]/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-[#129DC0] shadow-sm border border-[#129DC0]/10">
                    <Hash size={24} />
                </div>
                <div>
                    <p className="text-[10px] font-black text-[#129DC0] uppercase tracking-widest">SKU Preview</p>
                    <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">{skuPreview}</p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-[10px] text-gray-400 italic">SKU will be generated automatically on save</p>
                <div className="flex items-center gap-1.5 text-[#129DC0] justify-end mt-1">
                    <Info size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Trigger-Based</span>
                </div>
            </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 animate-slide-up">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="pt-6">
            <button
                onClick={handleSave}
                disabled={isSubmitting}
                className={`w-full py-4 rounded-xl bg-[#129DC0] hover:bg-[#0f87a8] text-white font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-[#129DC0]/20 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
                {isSubmitting ? 'Saving Item Record...' : (
                <>
                    <Save size={18} /> Save Item & Advance to Pricing
                </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};
