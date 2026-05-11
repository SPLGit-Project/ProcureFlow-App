import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ItemRequest } from '../types';
import { searchExistingItems, saveDuplicateCheckOutcome, DuplicateCheckInput } from '../services/itemRequestService';

interface DuplicateCheckPanelProps {
  request: ItemRequest;
  onComplete: () => void;
}

interface CandidateItem {
  item_id: string;
  sku: string;
  name: string;
  similarity_score: number;
  category?: string;
}

export const DuplicateCheckPanel: React.FC<DuplicateCheckPanelProps> = ({ request, onComplete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [candidateItems, setCandidateItems] = useState<CandidateItem[]>([]);
  const [outcome, setOutcome] = useState<'NO_DUPLICATE' | 'USE_EXISTING' | 'SIMILAR_NEW_REQUIRED' | ''>('');
  const [existingItemId, setExistingItemId] = useState<string>('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    try {
      const results = await searchExistingItems(searchTerm);
      setSearchResults(results);
      if (!searchTerms.includes(searchTerm)) {
        setSearchTerms(prev => [...prev, searchTerm]);
      }
    } catch (err) {
      console.error(err);
      setError('Search failed. Please try again.');
    }
  };

  const addCandidate = (item: any) => {
    if (candidateItems.find(c => c.item_id === item.id)) return;
    setCandidateItems(prev => [...prev, {
      item_id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      similarity_score: 1.0 // Default for manual selection
    }]);
  };

  const removeCandidate = (id: string) => {
    setCandidateItems(prev => prev.filter(c => c.item_id !== id));
  };

  const handleLockOutcome = async () => {
    if (!outcome) {
      setError('Please select an outcome.');
      return;
    }

    if (outcome === 'USE_EXISTING' && !existingItemId) {
      setError('Please select the existing item to use.');
      return;
    }

    if (outcome === 'SIMILAR_NEW_REQUIRED' && justification.length < 50) {
      setError('Justification must be at least 50 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: DuplicateCheckInput = {
        request_id: request.id,
        search_terms: searchTerms,
        candidate_items: candidateItems.map(c => ({
            item_id: c.item_id,
            sku: c.sku,
            name: c.name,
            similarity_score: c.similarity_score
        })),
        outcome: outcome as any,
        existing_item_id: existingItemId || undefined,
        justification: justification || undefined,
      };

      await saveDuplicateCheckOutcome(input);
      setIsLocked(true);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save outcome.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLocked) {
    return (
      <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 text-green-600 mb-2">
          <CheckCircle2 size={24} />
          <h2 className="text-xl font-bold">Duplicate Check Locked</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Search Terms</h3>
            <div className="flex flex-wrap gap-2">
              {searchTerms.length > 0 ? searchTerms.map(term => (
                <span key={term} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm font-medium">
                  {term}
                </span>
              )) : <span className="text-gray-400 italic">No terms searched</span>}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Outcome</h3>
            <div className="p-4 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800">
              <p className="font-bold text-gray-900 dark:text-white">
                {outcome === 'NO_DUPLICATE' && 'No Duplicate Found'}
                {outcome === 'USE_EXISTING' && 'Use Existing Item'}
                {outcome === 'SIMILAR_NEW_REQUIRED' && 'Similar Item Exists — new item still required'}
              </p>
              {outcome === 'USE_EXISTING' && (
                <p className="text-sm text-[#129DC0] mt-1 font-mono">ID: {existingItemId}</p>
              )}
              {justification && (
                <p className="text-sm text-gray-500 mt-2 italic">"{justification}"</p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs text-gray-400 uppercase tracking-widest">
           <Lock size={12} /> Permanent Audit Record
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden animate-page-entry">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#181a21]/50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Duplicate Verification</h2>
          <p className="text-sm text-gray-500">Perform a mandatory search for existing items before proceeding.</p>
        </div>
        <div className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200 dark:border-amber-800/50">
          Pending Action
        </div>
      </div>

      <div className="p-8 space-y-10">
        {/* Section A: Search */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#129DC0]/10 rounded-lg flex items-center justify-center text-[#129DC0]">
              <Search size={18} />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Section A: Search & Discovery</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Search for similar items</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="input-field pl-10"
                    placeholder="SKU, Name, or Description..."
                  />
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all"
                >
                  Search
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-800/30 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Search Results
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {searchResults.map(item => (
                      <div
                        key={item.id}
                        onClick={() => addCandidate(item)}
                        className="p-3 flex items-center justify-between hover:bg-white dark:hover:bg-gray-800 cursor-pointer group transition-colors border-b last:border-0 border-gray-100 dark:border-gray-800"
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-[#129DC0] transition-colors">{item.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.sku} • {item.category}</p>
                        </div>
                        <Plus size={14} className="text-gray-300 group-hover:text-[#129DC0]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Potential Candidates ({candidateItems.length})</label>
              <div className="bg-white dark:bg-[#1a1c23] rounded-xl border border-dashed border-gray-300 dark:border-gray-700 min-h-[140px] p-4">
                {candidateItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <p className="text-xs text-gray-400 italic">No candidates selected. Search and click results to add them to this audit list.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {candidateItems.map(item => (
                      <div key={item.item_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                        </div>
                        <button onClick={() => removeCandidate(item.item_id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section B: Outcome */}
        <section className="space-y-6 pt-6 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#129DC0]/10 rounded-lg flex items-center justify-center text-[#129DC0]">
              <CheckCircle2 size={18} />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Section B: Final Outcome</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className={`p-4 rounded-xl border cursor-pointer transition-all ${outcome === 'NO_DUPLICATE' ? 'border-[#129DC0] bg-[#129DC0]/5' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1c23] hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="outcome"
                  className="sr-only"
                  checked={outcome === 'NO_DUPLICATE'}
                  onChange={() => setOutcome('NO_DUPLICATE')}
                />
                <p className="font-bold text-sm text-gray-900 dark:text-white">No Duplicate</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">Proceed to technical definition for a new item record.</p>
              </label>

              <label className={`p-4 rounded-xl border cursor-pointer transition-all ${outcome === 'USE_EXISTING' ? 'border-[#129DC0] bg-[#129DC0]/5' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1c23] hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="outcome"
                  className="sr-only"
                  checked={outcome === 'USE_EXISTING'}
                  onChange={() => setOutcome('USE_EXISTING')}
                />
                <p className="font-bold text-sm text-gray-900 dark:text-white">Use Existing</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">Cancel request and map this requirement to an active item.</p>
              </label>

              <label className={`p-4 rounded-xl border cursor-pointer transition-all ${outcome === 'SIMILAR_NEW_REQUIRED' ? 'border-[#129DC0] bg-[#129DC0]/5' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1c23] hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="outcome"
                  className="sr-only"
                  checked={outcome === 'SIMILAR_NEW_REQUIRED'}
                  onChange={() => setOutcome('SIMILAR_NEW_REQUIRED')}
                />
                <p className="font-bold text-sm text-gray-900 dark:text-white">Similar Exists</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">Similar items exist but a new record is technically required.</p>
              </label>
            </div>

            {outcome === 'USE_EXISTING' && (
              <div className="space-y-3 p-6 bg-[#129DC0]/5 rounded-xl border border-[#129DC0]/20 animate-slide-down">
                <label className="text-xs font-black uppercase tracking-widest text-[#129DC0]">Select Existing Item *</label>
                <select
                  value={existingItemId}
                  onChange={(e) => setExistingItemId(e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#129DC0]/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                >
                  <option value="">Select from candidates...</option>
                  {candidateItems.map(c => (
                    <option key={c.item_id} value={c.item_id}>{c.sku} - {c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 italic">If the item is not in this list, add it as a candidate in Section A first.</p>
              </div>
            )}

            {outcome === 'SIMILAR_NEW_REQUIRED' && (
              <div className="space-y-3 p-6 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 animate-slide-down">
                <label className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Technical Justification *</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white h-32 resize-none"
                  placeholder="Explain why existing candidates do not satisfy this requirement (min 50 characters)..."
                />
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-gray-500">Must be specific (e.g., color variation, size difference, material grade).</p>
                  <p className={`text-[10px] font-bold ${justification.length < 50 ? 'text-red-500' : 'text-green-500'}`}>
                    {justification.length} / 50 characters
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 animate-slide-up">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="p-4 bg-gray-50 dark:bg-[#15171e] rounded-xl border border-gray-200 dark:border-gray-800 flex items-start gap-4">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-bold text-gray-900 dark:text-white">Warning:</span> Once the outcome is locked, it cannot be changed. This record is part of the permanent audit trail for this item request and may be subject to compliance review.
            </p>
          </div>

          <button
            onClick={handleLockOutcome}
            disabled={isSubmitting || !outcome}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl ${
              !outcome 
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed' 
                : 'bg-[#129DC0] hover:bg-[#0f87a8] text-white shadow-[#129DC0]/20'
            }`}
          >
            {isSubmitting ? 'Locking Record...' : (
              <>
                <Lock size={18} /> Lock Outcome & Proceed
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
