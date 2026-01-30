
import React, { useState } from 'react';
import { AttributeOption, AttributeType } from '../types';
import { Plus, Edit2, Trash2, FolderTree, Tag, Layers, BookOpen, Scale, AlertTriangle, Save, X } from 'lucide-react';
import { useToast } from './ToastNotification';

interface CatalogManagementProps {
    options: AttributeOption[];
    upsertOption: (option: Partial<AttributeOption>) => Promise<void>;
    deleteOption: (id: string) => Promise<void>;
}

const TABS: { id: AttributeType, label: string, icon: any }[] = [
    { id: 'CATEGORY', label: 'Categories', icon: FolderTree },
    { id: 'SUB_CATEGORY', label: 'Sub Categories', icon: Tag },
    { id: 'POOL', label: 'Item Pools', icon: Layers },
    { id: 'CATALOG', label: 'Catalogs', icon: BookOpen },
    { id: 'UOM', label: 'Units of Measure', icon: Scale },
];

const CatalogManagement: React.FC<CatalogManagementProps> = ({ options, upsertOption, deleteOption }) => {
    const { success, error } = useToast();
    const [activeTab, setActiveTab] = useState<AttributeType>('CATEGORY');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOption, setEditingOption] = useState<AttributeOption | null>(null);

    // Form State
    const [value, setValue] = useState('');
    const [parentId, setParentId] = useState<string>('');

    const filteredOptions = options.filter(o => o.type === activeTab);
    const parentOptions = options.filter(o => o.type === 'CATEGORY'); // Only Categories are parents for now

    const handleOpenModal = (option?: AttributeOption) => {
        if (option) {
            setEditingOption(option);
            setValue(option.value);
            setParentId(option.parentId || '');
        } else {
            setEditingOption(null);
            setValue('');
            setParentId('');
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!value.trim()) return;

        try {
            await upsertOption({
                id: editingOption?.id, // undefined if new
                type: activeTab,
                value: value.trim(),
                parentId: activeTab === 'SUB_CATEGORY' ? parentId : undefined,
                activeFlag: true
            });
            success(`${activeTab} saved successfully`);
            setIsModalOpen(false);
        } catch (err: any) {
            error('Failed to save: ' + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this option?')) {
            try {
                await deleteOption(id);
                success('Option deleted successfully');
            } catch (err: any) {
                error('Failed to delete: ' + err.message);
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / Tabs */}
            <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 pb-1 overflow-x-auto">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                        >
                            <Icon size={18} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-[#1e2029] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-white flex items-center">
                        Managing {TABS.find(t => t.id === activeTab)?.label}
                        <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">
                            {filteredOptions.length}
                        </span>
                    </h3>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                        <span>Add New</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase font-medium">
                            <tr>
                                <th className="px-6 py-3">Value</th>
                                {activeTab === 'SUB_CATEGORY' && <th className="px-6 py-3">Parent Category</th>}
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredOptions.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                                        No options found. Click "Add New" to create one.
                                    </td>
                                </tr>
                            ) : (
                                filteredOptions.map(opt => {
                                    const parent = parentOptions.find(p => p.id === opt.parentId);
                                    return (
                                        <tr key={opt.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{opt.value}</td>
                                            {activeTab === 'SUB_CATEGORY' && (
                                                <td className="px-6 py-3">
                                                    {parent ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                            {parent.value}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                            )}
                                            <td className="px-6 py-3 text-right space-x-2">
                                                <button
                                                    onClick={() => handleOpenModal(opt)}
                                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-blue-500"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(opt.id)}
                                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-red-500"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1e2029] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                                {editingOption ? 'Edit Option' : 'New Option'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {TABS.find(t => t.id === activeTab)?.label.slice(0, -1)} Name
                                </label>
                                <input
                                    type="text"
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    placeholder="Enter value..."
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2b2d31] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    autoFocus
                                />
                            </div>

                            {activeTab === 'SUB_CATEGORY' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Parent Category
                                    </label>
                                    <select
                                        value={parentId}
                                        onChange={e => setParentId(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2b2d31] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Select Category...</option>
                                        {parentOptions.map(p => (
                                            <option key={p.id} value={p.id}>{p.value}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 bg-gray-50 dark:bg-gray-800/50">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!value.trim() || (activeTab === 'SUB_CATEGORY' && !parentId)}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={16} />
                                <span>Save Changes</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CatalogManagement;
