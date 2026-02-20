
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useNavigate } from 'react-router-dom';
import { Search, Link as LinkIcon, CheckCircle, Activity, List, MapPin } from 'lucide-react';
import { PORequest } from '../types.ts';

const ActiveRequestsView = () => {
    const { pos, isLoadingData, linkConcurPO, currentUser: _currentUser } = useApp();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMode, setFilterMode] = useState<'PENDING' | 'ACTIVE' | 'ALL'>('ALL'); // Improved filter state
    
    // Modal State
    const [isConcurModalOpen, setIsConcurModalOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState<PORequest | null>(null);

    const filteredPOs = useMemo(() => {
        return pos.filter(po => {
            // Status Filter Logic
            const isPendingConcur = po.status === 'APPROVED_PENDING_CONCUR';
            const isActive = po.status === 'ACTIVE';
            
            if (filterMode === 'PENDING' && !isPendingConcur) return false;
            if (filterMode === 'ACTIVE' && !isActive) return false;
            if (filterMode === 'ALL' && !isPendingConcur && !isActive) return false;

            // Search Filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    (po.displayId || po.id).toLowerCase().includes(searchLower) ||
                    po.supplierName.toLowerCase().includes(searchLower) ||
                    po.requesterName.toLowerCase().includes(searchLower) ||
                    (po.site || '').toLowerCase().includes(searchLower) ||
                    po.totalAmount.toString().includes(searchLower)
                );
            }

            return true;
        }).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
    }, [pos, searchTerm, filterMode]);

    const handleOpenConcurModal = (po: PORequest) => {
        setSelectedPO(po);
        setIsConcurModalOpen(true);
    };

    const handleConcurSubmit = (concurPoNum: string) => {
        if (selectedPO) {
            linkConcurPO(selectedPO.id, concurPoNum);
            setIsConcurModalOpen(false);
            setSelectedPO(null);
        }
    };

    if (isLoadingData) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto px-0 sm:px-2 md:px-4 pb-24 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                        <Activity className="text-[var(--color-brand)]" />
                        Active Requests
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">Monitor active Purchase Orders and manage SAP Concur links.</p>
                </div>
                
                <div className="w-full md:w-auto overflow-x-auto pb-1">
                    <div className="inline-flex min-w-max items-center gap-1 bg-white dark:bg-[#1e2029] p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <button 
                            type="button"
                            onClick={() => setFilterMode('PENDING')}
                            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${filterMode === 'PENDING' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            <LinkIcon size={14} /> Pending Entry
                        </button>
                        <button 
                             type="button"
                             onClick={() => setFilterMode('ACTIVE')}
                             className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${filterMode === 'ACTIVE' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            <CheckCircle size={14} /> Active Linked
                        </button>
                        <button 
                             type="button"
                             onClick={() => setFilterMode('ALL')}
                             className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${filterMode === 'ALL' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-sm' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            <List size={14} /> View All
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="relative md:col-span-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search PO #, Site, Supplier, or Requester..." 
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2029] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
             <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-[#15171e] text-left">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">PO Number</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Site</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Requester</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredPOs.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-gray-500 italic">
                                    No purchase orders found requiring Concur entry.
                                </td>
                            </tr>
                        ) : (
                            filteredPOs.map((po) => {
                                 // Check if any line has Concur #
                                const concurPoNum = po.lines.find(l => !!l.concurPoNumber)?.concurPoNumber;
                                
                                return (
                                <tr 
                                    key={po.id} 
                                    onClick={() => navigate(`/requests/${po.id}`)}
                                    className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="font-bold text-gray-900 dark:text-white group-hover:text-[var(--color-brand)] transition-colors">
                                                {po.displayId || po.id}
                                            </div>
                                            {concurPoNum && (
                                                <div className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">
                                                    {concurPoNum}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                        {new Date(po.requestDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                            <MapPin size={12} className="mr-1.5 text-gray-400" />
                                            {po.site || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{po.supplierName}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                        {po.requesterName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">
                                        ${po.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                                            ${po.status === 'APPROVED_PENDING_CONCUR' 
                                                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/30' 
                                                : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900/30'
                                            }`}>
                                            {po.status === 'APPROVED_PENDING_CONCUR' ? 'Pending Entry' : 'Active (Linked)'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                        {po.status === 'APPROVED_PENDING_CONCUR' ? (
                                             <button 
                                                onClick={() => handleOpenConcurModal(po)}
                                                className="px-3 py-1.5 bg-[var(--color-brand)] text-white text-xs font-bold rounded-lg hover:bg-opacity-90 transition-all shadow-sm flex items-center gap-1 ml-auto"
                                            >
                                                <LinkIcon size={14} /> Link ID
                                            </button>
                                        ) : (
                                            <button 
                                                className="px-3 py-1.5 text-gray-400 text-xs font-bold rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-700 flex items-center gap-1 ml-auto"
                                                title="Already Linked"
                                            >
                                                <CheckCircle size={14} /> Done
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )})
                        )}
                    </tbody>
                </table>
                </div>

                <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredPOs.length === 0 ? (
                        <div className="px-4 py-12 text-center text-sm text-gray-500">
                            No purchase orders found requiring Concur entry.
                        </div>
                    ) : (
                        filteredPOs.map((po) => {
                            const concurPoNum = po.lines.find(l => !!l.concurPoNumber)?.concurPoNumber;
                            const isPendingEntry = po.status === 'APPROVED_PENDING_CONCUR';

                            return (
                                <article
                                    key={po.id}
                                    onClick={() => navigate(`/requests/${po.id}`)}
                                    className="p-4 space-y-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    <div className="space-y-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                {po.displayId || po.id}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">{po.supplierName}</p>
                                        </div>
                                        <span
                                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                                isPendingEntry
                                                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/30'
                                                    : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/30'
                                            }`}
                                        >
                                            {isPendingEntry ? 'Pending Entry' : 'Active Linked'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                                        <div className="space-y-1">
                                            <p className="uppercase tracking-wide text-[10px] font-bold text-gray-400">Date</p>
                                            <p className="text-gray-700 dark:text-gray-300">
                                                {new Date(po.requestDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="uppercase tracking-wide text-[10px] font-bold text-gray-400">Site</p>
                                            <p className="text-gray-700 dark:text-gray-300 inline-flex items-center gap-1 min-w-0">
                                                <MapPin size={11} />
                                                <span className="truncate">{po.site || 'Unknown'}</span>
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="uppercase tracking-wide text-[10px] font-bold text-gray-400">Requester</p>
                                            <p className="text-gray-700 dark:text-gray-300 truncate">{po.requesterName}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="uppercase tracking-wide text-[10px] font-bold text-gray-400">Amount</p>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                ${po.totalAmount.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-1 space-y-2">
                                        <div className="min-w-0">
                                            {concurPoNum ? (
                                                <span className="inline-flex max-w-full truncate bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded text-[10px] font-mono">
                                                    {concurPoNum}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-gray-400">No Concur reference</span>
                                            )}
                                        </div>
                                        {isPendingEntry ? (
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleOpenConcurModal(po);
                                                }}
                                                className="w-full px-3 py-1.5 bg-[var(--color-brand)] text-white text-xs font-bold rounded-lg hover:bg-opacity-90 transition-all shadow-sm flex items-center justify-center gap-1"
                                            >
                                                <LinkIcon size={13} />
                                                Link ID
                                            </button>
                                        ) : (
                                            <span className="text-[11px] font-semibold text-gray-500">Open details</span>
                                        )}
                                    </div>
                                </article>
                            );
                        })
                    )}
                </div>
             </div>

             {/* Modal */}
             {isConcurModalOpen && selectedPO && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsConcurModalOpen(false)}>
                    {/* Render standard component manually wrapping logic or creating a prop-friendly version. 
                        Since ConcurExportModal handles everything internally for 'po' prop but triggers 'linkConcurPO' from context itself, 
                        we can just render it. But wait, ConcurExportModal in PODetail handles close/submit.
                        
                        Let's check ConcurExportModal's expected props.
                        It expects: onClose, po (optional?), confirm?
                        Usually these modals are built to be somewhat standalone or controlled.
                        
                        Let's look at ConcurExportModal.tsx briefly in my mind or assumption.
                        Actually, I'll assume I can just use a simple inline modal here or reuse if it's generic.
                        
                        But for speed and consistency, I'll use a simple input modal here or refactor ConcurExportModal to be usable here.
                        Actually, let's just create a simpler inline modal right here for entering the ID, same as PODetail does.
                    */}
                     <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Link Concur PO</h2>
                         <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Enter the SAP Concur PO Number for <b>{selectedPO.displayId || selectedPO.id}</b>.
                        </p>
                        
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const val = (e.currentTarget.elements.namedItem('concurId') as HTMLInputElement).value;
                            if(val) handleConcurSubmit(val);
                        }}>
                            <input 
                                name="concurId"
                                autoFocus
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white mb-4 outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                                placeholder="e.g. 30001234"
                            />
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsConcurModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:bg-opacity-90">Link PO</button>
                            </div>
                        </form>
                     </div>
                </div>
             )}
        </div>
    );
};

export default ActiveRequestsView;
