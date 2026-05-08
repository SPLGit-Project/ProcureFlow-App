import { useState } from 'react';
import { Play, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.ts';
import { useToast, ToastContainer } from './ToastNotification.tsx';
import { useApp } from '../context/AppContext.tsx';
import { Navigate } from 'react-router-dom';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import PageHeader from './PageHeader.tsx';

const AdminTools = () => {
    const { hasPermission } = useApp();
    const [isRunning, setIsRunning] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const { toasts, dismissToast, success, error } = useToast();

    // Security check - only Admin can access this component
    if (!hasPermission('manage_settings')) {
        return <Navigate to="/" replace />;
    }

    const handleRunPriceActivation = async () => {
        if (isRunning) return;
        setIsRunning(true);
        try {
            console.log("Admin: Invoking activate-future-prices...");
            const { data, error: functionError } = await supabase.functions.invoke('activate-future-prices', {
                body: {}
            });

            if (functionError) throw functionError;

            const activated = data?.activated || 0;
            const errors = data?.errors || [];

            if (errors.length > 0) {
                error(`Activated ${activated} prices, but encountered ${errors.length} errors. Check function logs.`);
            } else {
                success(`Successfully activated ${activated} future prices.`);
            }

            console.log("Admin: Price activation results:", data);
        } catch (err: any) {
            console.error("Admin: Failed to run price activation:", err);
            error(err.message || "Failed to run price activation function.");
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="space-y-8 animate-page-entry max-w-4xl mx-auto">
            <PageHeader
                title="Admin Maintenance Tools"
                subtitle="Internal system controls and manual job execution for platform maintenance."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm p-8 flex flex-col justify-between group hover:shadow-xl transition-all border-b-4 border-b-amber-500">
                    <div>
                        <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Play className="text-amber-500" size={28} />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Activate Future Prices</h3>
                        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                            Manually trigger the price activation engine. This finds all <strong>APPROVED_FUTURE</strong> sell prices with effective dates on or before today, sets them to <strong>ACTIVE</strong>, and supersedes outgoing records.
                        </p>
                    </div>

                    <button
                        onClick={() => setIsConfirmOpen(true)}
                        disabled={isRunning}
                        className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-amber-500 dark:hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50 shadow-lg"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                Running Job...
                            </>
                        ) : (
                            <>
                                <Play size={16} fill="currentColor" />
                                Run Activation Job
                            </>
                        )}
                    </button>
                </div>

                <div className="bg-white dark:bg-[#1e2029] border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm p-8 flex flex-col justify-center items-center text-center border-dashed border-2">
                    <div className="w-14 h-14 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                        <CheckCircle className="text-gray-300" size={28} />
                    </div>
                    <h3 className="text-lg font-black text-gray-300 uppercase tracking-tight mb-2">Scheduled Maintenance</h3>
                    <p className="text-xs text-gray-400">Additional system diagnostics and batch operations will appear here as more maintenance tooling is introduced.</p>
                </div>
            </div>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Run Price Activation Job"
                message="This will activate all APPROVED_FUTURE sell prices whose effective date has been reached (today or earlier) and supersede outgoing active records. This action cannot be undone. Continue?"
                confirmLabel="Run Job"
                variant="warning"
                onConfirm={() => { setIsConfirmOpen(false); handleRunPriceActivation(); }}
                onCancel={() => setIsConfirmOpen(false)}
            />

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
};

export default AdminTools;
