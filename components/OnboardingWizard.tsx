import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, MapPin, ArrowRight, User as UserIcon, Building2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const OnboardingWizard = () => {
    const { currentUser, logout, sites, updateProfile } = useApp();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    const [requestAllSites, setRequestAllSites] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSiteToggle = (siteId: string) => {
        if (requestAllSites) return;
        setSelectedSites(prev => 
            prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
        );
    };

    const handleRequestAllToggle = () => {
        setRequestAllSites(!requestAllSites);
        if (!requestAllSites) {
            setSelectedSites([]); // Clear manual selections effectively
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // We save the preference in a structured way in approvalReason for now, 
            // or we could add a specific column 'requested_sites' if we wanted strict schema.
            // Using approvalReason is flexible and works with existing schema.
            const siteNames = requestAllSites 
                ? "ALL SITES" 
                : sites.filter(s => selectedSites.includes(s.id)).map(s => s.name).join(', ');

            await updateProfile({
                approvalReason: `Requested Access: ${siteNames}`
            });
            setStep(3);
        } catch (error) {
            console.error("Onboarding failed", error);
            alert("Failed to submit request. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (step === 3) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#15171e] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl w-full max-w-lg p-8 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Request Submitted!</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        Your access request has been sent to the administrators. You will be notified via email once approved.
                    </p>
                    <button onClick={logout} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium flex items-center justify-center gap-2 w-full">
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#15171e] flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 w-full max-w-2xl overflow-hidden flex flex-col h-[600px]">
                
                {/* Header */}
                <div className="bg-[var(--color-brand)] p-6 text-white text-center">
                    <h1 className="text-2xl font-bold">Welcome to ProcureFlow</h1>
                    <p className="text-blue-100 mt-1">Let's get you set up, {currentUser?.name.split(' ')[0]}</p>
                </div>

                {/* Progress */}
                <div className="flex justify-center gap-2 mt-[-12px] mb-4">
                     <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 1 ? 'bg-green-400' : 'bg-gray-200'}`} />
                     <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 2 ? 'bg-green-400' : 'bg-gray-200'}`} />
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 overflow-y-auto">
                    {step === 1 && (
                        <div className="space-y-6 animate-slide-up">
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Confirm Your Profile</h3>
                                <p className="text-sm text-gray-500">We pulled these details from your Microsoft 365 account.</p>
                            </div>

                            <div className="bg-gray-50 dark:bg-[#15171e] rounded-xl p-6 space-y-4 border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100 dark:border-gray-800 shrink-0">
                                        <img src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || '')}&background=random&color=fff`} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900 dark:text-white text-lg">{currentUser?.name}</div>
                                        <div className="text-gray-500 text-sm">{currentUser?.email}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Job Title</label>
                                        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-medium">
                                            <UserIcon size={16} className="text-gray-400" />
                                            {currentUser?.jobTitle || "Not Specified"}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Department</label>
                                        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-medium">
                                            <Building2 size={16} className="text-gray-400" />
                                            {currentUser?.department || "Not Specified"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-slide-up h-full flex flex-col">
                            <div className="text-center shrink-0">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Select Access Required</h3>
                                <p className="text-sm text-gray-500">Which sites do you need to manage procurement for?</p>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${requestAllSites ? 'border-[var(--color-brand)] bg-blue-50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                                    <input type="checkbox" className="w-5 h-5 accent-[var(--color-brand)]" checked={requestAllSites} onChange={handleRequestAllToggle} />
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white">All Sites (Company Wide)</div>
                                        <div className="text-xs text-gray-500">Request access to all current and future locations</div>
                                    </div>
                                </label>

                                <div className={`space-y-2 pl-4 transition-opacity ${requestAllSites ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Individual Sites</div>
                                    {sites.map(site => (
                                        <label key={site.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer bg-white dark:bg-[#15171e] ${selectedSites.includes(site.id) ? 'border-[var(--color-brand)] ring-1 ring-[var(--color-brand)]' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'}`}>
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded accent-[var(--color-brand)]" 
                                                checked={selectedSites.includes(site.id)}
                                                onChange={() => handleSiteToggle(site.id)}
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900 dark:text-white text-sm">{site.name}</div>
                                                <div className="text-xs text-gray-500">{site.suburb}, {site.state}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#15171e] flex justify-between items-center">
                    {step === 1 ? (
                        <button onClick={logout} className="text-gray-500 hover:text-gray-700 font-medium text-sm">
                            Cancel & Sign Out
                        </button>
                    ) : (
                        <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-700 font-medium text-sm">
                            Back
                        </button>
                    )}

                    <button 
                        onClick={() => step === 1 ? setStep(2) : handleSubmit()}
                        disabled={step === 2 && !requestAllSites && selectedSites.length === 0}
                        className="bg-[var(--color-brand)] text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Submitting...' : step === 1 ? <>Continue <ArrowRight size={18} /></> : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;
