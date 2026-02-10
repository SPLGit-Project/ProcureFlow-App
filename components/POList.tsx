
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { Search, Eye, Filter, Calendar, MapPin, DollarSign, User } from 'lucide-react';
import ContextHelp from './ContextHelp';

const POList = ({ filter = 'ALL' }: { filter?: 'ALL' | 'PENDING' | 'COMPLETED' }) => {
  const { pos, currentUser, hasPermission } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  let filteredPos = pos;
  if (filter === 'PENDING') {
      filteredPos = filteredPos.filter(p => p.status === 'PENDING_APPROVAL');
  } else if (filter === 'COMPLETED') {
      filteredPos = filteredPos.filter(p => p.status === 'RECEIVED' || p.status === 'CLOSED');
  }
  // All users see every PO for their assigned sites (site filtering handled by AppContext)

  filteredPos = filteredPos.filter(p => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
          p.supplierName.toLowerCase().includes(term) || 
          (p.displayId || p.id).toLowerCase().includes(term) ||
          (p.site || '').toLowerCase().includes(term) ||
          p.requesterName.toLowerCase().includes(term) ||
          p.lines.some(l => l.concurPoNumber?.toLowerCase().includes(term))
      );
  });

  const StatusBadge = ({ status }: { status: string }) => {
      let colorClass = 'bg-gray-100 dark:bg-gray-700/30 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
      if (status === 'ACTIVE' || status === 'RECEIVED') colorClass = 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-500 border-green-200 dark:border-green-500/20';
      else if (status === 'PENDING_APPROVAL') colorClass = 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-500/20';
      else if (status === 'APPROVED_PENDING_CONCUR') colorClass = 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-500 border-blue-200 dark:border-blue-500/20';
      else if (status === 'REJECTED') colorClass = 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-500 border-red-200 dark:border-red-500/20';

      return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass} whitespace-nowrap`}>
            {status === 'APPROVED_PENDING_CONCUR' ? 'Pending Concur' : status.replace(/_/g, ' ')}
        </span>
      );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                {filter === 'PENDING' ? 'Pending Approvals' : filter === 'COMPLETED' ? 'Completed Requests' : 'Requests'}
                <ContextHelp 
                    title="Approval Process" 
                    description="Understand the phases of approval and how to manage requests." 
                    linkTarget="approval-workflow"
                />
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage purchase orders and approvals</p>
          </div>
          {filter === 'ALL' && hasPermission('create_request') && (
              <Link to="/create" className="w-full md:w-auto bg-[var(--color-brand)] text-white px-5 py-3 rounded-xl hover:opacity-90 font-semibold shadow-lg shadow-[var(--color-brand)]/20 transition-all text-center">
                  + New Request
              </Link>
          )}
      </div>

      <div className="bg-surface rounded-2xl elevation-1 border border-default overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                 <input 
                    type="text" 
                    placeholder="Search by ID, Site, Supplier, Requester, or Concur Ref..." 
                    className="pl-10 pr-4 py-2.5 w-full bg-gray-50 dark:bg-[#15171e] border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] placeholder-gray-500 dark:placeholder-gray-600 transition-colors"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                 />
              </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                <thead className="bg-gray-50 dark:bg-[#15171e] text-xs uppercase text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                    <tr>
                        <th className="px-6 py-4">Request ID</th>
                        <th className="px-6 py-4">Ref</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Site</th>
                        <th className="px-6 py-4">Supplier</th>
                        {filter === 'PENDING' && <th className="px-6 py-4">Requester</th>}
                        <th className="px-6 py-4 text-right">Amount</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {filteredPos.map(po => (
                        <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-[#2b2d3b] transition-colors group">
                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white group-hover:text-[var(--color-brand)] transition-colors">{po.displayId || po.id}</td>
                            <td className="px-6 py-4 font-mono text-xs">
                                {po.lines[0]?.concurPoNumber ? (
                                    <span className="bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold">{po.lines[0]?.concurPoNumber}</span>
                                ) : <span className="text-gray-300 dark:text-gray-700">-</span>}
                            </td>
                            <td className="px-6 py-4">{new Date(po.requestDate).toLocaleDateString()}</td>
                            <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                    <MapPin size={11} className="text-gray-400" />
                                    {po.site || 'Unknown'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">{po.supplierName}</td>
                            {filter === 'PENDING' && <td className="px-6 py-4 flex items-center gap-2">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${po.requesterName}`} className="w-6 h-6 rounded-full bg-gray-100"/>
                                <span className="truncate max-w-[100px]">{po.requesterName}</span>
                            </td>}
                            <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">${po.totalAmount.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                                <StatusBadge status={po.status} />
                            </td>
                            <td className="px-6 py-4 text-center">
                                <Link to={`/requests/${po.id}`} className="text-gray-400 hover:text-[var(--color-brand)] p-2 rounded-lg inline-block transition-colors">
                                    <Eye size={18} />
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {filteredPos.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-12 text-gray-500 dark:text-gray-600">No requests found matching your filters.</td></tr>
                    )}
                </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
             {filteredPos.map(po => (
                <Link key={po.id} to={`/requests/${po.id}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                   <div className="flex justify-between items-start mb-3">
                       <div>
                           <div className="font-bold text-gray-900 dark:text-white mb-0.5">{po.supplierName}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span className="font-mono">{po.displayId || po.id}</span>
                                <span>•</span>
                                <span>{new Date(po.requestDate).toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1"><MapPin size={10} />{po.site || 'Unknown'}</span>
                            </div>
                       </div>
                       <StatusBadge status={po.status} />
                   </div>
                   
                   <div className="flex items-center justify-between text-sm">
                       <div className="text-gray-500 flex items-center gap-1">
                           {po.lines[0]?.concurPoNumber && (
                               <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-xs font-mono border border-indigo-200 dark:border-indigo-500/20">
                                   {po.lines[0]?.concurPoNumber}
                               </span>
                           )}
                       </div>
                       <div className="font-bold text-gray-900 dark:text-white text-base">
                           ${po.totalAmount.toLocaleString()}
                       </div>
                   </div>
                   
                   {filter === 'PENDING' && (
                       <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs text-gray-500">
                           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${po.requesterName}`} className="w-5 h-5 rounded-full bg-gray-100"/>
                           <span>Requested by {po.requesterName}</span>
                       </div>
                   )}
                </Link>
             ))}
             {filteredPos.length === 0 && (
                 <div className="text-center py-12 text-gray-500 dark:text-gray-600 px-4">
                     No requests found.
                 </div>
             )}
          </div>
      </div>
    </div>
  );
};

export default POList;
