import React, { useState, useEffect } from 'react';
import { EmailTemplateData } from '../types';
import { Mail, Eye, Code, Type, Save, X, AlertCircle, Info, Sparkles } from 'lucide-react';

interface EmailTemplateEditorProps {
    template?: EmailTemplateData;
    onSave: (template: Partial<EmailTemplateData>) => Promise<void>;
    onClose?: () => void;
    availableVariables?: string[];
}

const DEFAULT_VARIABLES = [
    'approver_name', 'requester_name', 'po_number', 'total_amount', 
    'supplier_name', 'site_name', 'app_name', 'approval_link', 'po_link',
    'approval_date', 'requester_email', 'comments'
];

const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
    template,
    onSave,
    onClose,
    availableVariables = DEFAULT_VARIABLES
}) => {
    const [name, setName] = useState(template?.name || '');
    const [subject, setSubject] = useState(template?.subject || '');
    const [body, setBody] = useState(template?.body || '');
    const [type, setType] = useState<'APPROVAL' | 'NOTIFICATION' | 'REMINDER' | 'REJECTION'>(
        template?.type || 'APPROVAL'
    );
    const [showPreview, setShowPreview] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Sample data for preview
    const previewData: Record<string, string> = {
        approver_name: 'John Smith',
        requester_name: 'Jane Doe',
        po_number: 'PO-2024-001',
        total_amount: '1,250.00',
        supplier_name: 'Acme Supplies',
        site_name: 'Sydney Office',
        app_name: 'ProcureFlow',
        approval_link: '#',
        po_link: '#',
        approval_date: new Date().toLocaleDateString(),
        requester_email: 'jane.doe@example.com',
        comments: 'Urgent request for quarterly supplies'
    };

    const renderPreview = () => {
        let previewSubject = subject;
        let previewBody = body;

        // Replace template variables with preview data
        availableVariables.forEach(variable => {
            const regex = new RegExp(`{{${variable}}}`, 'g');
            previewSubject = previewSubject.replace(regex, previewData[variable] || `{{${variable}}}`);
            previewBody = previewBody.replace(regex, previewData[variable] || `{{${variable}}}`);
        });

        return { subject: previewSubject, body: previewBody };
    };

    const insertVariable = (variable: string) => {
        const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const before = text.substring(0, start);
            const after = text.substring(end, text.length);
            const newValue = before + `{{${variable}}}` + after;
            setBody(newValue);
            
            // Restore cursor position
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
            }, 0);
        }
    };

    const handleSave = async () => {
        if (!name || !subject || !body) {
            alert('Please fill in all required fields');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                id: template?.id,
                name,
                type,
                subject,
                body,
                variables: availableVariables
            });
            if (onClose) onClose();
        } catch (error) {
            alert('Failed to save template');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const preview = renderPreview();

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1e2029]">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                        <Mail size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {template ? 'Edit Email Template' : 'Create Email Template'}
                        </h2>
                        <p className="text-xs text-gray-500">Design custom email notifications</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
                            showPreview
                                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                        }`}
                    >
                        {showPreview ? <Eye size={16} /> : <Code size={16} />}
                        {showPreview ? 'Preview' : 'Code'}
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Editor Side */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Template Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Template Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Manager Approval Request"
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                            />
                        </div>

                        {/* Template Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Template Type
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['APPROVAL', 'NOTIFICATION', 'REMINDER', 'REJECTION'] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setType(t)}
                                        className={`px-4 py-2.5 rounded-lg border-2 transition-all font-medium text-sm ${
                                            type === t
                                                ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Subject Line */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Subject Line *
                            </label>
                            <div className="relative">
                                <Type size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="e.g., Action Required: Approve PO {{po_number}}"
                                    className="w-full px-4 py-2.5 pl-10 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Email Body */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Email Body *
                            </label>
                            <textarea
                                id="template-body"
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={12}
                                placeholder="Enter your email template here. Use {{variable_name}} to insert dynamic content."
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white font-mono text-sm resize-none"
                            />
                        </div>

                        {/* Variable Helper */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                            <div className="flex items-start gap-3 mb-3">
                                <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">Available Variables</h4>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Click to insert into email body</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {availableVariables.map((variable) => (
                                    <button
                                        key={variable}
                                        onClick={() => insertVariable(variable)}
                                        className="px-3 py-1.5 bg-white dark:bg-[#1e2029] border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-mono text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95"
                                    >
                                        {'{{'}{variable}{'}}'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <AlertCircle size={14} />
                            <span>HTML formatting supported</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-all"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !name || !subject || !body}
                                className="px-6 py-2 bg-[var(--color-brand)] text-white rounded-lg hover:opacity-90 font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Template
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Preview Side */}
                {showPreview && (
                    <div className="w-1/2 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#15171e] flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029]">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                                <Sparkles size={16} className="text-amber-500" />
                                Live Preview
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Email Preview Container */}
                            <div className="bg-white dark:bg-[#1e2029] rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                                {/* Email Header */}
                                <div className="bg-gray-100 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <div className="text-xs text-gray-500 mb-1">Subject:</div>
                                    <div className="font-bold text-gray-900 dark:text-white">{preview.subject || '(No subject)'}</div>
                                </div>
                                
                                {/* Email Body */}
                                <div 
                                    className="p-6 text-gray-700 dark:text-gray-300"
                                    dangerouslySetInnerHTML={{ __html: preview.body || '<p class="text-gray-400 italic">(Empty body)</p>' }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmailTemplateEditor;
