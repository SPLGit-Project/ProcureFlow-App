import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { ColumnMapping, MappingConfidence, DateColumn, EnhancedParseResult } from '../utils/fileParser';
import { SupplierStockSnapshot } from '../types';

interface StockMappingConfirmationProps {
    parseResult: EnhancedParseResult;
    onConfirm: (mapping: ColumnMapping, dateColumns: DateColumn[]) => void;
    onCancel: () => void;
}

export default function StockMappingConfirmation({ 
    parseResult, 
    onConfirm, 
    onCancel 
}: StockMappingConfirmationProps) {
    const [currentMapping, setCurrentMapping] = useState<ColumnMapping>(parseResult.mapping);
    const [selectedDateColumns, setSelectedDateColumns] = useState<Set<string>>(
        new Set(parseResult.dateColumns.filter(dc => dc.isIncomingStock).map(dc => dc.columnName))
    );
    const [showOptional, setShowOptional] = useState(false);
    const [showPreview, setShowPreview] = useState(true);

    // Recalculate confidence when mapping changes
    const confidence = calculateCurrentConfidence();

    function calculateCurrentConfidence(): MappingConfidence {
        const mappedFields = Object.values(currentMapping).filter((m: any) => m.sourceColumn !== null);
        const totalConfidence = mappedFields.reduce<number>((sum, m: any) => sum + (Number(m.confidence) || 0), 0);
        const avgConfidence = mappedFields.length > 0 ? totalConfidence / mappedFields.length : 0;
        
        const requiredFields = ['supplierSku'];
        const missingRequired = requiredFields.filter(
            field => !currentMapping[field]?.sourceColumn
        );

        return {
            overall: avgConfidence,
            hasErrors: missingRequired.length > 0,
            missingRequired
        };
    }

    const handleMappingChange = (field: string, sourceColumn: string | null) => {
        setCurrentMapping(prev => ({
            ...prev,
            [field]: {
                ...prev[field],
                sourceColumn,
                confidence: sourceColumn ? 0.9 : 0  // Manual mapping gets high confidence
            }
        }));
    };

    const handleDateColumnToggle = (columnName: string) => {
        setSelectedDateColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(columnName)) {
                newSet.delete(columnName);
            } else {
                newSet.add(columnName);
            }
            return newSet;
        });
    };

    const handleConfirm = () => {
        const selectedDates = parseResult.dateColumns.filter(dc => 
            selectedDateColumns.has(dc.columnName)
        );
        onConfirm(currentMapping, selectedDates);
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
        if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const getConfidenceIcon = (confidence: number) => {
        if (confidence >= 0.8) return <Check size={16} className="text-green-600 dark:text-green-400" />;
        if (confidence >= 0.5) return <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />;
        return <AlertCircle size={16} className="text-red-600 dark:text-red-400" />;
    };

    const requiredFields = [
        { key: 'supplierSku', label: 'SKU / Stock Code', description: 'Unique identifier for the product' },
        { key: 'productName', label: 'Product Name', description: 'Item description or name' }
    ];

    const optionalFields = [
        { key: 'stockOnHand', label: 'Stock on Hand', description: 'Current stock quantity' },
        { key: 'availableQty', label: 'Available Quantity', description: 'Stock available for orders' },
        { key: 'committedQty', label: 'Committed Quantity', description: 'Stock allocated to orders' },
        { key: 'backOrderedQty', label: 'Back Ordered', description: 'Stock on back order' },
        { key: 'totalStockQty', label: 'Total Stock', description: 'Total physical stock' },
        { key: 'customerStockCode', label: 'Customer Stock Code', description: 'Your internal stock code' },
        { key: 'range', label: 'Range', description: 'Product range or collection' },
        { key: 'category', label: 'Category', description: 'Product category' },
        { key: 'subCategory', label: 'Sub Category', description: 'Product sub-category' },
        { key: 'stockType', label: 'Stock Type', description: 'Type of stock (e.g., Finished Goods)' },
        { key: 'cartonQty', label: 'Carton Quantity', description: 'Units per carton' },
        { key: 'sellPrice', label: 'Sell Price', description: 'Unit sell price' },
        { key: 'sohValueAtSell', label: 'SOH Value', description: 'Stock on hand value at sell price' }
    ];

    const unmappedColumns = parseResult.allColumns.filter(col => {
        const isMapped = Object.values(currentMapping).some((m: any) => m.sourceColumn === col);
        const isDateColumn = parseResult.dateColumns.some(dc => dc.columnName === col);
        return !isMapped && !isDateColumn;
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Confirm Column Mapping
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Review and adjust how columns from your file map to our system
                            </p>
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <X size={24} className="text-gray-500" />
                        </button>
                    </div>

                    {/* File Info */}
                    <div className="mt-4 flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Rows:</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                                {parseResult.rawData?.length || 0}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                            <span className={`font-bold ${getConfidenceColor(confidence.overall)}`}>
                                {Math.round(confidence.overall * 100)}%
                            </span>
                        </div>
                        {confidence.hasErrors && (
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <AlertCircle size={16} />
                                <span className="font-medium">Missing required fields</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Required Fields */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="text-red-500">*</span>
                            Required Fields
                        </h3>
                        <div className="space-y-3">
                            {requiredFields.map(field => {
                                const mapping = currentMapping[field.key];
                                return (
                                    <div key={field.key} className="bg-white dark:bg-gray-800 rounded-lg p-3">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1">
                                                {mapping?.sourceColumn ? getConfidenceIcon(mapping.confidence) : <AlertCircle size={16} className="text-gray-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                                                            {field.label}
                                                        </label>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {field.description}
                                                        </p>
                                                    </div>
                                                    <select
                                                        value={mapping?.sourceColumn || ''}
                                                        onChange={(e) => handleMappingChange(field.key, e.target.value || null)}
                                                        className="flex-shrink-0 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">-- Not Mapped --</option>
                                                        {parseResult.allColumns.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {mapping?.sourceColumn && mapping.confidence < 0.8 && (
                                                    <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 flex items-start gap-1">
                                                        <Info size={12} className="mt-0.5" />
                                                        <span>Low confidence ({Math.round(mapping.confidence * 100)}%) - please verify this mapping is correct</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Optional Fields */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl">
                        <button
                            onClick={() => setShowOptional(!showOptional)}
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-t-xl"
                        >
                            <h3 className="font-bold text-gray-900 dark:text-white">
                                Optional Fields ({optionalFields.filter(f => currentMapping[f.key]?.sourceColumn).length} mapped)
                            </h3>
                            {showOptional ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                        {showOptional && (
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                                {optionalFields.map(field => {
                                    const mapping = currentMapping[field.key];
                                    return (
                                        <div key={field.key} className="flex items-center justify-between gap-3 py-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                {mapping?.sourceColumn && <div className="flex-shrink-0">{getConfidenceIcon(mapping.confidence)}</div>}
                                                <div className="min-w-0">
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white block">
                                                        {field.label}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                                                        {field.description}
                                                    </span>
                                                </div>
                                            </div>
                                            <select
                                                value={mapping?.sourceColumn || ''}
                                                onChange={(e) => handleMappingChange(field.key, e.target.value || null)}
                                                className="flex-shrink-0 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                                            >
                                                <option value="">-- Not Mapped --</option>
                                                {parseResult.allColumns.map(col => (
                                                    <option key={col} value={col}>{col}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Date Columns for Incoming Stock */}
                    {parseResult.dateColumns.length > 0 && (
                        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-3">
                                Incoming Stock (Future Dates)
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                Select which date columns to import as incoming stock forecasts
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {parseResult.dateColumns.map(dateCol => (
                                    <label
                                        key={dateCol.columnName}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                            selectedDateColumns.has(dateCol.columnName)
                                                ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 dark:border-purple-600'
                                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedDateColumns.has(dateCol.columnName)}
                                            onChange={() => handleDateColumnToggle(dateCol.columnName)}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                        />
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {dateCol.columnName}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unmapped Columns */}
                    {unmappedColumns.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                                Unmapped Columns (will be ignored)
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {unmappedColumns.map(col => (
                                    <span
                                        key={col}
                                        className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400"
                                    >
                                        {col}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {showPreview && parseResult.rawData && parseResult.rawData.length > 0 && (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl">
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-t-xl"
                            >
                                <h3 className="font-bold text-gray-900 dark:text-white">
                                    Data Preview (First 10 Rows)
                                </h3>
                                {showPreview ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {showPreview && (
                                <div className="p-4 border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                {Object.entries(currentMapping)
                                                    .filter(([_, m]: [string, any]) => m.sourceColumn)
                                                    .slice(0, 6)
                                                    .map(([field, mapping]: [string, any]) => (
                                                        <th key={field} className="text-left p-2 font-medium text-gray-700 dark:text-gray-300 text-xs">
                                                            {mapping.sourceColumn}
                                                        </th>
                                                    ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parseResult.rawData.slice(0, 10).map((row, idx) => (
                                                <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                                                    {Object.entries(currentMapping)
                                                        .filter(([_, m]: [string, any]) => m.sourceColumn)
                                                        .slice(0, 6)
                                                        .map(([field, mapping]: [string, any]) => (
                                                            <td key={field} className="p-2 text-gray-900 dark:text-white text-xs">
                                                                {row[mapping.sourceColumn!] || '-'}
                                                            </td>
                                                        ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            {confidence.hasErrors ? (
                                <span className="text-red-600 dark:text-red-400 font-medium">
                                    Please map all required fields before continuing
                                </span>
                            ) : (
                                <span>
                                    Ready to import <strong>{parseResult.rawData?.length || 0}</strong> rows
                                </span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={confidence.hasErrors}
                                className="px-6 py-2 bg-[var(--color-brand)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Check size={18} />
                                Confirm & Import
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
