import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, CheckCircle2, XCircle, Send, Clock, 
  AlertCircle, ExternalLink, Loader2, Zap
} from 'lucide-react';
import { getPublicationStatus, retryFailedEvent } from '../services/publicationService';

interface PublicationStatusPanelProps {
  itemId: string;
}

export const PublicationStatusPanel: React.FC<PublicationStatusPanelProps> = ({ itemId }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const data = await getPublicationStatus(itemId);
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch publication status.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // Poll for updates every 10 seconds if there are pending events
    const interval = setInterval(() => {
      const hasPending = events.some(e => ['QUEUED', 'DISPATCHING', 'RETRYING'].includes(e.status));
      if (hasPending) fetchEvents();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [itemId, events.length]);

  const handleRetry = async (eventId: string) => {
    setIsRetrying(eventId);
    try {
      await retryFailedEvent(eventId);
      await fetchEvents();
    } catch (err: any) {
      setError(err.message || 'Failed to retry event.');
    } finally {
      setIsRetrying(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
      case 'DISPATCHING':
      case 'DISPATCHED': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400';
      case 'ACKNOWLEDGED': return 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400';
      case 'FAILED': return 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400';
      case 'RETRYING': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  if (isLoading && events.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4 bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800">
        <Loader2 className="animate-spin text-[#129DC0]" size={32} />
        <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Loading Publication Status...</p>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="bg-white dark:bg-nocturne rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden animate-page-entry">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#181a21]/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center text-purple-500">
            <Send size={16} />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">External System Synchronization</h2>
            <p className="text-[10px] text-gray-500">Status of automated data dispatch to downstream systems.</p>
          </div>
        </div>
        <button 
          onClick={fetchEvents}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50 dark:bg-[#181a21]/50">
            <tr>
              <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Target System</th>
              <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Event</th>
              <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Timestamps</th>
              <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">External Reference</th>
              <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="px-6 py-4">
                  <span className="text-sm font-black text-gray-900 dark:text-white">{event.target_system}</span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{event.event_type}</p>
                </td>
                <td className="px-6 py-4">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase ${getStatusStyle(event.status)}`}>
                    {event.status === 'ACKNOWLEDGED' && <CheckCircle2 size={10} />}
                    {event.status === 'FAILED' && <AlertCircle size={10} />}
                    {['QUEUED', 'DISPATCHING', 'RETRYING'].includes(event.status) && <Clock size={10} className="animate-pulse" />}
                    {event.status}
                  </div>
                  {event.error_message && (
                    <p className="text-[10px] text-red-500 mt-1 max-w-[200px] truncate" title={event.error_message}>
                      {event.error_message}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    {event.dispatched_at && (
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <Send size={10} />
                        <span>Sent: {new Date(event.dispatched_at).toLocaleTimeString()}</span>
                      </div>
                    )}
                    {event.acknowledged_at && (
                      <div className="flex items-center gap-1.5 text-[10px] text-green-500">
                        <CheckCircle2 size={10} />
                        <span>Ack: {new Date(event.acknowledged_at).toLocaleTimeString()}</span>
                      </div>
                    )}
                    {!event.dispatched_at && (
                      <span className="text-[10px] text-gray-400 italic">Pending dispatch...</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {event.external_item_id ? (
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#129DC0]">
                      <ExternalLink size={12} />
                      <span>{event.external_item_id}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">---</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {event.status === 'FAILED' && (
                    <button
                      onClick={() => handleRetry(event.id)}
                      disabled={!!isRetrying}
                      className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all shadow-md disabled:opacity-50"
                      title="Retry Publication"
                    >
                      {isRetrying === event.id ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border-t border-red-200 dark:border-red-800 flex items-center gap-3 text-red-600">
          <AlertCircle size={16} />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}
    </div>
  );
};
