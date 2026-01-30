import React, { useState, useEffect } from 'react';
import { 
    X, Check, ChevronRight, ChevronLeft, Package, Tag, 
    Truck, BarChart2, Save, FileText, AlertCircle, Plus 
} from 'lucide-react';
import { Item, AttributeOption, Supplier, Site } from '../types';
import { normalizeItemCode } from '../utils/normalization';

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

    const validateStep = (stepIndex: number): boolean => {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        if (stepIndex === 0) { // Identity
            if (!formData.sku) newErrors.sku = 'SAP Code is required';
            if (!formData.name) newErrors.name = 'Item Name is required';
        } else if (stepIndex === 1) { // Classification
            if (!formData.category) newErrors.category = 'Category is required';
        } else if (stepIndex === 2) { // Inventory
            if (!formData.supplierId) newErrors.supplierId = 'Supplier is required';
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

    // Filtered Options
    const categories = attributeOptions.filter(o => o.type === 'CATEGORY').sort((a,b) => a.value.localeCompare(b.value));
    const catalogs = attributeOptions.filter(o => o.type === 'CATALOG');
    const pools = attributeOptions.filter(o => o.type === 'POOL');
    const uoms = attributeOptions.filter(o => o.type === 'UOM');

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

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Item Name *</label>
                                    <input 
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        className={`w-full p-3 rounded-lg border ${errors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none`}
                                        placeholder="e.g. Towel Bath White"
                                    />
                                    {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                                    <textarea 
                                        value={formData.description || ''}
                                        onChange={(e) => handleInputChange('description', e.target.value)}
                                        className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                                        placeholder="Detailed description..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* STEP 2: CLASSIFICATION */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Catalog</label>
                                    <select 
                                        value={formData.itemCatalog || ''}
                                        onChange={(e) => handleInputChange('itemCatalog', e.target.value)}
                                        className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Select Catalog...</option>
                                        {catalogs.map(opt => (
                                            <option key={opt.id} value={opt.value}>{opt.value}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category *</label>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowNewCatInput(!showNewCatInput)}
                                            className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                        >
                                            <Plus size={12} /> Add New
                                        </button>
                                    </div>
                                    
                                    {showNewCatInput ? (
                                        <div className="flex gap-2">
                                            <input 
                                                autoFocus
                                                type="text" 
                                                value={newCategory}
                                                onChange={(e) => setNewCategory(e.target.value)}
                                                className="flex-1 p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white"
                                                placeholder="New Category Name"
                                            />
                                            <button onClick={handleAddCategory} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Add</button>
                                        </div>
                                    ) : (
                                        <select 
                                            value={formData.category || ''}
                                            onChange={(e) => handleInputChange('category', e.target.value)}
                                            className={`w-full p-3 rounded-lg border ${errors.category ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none`}
                                        >
                                            <option value="">Select Category...</option>
                                            {categories.map(opt => (
                                                <option key={opt.id} value={opt.value}>{opt.value}</option>
                                            ))}
                                        </select>
                                    )}
                                    {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Item Pool</label>
                                    <select 
                                        value={formData.itemPool || ''}
                                        onChange={(e) => handleInputChange('itemPool', e.target.value)}
                                        className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Select Pool...</option>
                                        {pools.map(opt => (
                                            <option key={opt.id} value={opt.value}>{opt.value}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: INVENTORY */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier *</label>
                                    <select 
                                        value={formData.supplierId || ''}
                                        onChange={(e) => handleInputChange('supplierId', e.target.value)}
                                        className={`w-full p-3 rounded-lg border ${errors.supplierId ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} dark:bg-[#1a1c23] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none`}
                                    >
                                        <option value="">Select Supplier...</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    {errors.supplierId && <p className="text-xs text-red-500">{errors.supplierId}</p>}
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

                                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Stock Settings</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-sm text-gray-600 dark:text-gray-400">Stock Level</label>
                                                <input 
                                                    type="number"
                                                    value={formData.stockLevel || 0}
                                                    onChange={(e) => handleInputChange('stockLevel', parseInt(e.target.value))}
                                                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-[#1a1c23] dark:text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 5: REVIEW */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 dark:bg-[#1a1c23] p-6 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
                                    <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider">Item Details</p>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{formData.name}</h3>
                                            <p className="text-sm text-blue-500 font-mono">{formData.sku}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider">Price</p>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">${formData.unitPrice?.toFixed(2)}</h3>
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
                                                {formData.cogFlag && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">COG</span>}
                                                {formData.rfidFlag && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">RFID</span>}
                                                {!formData.cogFlag && !formData.rfidFlag && <span className="text-gray-400 italic">Standard</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                                    <AlertCircle size={20} />
                                    <p className="text-sm">Please review all details carefully. Once created, the SAP Code cannot be easily changed.</p>
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
