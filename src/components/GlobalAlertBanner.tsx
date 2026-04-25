import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Clock, CheckCircle, Volume2, X } from 'lucide-react';
import { Reminder } from '../types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface GlobalAlertBannerProps {
  reminder: Reminder | null;
  onAction: (id: string) => void;
  onSnooze: (id: string) => void;
  onDismiss: () => void;
}

export const GlobalAlertBanner: React.FC<GlobalAlertBannerProps> = ({ 
  reminder, 
  onAction, 
  onSnooze, 
  onDismiss 
}) => {
  if (!reminder) return null;

  const isCritical = reminder.priority === 'critical';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[1000] p-4 flex justify-center pointer-events-none"
      >
        <div className="w-full max-w-2xl bg-sky-600/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4 pointer-events-auto flex items-center justify-between gap-6" dir="rtl">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-white/20 text-white ${isCritical ? 'animate-pulse' : ''}`}>
              <Bell size={24} className={isCritical ? 'text-white' : ''} />
            </div>
            
            <div className="flex flex-col">
              <motion.h4 
                animate={{ opacity: [1, 0.8, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-white font-black text-lg leading-tight drop-shadow-sm"
              >
                תזכורת: {reminder.title}
              </motion.h4>
              <div className="flex items-center gap-2 mt-1">
                <Clock size={14} className="text-sky-100" />
                <span className="text-white/80 text-xs font-bold">
                  {reminder.reminderTime ? formatDistanceToNow(parseISO(reminder.reminderTime), { addSuffix: true, locale: he }) : 'עכשיו'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => onAction(reminder.id!)}
              className="bg-white text-sky-700 px-5 py-2.5 rounded-xl font-black text-sm hover:bg-sky-50 transition-all shadow-lg shadow-white/10 flex items-center gap-2"
            >
              <CheckCircle size={18} />
              בצע פעולה
            </button>
            <button 
              onClick={() => onSnooze(reminder.id!)}
              className="bg-sky-500/50 hover:bg-sky-500/70 text-white px-5 py-2.5 rounded-xl font-black text-sm border border-white/10 transition-all flex items-center gap-2"
            >
              <Clock size={18} />
              נודניק
            </button>
            <button 
              onClick={onDismiss}
              className="p-2.5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Critical Glowing Background */}
          {isCritical && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 bg-red-500/20 rounded-2xl pointer-events-none"
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
