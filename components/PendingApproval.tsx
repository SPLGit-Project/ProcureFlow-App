import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, LogOut, Send, CheckCircle2 } from 'lucide-react';

const PendingApproval = () => {
    const { logout, currentUser, updateProfile } = useApp();
    const [formData, setFormData] = useState({
        jobTitle: currentUser?.jobTitle || '',
        department: currentUser?.department || '',
        approvalReason: currentUser?.approvalReason || ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(!!currentUser?.approvalReason);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await updateProfile({
                jobTitle: formData.jobTitle,
                department: formData.department,
                approvalReason: formData.approvalReason
            });
            setHasSubmitted(true);
        } catch (error) {
            console.error("Failed to submit request", error);
            alert("Failed to submit request. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#15171e] flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 w-full max-w-lg animate-slide-up">
                
                <div className="text-center mb-8">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${hasSubmitted ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                        {hasSubmitted ? <CheckCircle2 size={32} /> : <Clock size={32} />}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {hasSubmitted ? 'Request Submitted' : 'Complete Your Profile'}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        {hasSubmitted 
                            ? 'Your access request is being reviewed by an administrator. You will be notified once approved.'
                            : `Hi ${currentUser?.name}, please provide a few details to speed up your access approval.`
                        }
                    </p>
                </div>

                {!hasSubmitted ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Title</label>
                                <input 
                                    required
                                    type="text" 
                                    value={formData.jobTitle}
                                    onChange={e => setFormData({...formData, jobTitle: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                                    placeholder="e.g. Procurement Officer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                                <input 
                                    required
                                    type="text" 
                                    value={formData.department}
                                    onChange={e => setFormData({...formData, department: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white"
                                    placeholder="e.g. Finance"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Access</label>
                            <textarea 
                                required
                                value={formData.approvalReason}
                                onChange={e => setFormData({...formData, approvalReason: e.target.value})}
                                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:text-white h-24 resize-none"
                                placeholder="Briefly describe why you need access..."
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full bg-[var(--color-brand)] text-white font-semibold py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Send size={18} /> Submit Request
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <div className="bg-gray-50 dark:bg-[#15171e] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Request Details</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Role:</span>
                                <span className="text-gray-900 dark:text-white font-medium">{formData.jobTitle}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-gray-500">Department:</span>
                                <span className="text-gray-900 dark:text-white font-medium">{formData.department}</span>
                            </div>
                             <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-gray-500 text-xs mb-1">Reason:</p>
                                <p className="text-gray-900 dark:text-white italic">"{formData.approvalReason}"</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                    <button 
                        onClick={logout}
                        className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors text-sm font-medium"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PendingApproval;
