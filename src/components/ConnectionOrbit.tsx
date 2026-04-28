import React from 'react';
import { motion } from 'motion/react';
import { Database, Cloud, Wifi, Activity } from 'lucide-react';
import { useSync } from '../providers/SyncManager';

export const ConnectionOrbit: React.FC = () => {
  const { status, pipelineHealth } = useSync();

  const getStatusColor = (isHealthy: boolean) => isHealthy ? 'text-emerald-500' : 'text-rose-500';
  const getGlowColor = (isHealthy: boolean) => isHealthy ? 'bg-emerald-500' : 'bg-rose-500';

  return (
    <div className="flex items-center gap-3 bg-gray-900/5 backdrop-blur-sm px-4 py-2 rounded-2xl border border-gray-100 shadow-inner">
      {/* Firebase Status */}
      <div className="flex items-center gap-2 relative group">
        <div className={`relative ${getStatusColor(pipelineHealth.firebase)}`}>
           <Database size={16} />
           {pipelineHealth.firebase && (
             <motion.div 
               animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
               transition={{ repeat: Infinity, duration: 2 }}
               className={`absolute inset-0 ${getGlowColor(true)} rounded-full blur-md -z-10`}
             />
           )}
        </div>
        <div className="hidden group-hover:block absolute top-full mt-2 right-0 bg-white shadow-xl border border-gray-100 rounded-xl p-2 text-[10px] font-bold z-50 whitespace-nowrap">
           Firestore Stream: {pipelineHealth.firebase ? 'מחובר ✅' : 'מנותק ❌'}
        </div>
      </div>

      <div className="w-px h-4 bg-gray-200" />

      {/* GAS Status */}
      <div className="flex items-center gap-2 relative group">
        <div className={`relative ${getStatusColor(pipelineHealth.gas)}`}>
           <Cloud size={16} />
           {status === 'syncing' && (
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
               className="absolute -top-1 -right-1 text-sky-500"
             >
               <Activity size={10} />
             </motion.div>
           )}
        </div>
        <div className="hidden group-hover:block absolute top-full mt-2 right-0 bg-white shadow-xl border border-gray-100 rounded-xl p-2 text-[10px] font-bold z-50 whitespace-nowrap">
           GAS Pipeline: {pipelineHealth.gas ? 'פעיל ✅' : 'שגיאה ❌'}
        </div>
      </div>

      <div className="w-px h-4 bg-gray-200" />

      {/* Global Wifi Indicator */}
      <div className="flex items-center gap-1.5">
        <Wifi size={14} className={status === 'error' ? 'text-rose-500' : 'text-sky-500'} />
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
          {status === 'connected' ? 'SabanOS Live' : status === 'syncing' ? 'Syncing...' : 'Link Error'}
        </span>
      </div>
    </div>
  );
};
