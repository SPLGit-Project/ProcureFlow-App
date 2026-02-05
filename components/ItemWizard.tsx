import React, { useState, useEffect } from 'react';
import { 
    X, Check, ChevronRight, ChevronLeft, Package, Tag, 
    Truck, BarChart2, Save, FileText, AlertCircle, Plus, Layers
} from 'lucide-react';
import { Item, AttributeOption, Supplier, Site } from '../types';
import { normalizeItemCode } from '../utils/normalization';
import { HierarchyManager } from '../utils/hierarchyManager';

interface ItemWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Partial<Item>) => Promise<void>;
    existingItem?: Item | null;
    suppliers: Supplier[];
    attributeOptions: AttributeOption[];
    upsertAttributeOption: (option: Partial<AttributeOption>) => Promise<void>;
}

const STEPS = [
    { id: 'IDENTITY', label: 'Identity', icon: Package },
    { id: 'CLASSIFICATION', label: 'Classification', icon: Tag },
    { id: 'INVENTORY', label: 'Inventory', icon: Truck },
    { id: 'ATTRIBUTES', label: 'Attributes', icon: BarChart2 },
    { id: 'STOCK', label: 'Stock Levels', icon: Layers },
    { id: 'REVIEW', label: 'Review', icon: Check },
];

export const ItemWizard: React.FC<ItemWizardProps> = ({
    isOpen, onClose, onSave, existingItem, suppliers, attributeOptions, upsertAttributeOption
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState<Partial<Item>>({
        status: 'ACTIVE',
        activeFlag: true
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newCategory, setNewCategory] = useState('');
    const [showNewCatInput, setShowNewCatInput] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (existingItem) {
                setFormData(existingItem);
            } else {
                setFormData({ status: 'ACTIVE', activeFlag: true });
            }
            setCurrentStep(0);
            setErrors({});
        }
    }, [isOpen, existingItem]);

    if (!isOpen) return null;

    const handleInputChange = (field: keyof Item, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleDescriptionChange = (val: string) => {
        setFormData(prev => {
            const updates: any = { description: val };
            // If name is empty or matches previous description, update it
            // Limit name to 60 chars for display sanity
            if (!prev.name || prev.name === prev.description?.substring(0, prev.name.length)) {
                updates.name = val.length > 61 ? val.substring(0, 58) + '...' : val;
            }
            return { ...prev, ...updates };
        });
        if (errors.description) setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.description;
            return newErrors;
        });
    };

    const validateStep = (stepIndex: number): boolean => {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        if (stepIndex === 0) { // Identity
            if (!formData.sku) newErrors.sku = 'SAP Code is required';
            if (!formData.description) newErrors.description = 'Description is required';
            if (!formData.name) newErrors.name = 'Item Name is required';
        } else if (stepIndex === 1) { // Classification
            if (!formData.category) newErrors.category = 'Category is required';
        } else if (stepIndex === 2) { // Inventory
            if (!formData.uom) newErrors.uom = 'UOM is required';
            if ((formData.unitPrice || 0) <= 0) newErrors.unitPrice = 'Valid Price is required';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            isValid = false;
        }
        return isValid;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    const handleSave = async () => {
        if (!validateStep(currentStep)) return;
        
        setIsSubmitting(true);
        try {
            // Normalize before save
            const finalData = {
                ...formData,
                sku: normalizeItemCode(formData.sku || ''),
            };
            await onSave(finalData);
            onClose();
        } catch (error) {
            console.error(error);
            // Handle error (toast is usually handled in parent)
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddCategory = async () => {
        if (!newCategory.trim()) return;
        await upsertAttributeOption({ type: 'CATEGORY', value: newCategory.trim() });
        setFormData(prev => ({ ...prev, category: newCategory.trim() }));
        setNewCategory('');
        setShowNewCatInput(false);
    };

    // Filtered Options (Defensive)
    const safeOptions = Array.isArray(attributeOptions) ? attributeOptions : [];
    const categories = safeOptions.filter(o => o.type === 'CATEGORY').sort((a,b) => (a.value || '').localeCompare(b.value || ''));
    const catalogs = safeOptions.filter(o => o.type === 'CATALOG');
    const pools = safeOptions.filter(o => o.type === 'POOL');
    const uoms = safeOptions.filter(o => o.type === 'UOM');
    const subcategories = safeOptions.filter(o => o.type === 'SUB_CATEGORY').sort((a,b) => (a.value || '').localeCompare(b.value || ''));

    // UI Helpers
    const StepIcon = STEPS[currentStep].icon;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#1e2029] w-full max-w-4xl mx-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-[#181a21]/50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                <StepIcon size={24} />
                            </div>
                            {existingItem ? 'Edit Item' : 'New Item Wizard'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-14">
                            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].label}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="flex w-full h-1 bg-gray-200 dark:bg-gray-800">
                    {STEPS.map((step, idx) => (
                        <div 
                            key={step.id}
                            className={`flex-1 h-full transition-all duration-500 ${
                                idx <= currentStep ? 'bg-blue-600' : 'bg-transparent'
                            }`}
                        />
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    <div className="max-w-2xl mx-auto space-y-8 animate-slide-in-right">
                        
                        {/* STEP 1: IDENTITY */}
                        {currentStep === 0 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">SAP Code *</label>
                                        <div className="relative">
                                            <input 
                                                type="text"
                                                value={formData.sku || ''}
                                                onChange={(e) => handleInputChange('sku', e.target.value)}
                                                className={`w-full p-3 rounded-lg border ${errors.sku ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
                                                placeholder="e.g. 104231"
                                                autoFocus
                                            />
                                            {errors.sku && <AlertCircle className="absolute right-3 top-3 text-red-500" size={18} />}
                                        </div>
                                        {errors.sku && <p className="text-xs text-red-500">{errors.sku}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Internal Code (Alt)</label>
                                        <input 
                                            type="text"
                                            value={formData.sapItemCodeNorm || ''}
                                            onChange={(e) => handleInputChange('sapItemCodeNorm', e.target.value)}
                                            className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Detailed Description *</label>
                                        <textarea 
                                            value={formData.description || ''}
                                            onChange={(e) => handleDescriptionChange(e.target.value)}
                                            className={`w-full p-4 rounded-xl border ${errors.description ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none transition-all text-lg`}
                                            placeholder="Enter full item description here (e.g. Towel Bath White 600gsm cotton)..."
                                        />
                                        {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                                        <p className="text-[10px] text-gray-400 italic">This is the primary way items are searched. Be as descriptive as possible.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Short Name / Display Title *</label>
                                        <input 
                                            type="text"
                                            value={formData.name || ''}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            className={`w-full p-3 rounded-lg border ${errors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none`}
                                            placeholder="Short version for lists..."
                                        />
                                        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: CLASSIFICATION */}
                        {/* STEP 2: CLASSIFICATION */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Level 1: POOL */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Item Pool *</label>
                                        <select 
                                            value={formData.itemPool || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    itemPool: val,
                                                    itemCatalog: '',
                                                    itemType: '',
                                                    category: '',
                                                    subCategory: ''
                                                }));
                                            }}
                                            className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Select Pool...</option>
                                            {HierarchyManager.getPools(attributeOptions).map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Level 2: CATALOG */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Catalog *</label>
                                        <select 
                                            value={formData.itemCatalog || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    itemCatalog: val,
                                                    itemType: '',
                                                    category: '',
                                                    subCategory: ''
                                                }));
                                            }}
                                            disabled={!formData.itemPool}
                                            className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                        >
                                            <option value="">Select Catalog...</option>
                                            {HierarchyManager.getCatalogs(formData.itemPool || '', attributeOptions).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Level 3: TYPE */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type *</label>
                                        <select 
                                            value={formData.itemType || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    itemType: val,
                                                    category: '',
                                                    subCategory: ''
                                                }));
                                            }}
                                            disabled={!formData.itemCatalog}
                                            className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                        >
                                            <option value="">Select Type...</option>
                                            {HierarchyManager.getTypes(formData.itemPool || '', formData.itemCatalog || '', attributeOptions).map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Level 4: CATEGORY */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category *</label>
                                        <select 
                                            value={formData.category || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    category: val,
                                                    subCategory: ''
                                                }));
                                            }}
                                            disabled={!formData.itemType}
                                            className={`w-full p-3 rounded-lg border ${errors.category ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50`}
                                        >
                                            <option value="">Select Category...</option>
                                            {HierarchyManager.getCategories(formData.itemPool || '', formData.itemCatalog || '', formData.itemType || '', attributeOptions).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
                                    </div>

                                    {/* Level 5: SUB-CATEGORY */}
                                    <div className="space-y-2 col-span-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sub Category</label>
                                        <select 
                                            value={formData.subCategory || ''}
                                            onChange={(e) => handleInputChange('subCategory', e.target.value)}
                                            disabled={!formData.category}
                                            className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                        >
                                            <option value="">Select Sub-Category...</option>
                                            {HierarchyManager.getSubCategories(formData.itemPool || '', formData.itemCatalog || '', formData.itemType || '', formData.category || '', attributeOptions).map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: INVENTORY */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
                                    <select 
                                        value={formData.supplierId || ''}
                                        onChange={(e) => handleInputChange('supplierId', e.target.value)}
                                        className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Select Supplier...</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">UOM *</label>
                                        <select 
                                            value={formData.uom || ''}
                                            onChange={(e) => handleInputChange('uom', e.target.value)}
                                            className={`w-full p-3 rounded-lg border ${errors.uom ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none`}
                                        >
                                            <option value="">Select UOM...</option>
                                            {uoms.map(opt => (
                                                <option key={opt.id} value={opt.value}>{opt.value}</option>
                                            ))}
                                            {/* Fallback if list empty */}
                                            {uoms.length === 0 && (
                                                <>
                                                    <option value="Each">Each</option>
                                                    <option value="Pack">Pack</option>
                                                    <option value="Box">Box</option>
                                                </>
                                            )}
                                        </select>
                                        {errors.uom && <p className="text-xs text-red-500">{errors.uom}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">UPQ (Units Per Qty)</label>
                                        <input 
                                            type="number"
                                            value={formData.upq || 1}
                                            onChange={(e) => handleInputChange('upq', Number(e.target.value))}
                                            className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Unit Price *</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-500">$</span>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={formData.unitPrice || ''}
                                                onChange={(e) => handleInputChange('unitPrice', parseFloat(e.target.value))}
                                                className={`w-full p-3 pl-8 rounded-lg border ${errors.unitPrice ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none`}
                                            />
                                        </div>
                                        {errors.unitPrice && <p className="text-xs text-red-500">{errors.unitPrice}</p>}
                                    </div>

                                </div>
                            </div>
                        )}

                        {/* STEP 4: ATTRIBUTES */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <input 
                                            type="checkbox"
                                            checked={formData.cogFlag || false}
                                            onChange={(e) => handleInputChange('cogFlag', e.target.checked)}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-900 dark:text-white">COG Item (Customer Owned Goods)</span>
                                            <p className="text-sm text-gray-500">Track this item as customer owned property.</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <input 
                                            type="checkbox"
                                            checked={formData.rfidFlag || false}
                                            onChange={(e) => handleInputChange('rfidFlag', e.target.checked)}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-900 dark:text-white">RFID Tagged</span>
                                            <p className="text-sm text-gray-500">This item is tracked via RFID tags.</p>
                                        </div>
                                    </label>

                                    {formData.cogFlag && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">COG Customer *</label>
                                            <input 
                                                type="text" 
                                                value={formData.cogCustomer || ''}
                                                onChange={(e) => handleInputChange('cogCustomer', e.target.value)}
                                                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white"
                                                placeholder="Enter customer name"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 5: STOCK LEVELS */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-4 items-start">
                                    <BarChart2 className="text-blue-600 shrink-0 mt-1" size={20} />
                                    <div>
                                        <h4 className="font-bold text-blue-900 dark:text-blue-300">Stock Thresholds</h4>
                                        <p className="text-sm text-blue-700 dark:text-blue-400">Set minimum and maximum levels to trigger automated restock alerts and manage availability.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Minimum (Par) Level</label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                value={formData.minLevel || 0}
                                                onChange={(e) => handleInputChange('minLevel', parseInt(e.target.value))}
                                                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-3 top-3 text-xs text-gray-400 font-medium">MIN</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Maximum Level</label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                value={formData.maxLevel || 0}
                                                onChange={(e) => handleInputChange('maxLevel', parseInt(e.target.value))}
                                                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-3 top-3 text-xs text-gray-400 font-medium">MAX</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Initial Stock Level</label>
                                    <input 
                                        type="number"
                                        value={formData.stockLevel || 0}
                                        onChange={(e) => handleInputChange('stockLevel', parseInt(e.target.value))}
                                        className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        )}

                        {/* STEP 5: REVIEW */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 dark:bg-[#1a1c23] p-6 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
                                    <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider">Item Details</p>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{formData.name}</h3>
                                            <p className="text-sm text-blue-500 font-mono mt-0.5">{formData.sku}</p>
                                        </div>
                                        <div className="text-right ml-4">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider">Price</p>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">${(formData.unitPrice || 0).toFixed(2)}</h3>
                                            <p className="text-sm text-gray-500">per {formData.uom}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                        <div>
                                            <span className="text-gray-500">Category:</span>
                                            <span className="ml-2 font-medium text-gray-900 dark:text-white">{formData.category}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Catalog:</span>
                                            <span className="ml-2 font-medium text-gray-900 dark:text-white">{formData.itemCatalog || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Supplier:</span>
                                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                                {suppliers.find(s => s.id === formData.supplierId)?.name || 'Unknown'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">UPQ:</span>
                                            <span className="ml-2 font-medium text-gray-900 dark:text-white">{formData.upq}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Type:</span>
                                            <div className="inline-flex gap-2 ml-2">
                                                {formData.cogFlag && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">COG ({formData.cogCustomer})</span>}
                                                {formData.rfidFlag && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">RFID</span>}
                                                {!formData.cogFlag && !formData.rfidFlag && <span className="text-gray-400 italic">Standard</span>}
                                            </div>
                                        </div>
                                        <div className="col-span-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between">
                                            <div className="space-x-4">
                                                <span className="text-gray-500">Par/Min: <b className="text-gray-900 dark:text-white font-semibold">{formData.minLevel || 0}</b></span>
                                                <span className="text-gray-500">Max: <b className="text-gray-900 dark:text-white font-semibold">{formData.maxLevel || 0}</b></span>
                                            </div>
                                            <span className="text-gray-500">Initial Stock: <b className="text-blue-600 dark:text-blue-400 font-semibold">{formData.stockLevel || 0}</b></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-100 dark:border-yellow-900/40">
                                    <AlertCircle size={20} className="shrink-0" />
                                    <p className="text-sm">Please review all details carefully. Once created, the SAP Code cannot be easily changed without data migration.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-between bg-gray-50 dark:bg-[#181a21]/50">
                    <button 
                        onClick={currentStep === 0 ? onClose : handleBack}
                        className="px-6 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
                    >
                        {currentStep === 0 ? 'Cancel' : 'Back'}
                    </button>
                    
                    <button 
                        onClick={currentStep === STEPS.length - 1 ? handleSave : handleNext}
                        disabled={isSubmitting}
                        className={`px-8 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {isSubmitting ? (
                            <>Saving...</>
                        ) : currentStep === STEPS.length - 1 ? (
                            <>Create Item <Check size={18} /></>
                        ) : (
                            <>Next Step <ChevronRight size={18} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
