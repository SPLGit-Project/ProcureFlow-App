import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileText, Link2, Package, Search, ShieldCheck } from 'lucide-react';
import ItemRequestWizardShell, { WizardStep } from '../ItemRequestWizardShell';
import { ToastContainer, useToast } from '../ToastNotification';
import { getItemRequest, saveDuplicateCheckOutcome, searchExistingItems } from '../../services/itemRequestService';
import { transitionRequest } from '../../services/itemWorkflowService';
import { extractSearchTokens, generateItemCode } from '../../utils/itemNameGenerator';
import { ItemRequest } from '../../types';

type DuplicateOutcome = 'USE_EXISTING' | 'SIMILAR_NEW_REQUIRED' | 'NO_DUPLICATE';

interface ExistingItemResult {
  id: string;
  sku: string;
  name: string;
  category: string;
  similarity_score: number;
}

const STEPS: WizardStep[] = [
  { id: 'summary', label: 'Request Summary' },
  { id: 'search', label: 'Catalogue Search' },
  { id: 'decision', label: 'Outcome Decision' },
  { id: 'confirm', label: 'Confirm & Record' },
];

function similarity(searchTerms: string[], itemText: string): number {
  const targetWords = new Set(itemText.toLowerCase().split(/\W+/).filter(w => w.length >= 2));
  if (targetWords.size === 0) return 0.35;

  let totalMatches = 0;
  let totalSource = 0;

  for (const term of searchTerms) {
    const sourceWords = term.toLowerCase().split(/\W+/).filter(w => w.length >= 2);
    if (sourceWords.length === 0) continue;
    const matches = sourceWords.filter(w => targetWords.has(w) || [...targetWords].some(t => t.includes(w) || w.includes(t))).length;
    totalMatches += matches;
    totalSource += sourceWords.length;
  }

  if (totalSource === 0) return 0.35;
  return Math.min(0.98, Math.max(0.35, totalMatches / totalSource));
}

function RequestContext({ request }: { request: ItemRequest }) {
  const systems = [
    request.target_sap && 'SAP',
    request.target_bundle && 'Bundle',
    request.target_linenhub && 'LinenHub',
    request.target_salesforce && 'Salesforce',
  ].filter(Boolean);

  return (
    <aside className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Proposed Item Code</p>
        <p className="font-mono text-sm font-bold text-[var(--color-brand)]">{generateItemCode(request.item_description)}</p>
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Description</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{request.item_description}</p>
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Business Reason</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{request.business_reason}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {systems.map(system => (
          <span key={system as string} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-500">
            {system}
          </span>
        ))}
      </div>
    </aside>
  );
}

export default function DuplicateCheckWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, dismissToast, success, error: toastError } = useToast();

  const [request, setRequest] = useState<ItemRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [results, setResults] = useState<ExistingItemResult[]>([]);
  const [outcome, setOutcome] = useState<DuplicateOutcome | ''>('');
  const [existingItemId, setExistingItemId] = useState('');
  const [justification, setJustification] = useState('');

  const selectedExisting = useMemo(
    () => results.find(item => item.id === existingItemId),
    [existingItemId, results]
  );

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) return;
    // Split description into meaningful tokens for granular DB matching
    const tokens = extractSearchTokens(term.trim());
    const queryTokens = tokens.length > 0 ? tokens : [term.trim()];
    const raw = await searchExistingItems(queryTokens);
    // Dedupe by id then score each result against all search tokens
    const deduped = Array.from(new Map(raw.map(r => [r.id, r])).values());
    const scored = deduped.map(item => ({
      ...item,
      similarity_score: similarity(queryTokens, `${item.sku} ${item.name} ${item.short_name ?? ''} ${item.category ?? ''}`),
    })).sort((a, b) => b.similarity_score - a.similarity_score);
    setResults(scored);
    setSearchTerms(prev => prev.includes(term.trim()) ? prev : [...prev, term.trim()]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setIsLoading(true);
      try {
        const loaded = await getItemRequest(id);
        if (!loaded) throw new Error('Request not found.');
        if (loaded.status === 'SUBMITTED') {
          await transitionRequest(loaded.id, 'DUPLICATE_REVIEW', {
            notes: 'Duplicate check wizard started.',
            metadata: { action: 'START_DUPLICATE_CHECK' },
          });
          loaded.status = 'DUPLICATE_REVIEW';
        }
        if (cancelled) return;
        setRequest(loaded);
        setSearchTerm(loaded.item_description);
        await runSearch(loaded.item_description);
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load duplicate check.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, runSearch, toastError]);

  const validate = () => {
    if (activeStep === 2 && !outcome) return 'Select the duplicate check outcome.';
    if (activeStep === 2 && outcome === 'USE_EXISTING' && !existingItemId) return 'Select the existing item to link.';
    if (activeStep === 2 && outcome === 'SIMILAR_NEW_REQUIRED' && justification.trim().length < 30) {
      return 'Enter a justification of at least 30 characters.';
    }
    return null;
  };

  const handleContinue = async () => {
    const validationError = validate();
    if (validationError) {
      toastError(validationError);
      return;
    }

    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
      return;
    }

    if (!request || !outcome) return;
    setIsSaving(true);
    try {
      await saveDuplicateCheckOutcome({
        request_id: request.id,
        search_terms: searchTerms,
        candidate_items: results.map(item => ({
          item_id: item.id,
          sku: item.sku,
          name: item.name,
          similarity_score: item.similarity_score,
        })),
        outcome,
        existing_item_id: existingItemId || undefined,
        justification: justification.trim() || undefined,
      });
      success('Duplicate check outcome recorded.');
      navigate(outcome === 'USE_EXISTING' ? `/items/requests/${request.id}` : `/items/requests/${request.id}/define`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to record duplicate check.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ItemRequestWizardShell
        title="Duplicate Check"
        subtitle="Verify whether the requested item already exists"
        steps={STEPS}
        activeStepIndex={activeStep}
        onContinue={handleContinue}
        onPrevious={activeStep > 0 ? () => setActiveStep(prev => prev - 1) : undefined}
        onCancel={() => navigate('/items/master-data-queue')}
        continueLabel={activeStep === STEPS.length - 1 ? 'Record Outcome' : 'Continue'}
        continueDisabled={isSaving || isLoading}
        isSaving={isSaving}
        isLoading={isLoading}
        contextPanel={request ? <RequestContext request={request} /> : undefined}
      >
        {request && activeStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Review the request context</h2>
              <p className="text-sm text-gray-500 mt-1">Confirm the item need before searching the catalogue.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl">
                <FileText size={18} className="text-[var(--color-brand)] mb-3" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Type</p>
                <p className="font-bold text-gray-900 dark:text-white">{request.request_type.replaceAll('_', ' ')}</p>
              </div>
              <div className="p-5 bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl">
                <Package size={18} className="text-[var(--color-brand)] mb-3" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Priority</p>
                <p className="font-bold text-gray-900 dark:text-white">{request.is_urgent ? 'Urgent' : 'Standard'}</p>
              </div>
            </div>
          </div>
        )}

        {activeStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Search the item catalogue</h2>
              <p className="text-sm text-gray-500 mt-1">The initial search is seeded from the request description.</p>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && runSearch(searchTerm)}
                  className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                  placeholder="Search by SKU, name, or description"
                />
              </div>
              <button onClick={() => runSearch(searchTerm)} className="px-5 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black uppercase tracking-widest">
                Search
              </button>
            </div>
            <div className="space-y-3">
              {results.map(item => (
                <button
                  key={item.id}
                  onClick={() => setExistingItemId(item.id)}
                  className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-4 transition-all ${
                    existingItemId === item.id
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{item.sku} - {item.category || 'Uncategorised'}</p>
                  </div>
                  <span className="text-xs font-black text-[var(--color-brand)]">{Math.round(item.similarity_score * 100)}%</span>
                </button>
              ))}
              {results.length === 0 && (
                <div className="p-8 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-sm text-gray-400">
                  No catalogue matches found yet.
                </div>
              )}
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Choose the outcome</h2>
              <p className="text-sm text-gray-500 mt-1">This decision becomes part of the request audit trail.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ['USE_EXISTING', 'Exact Duplicate', 'Route the request to the existing item.'],
                ['SIMILAR_NEW_REQUIRED', 'Similar, New Required', 'Document why a new record is still needed.'],
                ['NO_DUPLICATE', 'No Duplicate Found', 'Advance to item definition.'],
              ].map(([value, label, detail]) => (
                <button
                  key={value}
                  onClick={() => setOutcome(value as DuplicateOutcome)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    outcome === value
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029]'
                  }`}
                >
                  <p className="font-bold text-gray-900 dark:text-white">{label}</p>
                  <p className="text-xs text-gray-500 mt-1">{detail}</p>
                </button>
              ))}
            </div>
            {outcome === 'USE_EXISTING' && (
              <div className="p-4 rounded-2xl bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/20">
                <label className="block text-xs font-black text-[var(--color-brand)] uppercase tracking-widest mb-2">Existing item</label>
                <select value={existingItemId} onChange={event => setExistingItemId(event.target.value)} className="w-full bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm">
                  <option value="">Select a search result</option>
                  {results.map(item => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}
                </select>
              </div>
            )}
            {outcome === 'SIMILAR_NEW_REQUIRED' && (
              <textarea
                value={justification}
                onChange={event => setJustification(event.target.value)}
                className="w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm min-h-32"
                placeholder="Explain why the similar catalogue items do not satisfy this request."
              />
            )}
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Confirm and record</h2>
              <p className="text-sm text-gray-500 mt-1">Review the recorded outcome before advancing the workflow.</p>
            </div>
            <div className="bg-white dark:bg-[#1e2029] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                {outcome === 'USE_EXISTING' ? <Link2 size={18} className="text-[var(--color-brand)]" /> : outcome === 'NO_DUPLICATE' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <ShieldCheck size={18} className="text-amber-500" />}
                <p className="font-bold text-gray-900 dark:text-white">{outcome ? outcome.replaceAll('_', ' ') : 'No outcome selected'}</p>
              </div>
              {selectedExisting && <p className="text-sm text-gray-500">Existing item: {selectedExisting.sku} - {selectedExisting.name}</p>}
              {justification && <p className="text-sm text-gray-500">{justification}</p>}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <AlertCircle size={16} className="mt-0.5" />
                <p className="text-xs">Once recorded, the request will move to {outcome === 'USE_EXISTING' ? 'Active' : 'Item Definition'}.</p>
              </div>
            </div>
          </div>
        )}
      </ItemRequestWizardShell>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
