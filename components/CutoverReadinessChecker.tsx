import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { useApp } from '../context/AppContext.tsx';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
  ShieldCheck,
  ShoppingBag,
  RefreshCw,
  Info,
  ArrowRight,
  ClipboardCheck,
  Zap
} from 'lucide-react';
import PageHeader from './PageHeader';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { useToast, ToastContainer } from './ToastNotification.tsx';

interface HealthCheck {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'LOADING' | 'INFO';
  message: string;
  details?: string;
  gapItems?: { id: string; sku: string; name: string }[];
  count?: number;
  total?: number;
  percentage?: number;
}

const CutoverReadinessChecker = () => {
  const { currentUser, reloadData } = useApp();
  const { toasts, dismissToast, success, error: toastError } = useToast();
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEnforceModalOpen, setIsEnforceModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';

  const runChecks = useCallback(async () => {
    setIsRefreshing(true);
    const results: HealthCheck[] = [];

    try {
      // 1. Items with active sell prices (>= 95% coverage)
      const { count: activeItemsCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('active_flag', true);
      
      const { data: pricedItemsData } = await supabase
        .from('item_sell_prices')
        .select('item_id')
        .eq('status', 'ACTIVE');
      
      const uniquePricedIds = new Set((pricedItemsData || []).map(p => p.item_id));
      const pricedCount = uniquePricedIds.size;
      const coverage = activeItemsCount ? (pricedCount / activeItemsCount) * 100 : 100;
      
      let gapItems: any[] = [];
      if (coverage < 100) {
        const { data: gaps } = await supabase
          .from('items')
          .select('id, sku, name')
          .eq('active_flag', true)
          .not('id', 'in', `(${Array.from(uniquePricedIds).slice(0, 100).join(',') || '00000000-0000-0000-0000-000000000000'})`)
          .limit(10);
        gapItems = gaps || [];
      }

      results.push({
        id: 'pricing-coverage',
        name: 'Pricing Coverage (Governed)',
        status: coverage >= 95 ? 'PASS' : 'FAIL',
        message: `${pricedCount} of ${activeItemsCount} active items have governed sell prices.`,
        details: `Coverage: ${coverage.toFixed(1)}% (Target: >= 95%)`,
        gapItems: gapItems,
        percentage: coverage
      });

      // 2. Sell prices with zero cost_basis
      const { count: zeroCostCount } = await supabase
        .from('item_sell_prices')
        .select('*', { count: 'exact', head: true })
        .eq('cost_basis', 0)
        .eq('status', 'ACTIVE');

      results.push({
        id: 'zero-cost',
        name: 'Zero Cost Basis Audit',
        status: (zeroCostCount || 0) === 0 ? 'PASS' : 'WARNING',
        message: `${zeroCostCount || 0} active sell prices have a $0.00 cost basis.`,
        details: (zeroCostCount || 0) > 0 ? 'Warning: Margins will be incorrectly reported as 100%.' : 'All active prices have valid cost basis data.',
        count: zeroCostCount || 0
      });

      // 3. POCreate compiled flag check
      const { data: configData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'approved_catalogue_enforced')
        .maybeSingle();
      
      const isEnforced = configData?.value === true || configData?.value === 'true';

      results.push({
        id: 'flag-check',
        name: 'Catalogue Enforcement Status',
        status: 'INFO',
        message: `Currently: ${isEnforced ? 'ENFORCED' : 'NOT ENFORCED'}`,
        details: 'This flag controls whether PO creation blocks items without governed prices.'
      });

      // 4. Items in ACTIVE workflow status
      const { count: workflowActiveCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('workflow_status', 'ACTIVE');
      
      const { count: legacyCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('workflow_status', 'LEGACY');

      const totalItems = (workflowActiveCount || 0) + (legacyCount || 0);
      const activePercentage = totalItems ? ((workflowActiveCount || 0) / totalItems) * 100 : 0;

      results.push({
        id: 'workflow-status',
        name: 'Workflow Migration Progress',
        status: activePercentage > 0 ? 'PASS' : 'WARNING',
        message: `${workflowActiveCount || 0} items are fully governed (ACTIVE). ${legacyCount || 0} items remain as LEGACY.`,
        details: `Governance adoption: ${activePercentage.toFixed(1)}%`,
        percentage: activePercentage
      });

      // 5. Publication events failed
      const { count: failedPubCount } = await supabase
        .from('item_publication_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'FAILED');

      results.push({
        id: 'failed-publications',
        name: 'Publication Health',
        status: (failedPubCount || 0) === 0 ? 'PASS' : 'FAIL',
        message: `${failedPubCount || 0} failed publication events detected.`,
        details: (failedPubCount || 0) > 0 ? 'Critical: Fix failing integrations before cutover.' : 'No publication failures in log.'
      });

      // 6. Approval rules active
      const { count: activeRulesCount } = await supabase
        .from('item_approval_rules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      results.push({
        id: 'approval-rules',
        name: 'Governance Rules',
        status: (activeRulesCount || 0) >= 1 ? 'PASS' : 'FAIL',
        message: `${activeRulesCount || 0} active approval rules found.`,
        details: (activeRulesCount || 0) < 1 ? 'Error: System requires at least 1 active approval rule for governance.' : 'Approval engine is armed.'
      });

      // 7. In-flight item requests (Informational)
      const { count: inFlightCount } = await supabase
        .from('item_requests')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("ACTIVE","REJECTED","RETIRED","REPLACED")');

      results.push({
        id: 'in-flight-requests',
        name: 'In-Flight Requests',
        status: 'INFO',
        message: `${inFlightCount || 0} requests are currently being processed.`,
        details: 'Informational only. High volume suggests heavy master data activity.'
      });

      setChecks(results);
    } catch (err) {
      console.error('Readiness checks failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const handleEnableRequests = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ 
          key: 'item_request_form_enabled', 
          value: 'true', 
          updated_at: new Date().toISOString(),
          updated_by: currentUser?.name 
        });
      if (error) throw error;
      success('Item Request Form enabled for all users.');
      runChecks();
      reloadData();
    } catch (err) {
      toastError('Failed to update config. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnableEnforcement = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ 
          key: 'approved_catalogue_enforced', 
          value: 'true', 
          updated_at: new Date().toISOString(),
          updated_by: currentUser?.name 
        });
      if (error) throw error;
      setIsEnforceModalOpen(false);
      success('Catalogue Enforcement enabled successfully.');
      runChecks();
      reloadData();
    } catch (err) {
      toastError('Failed to update config. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const allChecksPass = checks.every(c => c.status === 'PASS' || c.status === 'INFO' || c.status === 'WARNING');
  const hasCriticalFail = checks.some(c => c.status === 'FAIL');

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 text-center">
        <ShieldCheck size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-gray-500 mt-2">Only system administrators can access the Cutover Readiness Checker.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <PageHeader 
          title="Cutover Readiness" 
          subtitle="Pre-flight system checks before flipping governance feature flags."
        />
        <button 
          onClick={runChecks} 
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Checking...' : 'Refresh Checks'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 space-y-4">
          {checks.map(check => (
            <div key={check.id} className="bg-white dark:bg-nocturne rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm flex items-start gap-4 transition-all hover:border-[var(--color-brand)]/30">
              <div className="mt-1">
                {check.status === 'PASS' && <CheckCircle className="text-emerald-500" size={24} />}
                {check.status === 'FAIL' && <XCircle className="text-red-500" size={24} />}
                {check.status === 'WARNING' && <AlertTriangle className="text-amber-500" size={24} />}
                {check.status === 'INFO' && <Info className="text-tranquil" size={24} />}
                {check.status === 'LOADING' && <RefreshCw className="text-gray-400 animate-spin" size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {check.name}
                    {check.status === 'PASS' && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded uppercase font-black">Pass</span>}
                    {check.status === 'FAIL' && <span className="text-[10px] bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded uppercase font-black">Fail</span>}
                    {check.status === 'WARNING' && <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded uppercase font-black">Warning</span>}
                  </h3>
                </div>
                <p className="text-sm text-gray-900 dark:text-gray-200 mb-1">{check.message}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{check.details}</p>

                {check.gapItems && check.gapItems.length > 0 && (
                  <div className="mt-3 bg-gray-50 dark:bg-[#15171e] rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Example items missing governed prices:</p>
                    <div className="space-y-1">
                      {check.gapItems.map(item => (
                        <div key={item.id} className="text-xs flex justify-between text-gray-600 dark:text-gray-300">
                          <span className="font-mono">{item.sku}</span>
                          <span className="truncate ml-4">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-[var(--color-brand)]/5 rounded-2xl p-6 border border-[var(--color-brand)]/20 sticky top-24">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap size={20} className="text-[var(--color-brand)]" />
              Action Center
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              Enable the following feature flags once you are satisfied with the readiness checks above.
            </p>

            <div className="space-y-4">
              <button
                onClick={handleEnableRequests}
                disabled={isProcessing}
                className="w-full flex items-center justify-between p-4 bg-white dark:bg-nocturne border border-gray-200 dark:border-gray-800 rounded-xl hover:border-[var(--color-brand)] transition-all group shadow-sm disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Enable Item Requests</p>
                  <p className="text-[10px] text-gray-500">Allow all users to request new items</p>
                </div>
                <ArrowRight size={18} className="text-gray-300 group-hover:text-[var(--color-brand)] group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={() => setIsEnforceModalOpen(true)}
                disabled={isProcessing || hasCriticalFail}
                className={`w-full flex items-center justify-between p-4 border rounded-xl transition-all group shadow-sm disabled:opacity-50 ${hasCriticalFail ? 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' : 'bg-white dark:bg-nocturne border-gray-200 dark:border-gray-800 hover:border-[var(--color-brand)]'}`}
              >
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Enforce Catalogue Pricing</p>
                  <p className="text-[10px] text-gray-500">Require governed prices for all POs</p>
                </div>
                <ShieldCheck size={18} className={hasCriticalFail ? 'text-gray-300' : 'text-gray-300 group-hover:text-[var(--color-brand)] transition-all'} />
              </button>
              
              {hasCriticalFail && (
                <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg flex gap-2">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-700 dark:text-red-400">
                    Catalogue enforcement is locked because critical readiness checks are failing. Resolve RED items first.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-2">
                <ClipboardCheck size={18} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cutover Summary</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Readiness Score</span>
                  <span className={`font-bold ${allChecksPass ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {checks.filter(c => c.status === 'PASS').length} / {checks.length} Passed
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${allChecksPass ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${checks.length > 0 ? (checks.filter(c => c.status === 'PASS').length / checks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isEnforceModalOpen}
        title="Enable Catalogue Enforcement?"
        message="This will require all PO line items to have an approved active sell price. Items without a governed price cannot be added to POs. Are you sure?"
        confirmLabel="Yes, Enable Enforcement"
        variant="warning"
        onConfirm={handleEnableEnforcement}
        onCancel={() => setIsEnforceModalOpen(false)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default CutoverReadinessChecker;
