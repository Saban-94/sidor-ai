import React from 'react';
import { useSync } from '../providers/SyncProvider';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export const SyncStatus: React.FC = () => {
  const { status, lastSync } = useSync();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/50 backdrop-blur-sm rounded-full border border-sky-100 shadow-sm">
      {status === 'connected' && (
        <Cloud size={14} className="text-emerald-500 animate-pulse" />
      )}
      {status === 'disconnected' && (
        <CloudOff size={14} className="text-red-500" />
      )}
      {status === 'syncing' && (
        <RefreshCw size={14} className="text-sky-500 animate-spin" />
      )}
      
      <div className="flex flex-col">
        <span className="text-[9px] font-black uppercase tracking-tighter text-gray-400">System Link</span>
        <span className={`text-[10px] font-bold ${status === 'disconnected' ? 'text-red-500' : 'text-gray-900'}`}>
          {status === 'connected' ? 'סינכרון פעיל' : status === 'syncing' ? 'מעדכן גליונות...' : 'מנותק'}
        </span>
      </div>

      {lastSync && (
        <div className="h-4 w-px bg-gray-200 mx-1" />
      )}
      
      {lastSync && (
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-tighter text-gray-400">Last Sync</span>
          <span className="text-[10px] font-bold text-gray-600">
            {format(lastSync, 'HH:mm:ss')}
          </span>
        </div>
      )}
    </div>
  );
};
