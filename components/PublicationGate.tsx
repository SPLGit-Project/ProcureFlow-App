import React, { useState, useEffect } from 'react';
import { 
  Play, CheckCircle2, XCircle, AlertTriangle, Globe, RefreshCw, 
  Info, Loader2, Database, Layout, ShieldCheck, ArrowRight
} from 'lucide-react';
import { runCompletenessCheck, triggerPublication, CompletenessResult } from '../services/publicationService';
import { useApp } from '../context/AppContext';

interface PublicationGateProps {
  itemId: string;
  requestId: string;
  onPublished?: () => void;
}

export const PublicationGate: React.FC<PublicationGateProps> = ({ itemId, requestId, onPublished }) => {
  const { hasPermission } = useApp();
  const [checkResult, setCheckResult] = useState<CompletenessResult | null>(null);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunCheck = async () => {
    setIsRunningCheck(true);
    setError(null);
    try {
      const result = await runCompletenessCheck(itemId);
      setCheckResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to run completeness check.');
    } finally {
      setIsRunningCheck(false);
    }
  };

  const handlePublish = async () => {
    if (!checkResult?.is_complete) return;
    
    setIsPublishing(true);
    setError(null);
    try {
      await triggerPublication(requestId, itemId);
      if (onPublished) onPublished();
    } catch (err: any) {
      setError(err.message || 'Failed to publish item.');
    } finally {
      setIsPublishing(false);
    }
  };

  const canPublish = hasPermission('publish_items');

  if (!canPublish) {
    return (
      <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-4 text-amber-700">
        <ShieldCheck size={24} />
        <div>
          <p className="font-bold">Publication Restricted</p>
          <p className="text-sm">You do not have the 'publish_items' permission required to authorize the publication of this item.</p>
        </div>
      </div>
    );
  }

  // Grouping results by system
  const systems = [
    { id: 'CORE', label: 'Core (All Systems)', filter: (r: any) => r.required_for === 'ALL' || r.required_for === 'CORE' },
    { id: 'SAP', label: 'Financial (SAP)', filter: (r: any) => r.required_for === 'SAP' },
    { id: 'ECOM', label: 'Bundle / LinenHub', filter: (r: any) => r.required_for === 'BUNDLE' || r.required_for === 'LINENHUB' },
    { id: 'CRM', label: 'Salesforce', filter: (r: any) => r.required_for === 'SALESFORCE' }
  ];

  return (
    <div className="bg-white dark:bg-[#1e2029] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden animate-page-entry">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#181a21]/50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Master Data Publication Gate</h2>
          <p className="text-sm text-gray-500">Final verification and dispatch to downstream systems.</p>
        </div>
        <div className="w-10 h-10 bg-[#129DC0]/10 rounded-full flex items-center justify-center text-[#129DC0]">
          <Globe size={20} />
        </div>
      </div>

      {!checkResult ? (
        <div className="p-12 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-500 mx-auto">
              <Database size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Readiness Check Required</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Before an item can be made available to Bundle, LinenHub, Salesforce, or SAP, all required fields must be populated. This check verifies technical readiness across all target systems.
            </p>
            <button
              onClick={handleRunCheck}
              disabled={isRunningCheck}
              className="w-full py-4 bg-[#129DC0] hover:bg-[#0f87a8] text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-[#129DC0]/20 disabled:opacity-50"
            >
              {isRunningCheck ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
              Run Completeness Check
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 space-y-8">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-50 dark:bg-[#1a1c23] rounded-xl border border-gray-200 dark:border-gray-800">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Checks</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{checkResult.total_checks}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200/50 dark:border-green-800/50">
              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Passed</p>
              <p className="text-2xl font-black text-green-600">{checkResult.passed_checks}</p>
            </div>
            <div className={`p-4 rounded-xl border ${checkResult.failed_checks > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200/50 dark:border-red-800/50' : 'bg-gray-50 dark:bg-[#1a1c23] border-gray-200 dark:border-gray-800'}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${checkResult.failed_checks > 0 ? 'text-red-600' : 'text-gray-400'}`}>Failed</p>
              <p className={`text-2xl font-black ${checkResult.failed_checks > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{checkResult.failed_checks}</p>
            </div>
          </div>

          {/* Checklist Table */}
          <div className="space-y-6">
            {systems.map(system => {
              const systemResults = checkResult.results.filter(system.filter);
              if (systemResults.length === 0) return null;
              
              const allPassed = systemResults.every(r => r.passed);

              return (
                <div key={system.id} className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <div className={`p-4 flex items-center justify-between ${allPassed ? 'bg-green-50/50 dark:bg-green-900/5' : 'bg-gray-50 dark:bg-[#1a1c23]'}`}>
                    <div className="flex items-center gap-3">
                      {allPassed ? <CheckCircle2 className="text-green-500" size={18} /> : <Database className="text-gray-400" size={18} />}
                      <span className="font-bold text-gray-900 dark:text-white">{system.label}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {systemResults.filter(r => r.passed).length} / {systemResults.length} Ready
                    </span>
                  </div>
                  <table className="w-full text-left border-t border-gray-200 dark:border-gray-800">
                    <thead className="bg-gray-50/50 dark:bg-[#181a21]/50">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Field</th>
                        <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {systemResults.map((res, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{res.field}</p>
                            {!res.passed && (
                              <p className="text-xs text-red-500 mt-1 font-medium italic">
                                Missing value. Go to Item Definition to resolve.
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {res.passed ? (
                              <div className="inline-flex items-center gap-1.5 text-green-500 px-2 py-1 bg-green-500/10 rounded-full">
                                <CheckCircle2 size={12} />
                                <span className="text-[10px] font-black uppercase">Pass</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 text-red-500 px-2 py-1 bg-red-500/10 rounded-full">
                                <XCircle size={12} />
                                <span className="text-[10px] font-black uppercase">Fail</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600">
              <AlertTriangle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-4">
            {checkResult.is_complete ? (
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="w-full py-4 bg-[#129DC0] hover:bg-[#0f87a8] text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-[#129DC0]/20"
              >
                {isPublishing ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                Authorize & Publish Item
              </button>
            ) : (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-4 text-red-700">
                <XCircle size={24} />
                <div>
                  <p className="font-bold">{checkResult.failed_checks} Mandatory Checks Failed</p>
                  <p className="text-sm">You cannot publish this item until all required fields for the targeted systems are populated.</p>
                </div>
              </div>
            )}
            
            <button
              onClick={handleRunCheck}
              disabled={isRunningCheck}
              className="w-full py-3 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className={isRunningCheck ? 'animate-spin' : ''} size={14} />
              Re-run Completeness Check
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
