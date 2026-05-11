import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar,
  Plus,
  Search,
  Filter,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Trash2,
  TrendingUp,
  FileText,
  ChevronRight,
  ArrowUpRight,
  Loader2,
  RefreshCcw,
  Ban
} from 'lucide-react';
import {
  getPricingSchedules,
  approvePricingSchedule,
  executePricingSchedule,
  deletePricingSchedule
} from '../services/pricingScheduleService';
import { PricingSchedule } from '../types';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from './ToastNotification';
import { ConfirmDialog } from './ConfirmDialog';
import PageHeader from './PageHeader';

const PricingSchedulesList = () => {
  const { hasPermission, currentUser } = useApp();
  const navigate = useNavigate();
  const { toasts, dismissToast, success, error } = useToast();
  const [schedules, setSchedules] = useState<PricingSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmLabel: 'Confirm', variant: 'warning', onConfirm: () => {} });

  const canManage = hasPermission('manage_pricing_schedules');

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const data = await getPricingSchedules();
      setSchedules(data);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const runApprove = async (id: string) => {
    setIsActionLoading(id);
    try {
      await approvePricingSchedule(id);
      await fetchSchedules();
      success('Pricing schedule approved.');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setIsActionLoading(null);
    }
  };

  const runExecute = async (id: string) => {
    setIsActionLoading(id);
    try {
      await executePricingSchedule(id);
      await fetchSchedules();
      success('Pricing schedule executed. New price versions have been created.');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsActionLoading(null);
    }
  };

  const runDelete = async (id: string) => {
    setIsActionLoading(id);
    try {
      await deletePricingSchedule(id);
      await fetchSchedules();
      success('Schedule deleted.');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleApprove = (id: string) => setConfirmDialog({
    isOpen: true,
    title: 'Approve Pricing Schedule',
    message: 'Are you sure you want to approve this pricing schedule? Once approved it can be executed to create new price versions.',
    confirmLabel: 'Approve',
    variant: 'warning',
    onConfirm: () => { setConfirmDialog(d => ({ ...d, isOpen: false })); runApprove(id); }
  });

  const handleExecute = (id: string) => setConfirmDialog({
    isOpen: true,
    title: 'Execute Pricing Schedule',
    message: 'This will create new price versions for all scoped items immediately. This action cannot be undone.',
    confirmLabel: 'Execute Now',
    variant: 'danger',
    onConfirm: () => { setConfirmDialog(d => ({ ...d, isOpen: false })); runExecute(id); }
  });

  const handleDelete = (id: string) => setConfirmDialog({
    isOpen: true,
    title: 'Delete Draft Schedule',
    message: 'This draft schedule will be permanently deleted. Are you sure?',
    confirmLabel: 'Delete',
    variant: 'danger',
    onConfirm: () => { setConfirmDialog(d => ({ ...d, isOpen: false })); runDelete(id); }
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10';
      case 'PENDING_APPROVAL':
        return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-900/20';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/20';
      case 'EXECUTING':
        return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-900/20';
      case 'COMPLETED':
        return 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/10 dark:text-indigo-400 dark:border-indigo-900/20';
      case 'FAILED':
        return 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/20';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = s.schedule_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (s.basis_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 text-center">
        <Ban size={48} className="mb-4 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-gray-500 mt-2">You do not have permission to manage pricing schedules.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-page-entry pb-20">
      <PageHeader
        title="Pricing Schedules"
        subtitle="Manage CPI and bulk price uplifts across the product catalog."
      />
      {/* Header Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate('/pricing/schedules/new')}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--color-brand)] text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[var(--color-brand)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={18} />
          Create New Schedule
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-nocturne p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/10 flex items-center justify-center text-amber-600">
              <Clock size={20} />
            </div>
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {schedules.filter(s => s.status === 'PENDING_APPROVAL').length}
            </span>
          </div>
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Awaiting Approval</h3>
        </div>
        <div className="bg-white dark:bg-nocturne p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {schedules.filter(s => s.status === 'APPROVED').length}
            </span>
          </div>
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ready to Execute</h3>
        </div>
        <div className="bg-white dark:bg-nocturne p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center text-indigo-600">
              <Calendar size={20} />
            </div>
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {schedules.filter(s => new Date(s.new_effective_from) > new Date()).length}
            </span>
          </div>
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Future Scheduled</h3>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Search schedules by name or reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-gray-400 hidden md:block" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 md:w-48 py-3 px-4 bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="EXECUTING">Executing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <button 
          onClick={fetchSchedules}
          className="p-3 text-gray-400 hover:text-[var(--color-brand)] transition-colors"
        >
          <RefreshCcw size={20} />
        </button>
      </div>

      {/* List Area */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-50 dark:bg-white/5 rounded-3xl animate-pulse border border-gray-100 dark:border-gray-800" />
          ))
        ) : filteredSchedules.length > 0 ? (
          filteredSchedules.map((schedule) => (
            <div 
              key={schedule.id}
              className="bg-white dark:bg-nocturne border border-gray-100 dark:border-gray-800 rounded-3xl p-6 hover:shadow-xl hover:border-[var(--color-brand)]/20 transition-all group"
            >
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getStatusStyle(schedule.status)}`}>
                      {schedule.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <TrendingUp size={12} />
                      {schedule.basis}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-[var(--color-brand)] transition-colors">
                    {schedule.schedule_name}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>Effective: {new Date(schedule.new_effective_from).toLocaleDateString()}</span>
                    </div>
                    {schedule.basis_reference && (
                      <div className="flex items-center gap-1.5">
                        <FileText size={14} />
                        <span>Ref: {schedule.basis_reference}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} />
                      <span>Created: {new Date(schedule.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  {isActionLoading === schedule.id ? (
                    <div className="flex items-center gap-2 px-4 text-gray-400 italic text-xs">
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <>
                      {schedule.status === 'DRAFT' && (
                        <button 
                          onClick={() => handleDelete(schedule.id)}
                          className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
                          title="Delete Draft"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                      
                      {schedule.status === 'PENDING_APPROVAL' && (
                        <button 
                          onClick={() => handleApprove(schedule.id)}
                          className="px-6 py-2.5 bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2"
                        >
                          <CheckCircle2 size={16} /> Approve Schedule
                        </button>
                      )}

                      {schedule.status === 'APPROVED' && (
                        <button 
                          onClick={() => handleExecute(schedule.id)}
                          className="px-6 py-2.5 bg-[var(--color-brand)] text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--color-brand)]/20 hover:bg-[var(--color-brand-dark)] transition-all flex items-center gap-2"
                        >
                          <Play size={16} /> Execute Now
                        </button>
                      )}

                      <button 
                        onClick={() => navigate(`/pricing/schedules/new?id=${schedule.id}`)}
                        className="p-3 text-gray-400 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 rounded-2xl transition-all"
                        title="View / Edit"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Ban size={48} className="text-gray-200 dark:text-gray-700 mb-4" />
            <p className="text-gray-500 font-medium">No pricing schedules found.</p>
            <p className="text-gray-400 text-sm mt-1">Create a new schedule to get started.</p>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        variant={confirmDialog.variant}
      />
    </div>
  );
};

export default PricingSchedulesList;
