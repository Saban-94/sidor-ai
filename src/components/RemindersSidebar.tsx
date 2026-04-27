import React, { useState, useEffect } from 'react';
import { 
  X, 
  ListTodo, 
  CheckCircle, 
  Clock, 
  Trash2, 
  Sparkles, 
  AlertTriangle, 
  BellRing,
  Volume2,
  VolumeX,
  History,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Reminder } from '../types';
import { format, differenceInMinutes, parseISO, addMinutes } from 'date-fns';

interface RemindersSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: Reminder[];
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onSnooze: (id: string) => void;
}

export const RemindersSidebar: React.FC<RemindersSidebarProps> = ({ 
  isOpen, 
  onClose, 
  reminders,
  onToggleComplete,
  onDelete,
  onSnooze
}) => {
  const [now, setNow] = useState(new Date());
  const [mutedReminders, setMutedReminders] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getCountdown = (dueDate: string, dueTime: string) => {
    try {
      const scheduledTime = parseISO(`${dueDate}T${dueTime}`);
      const diff = differenceInMinutes(scheduledTime, now);
      
      if (diff < 0) return 'חלף זמן';
      if (diff === 0) return 'עכשיו!';
      if (diff < 60) return `${diff} דקות`;
      
      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;
      return `${hours}ש ${minutes}ד`;
    } catch (e) {
      return '--:--';
    }
  };

  const isDue = (dueDate: string, dueTime: string) => {
    try {
      const scheduledTime = parseISO(`${dueDate}T${dueTime}`);
      return differenceInMinutes(now, scheduledTime) >= 0;
    } catch (e) {
      return false;
    }
  };

  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && b.isCompleted) return -1;
    const timeA = parseISO(`${a.dueDate}T${a.dueTime}`).getTime();
    const timeB = parseISO(`${b.dueDate}T${b.dueTime}`).getTime();
    return timeA - timeB;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-[80]"
          />
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 w-full sm:w-[400px] bg-white/90 backdrop-blur-2xl shadow-2xl z-[90] flex flex-col overflow-hidden"
            dir="rtl"
          >
            {/* Header */}
            <div className="p-8 pb-6 bg-gradient-to-br from-sky-600/10 to-transparent border-b border-sky-100/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="bg-sky-600 p-3 rounded-2xl text-white shadow-xl shadow-sky-600/20">
                    <ListTodo size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tighter text-gray-900 mb-0.5">SabanOS Task</h2>
                    <p className="text-[10px] font-black text-sky-600 tracking-widest uppercase">מערכת תזכורות חכמה</p>
                  </div>
                </div>
                <button 
                  onClick={onClose} 
                  className="p-3 hover:bg-gray-100 rounded-2xl transition-all border border-transparent hover:border-gray-200"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {sortedReminders.length === 0 ? (
                <div className="text-center py-24 px-8">
                  <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Sparkles size={40} className="text-sky-200" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">הכל שקט כאן</h3>
                  <p className="text-sm text-gray-400 font-medium leading-relaxed">אין תזכורות ממתינות. זה הזמן לתכנן קדימה או לקחת הפסקה!</p>
                </div>
              ) : (
                sortedReminders.map((reminder) => {
                  const itemsDue = isDue(reminder.dueDate, reminder.dueTime);
                  const isUrgent = reminder.priority === 'urgent' && !reminder.isCompleted;
                  
                  return (
                    <motion.div 
                      key={reminder.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1,
                        x: isUrgent && itemsDue ? [0, -2, 2, -2, 2, 0] : 0 
                      }}
                      transition={isUrgent && itemsDue ? { repeat: Infinity, duration: 0.5 } : {}}
                      className={`relative group p-5 rounded-[2rem] border-2 transition-all overflow-hidden ${
                        reminder.isCompleted 
                          ? 'bg-gray-50 border-transparent opacity-60' 
                          : isUrgent && itemsDue
                            ? 'bg-red-50 border-red-200 shadow-xl shadow-red-500/10'
                            : reminder.isNagging && itemsDue
                              ? 'bg-amber-50 border-amber-200 shadow-lg shadow-amber-500/5'
                              : 'bg-white border-sky-50 shadow-sm hover:shadow-md hover:border-sky-100'
                      }`}
                    >
                      {/* Priority Indicator */}
                      {!reminder.isCompleted && (
                        <div className={`absolute top-0 right-0 w-12 h-1 ${
                          reminder.priority === 'urgent' ? 'bg-red-500' : reminder.priority === 'high' ? 'bg-amber-500' : 'bg-sky-400'
                        }`} />
                      )}

                      <div className="flex items-start gap-4">
                        <button 
                          onClick={() => onToggleComplete(reminder.id!, !reminder.isCompleted)}
                          className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                            reminder.isCompleted 
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                              : 'bg-gray-100 text-gray-400 hover:bg-sky-600 hover:text-white hover:shadow-lg'
                          }`}
                        >
                          <Check size={20} strokeWidth={3} />
                        </button>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-sm font-black tracking-tight ${reminder.isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {reminder.title}
                            </h4>
                            {!reminder.isCompleted && reminder.isNagging && (
                              <BellRing size={14} className={itemsDue ? "text-red-500 animate-bounce" : "text-gray-300"} />
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Clock size={12} className={itemsDue && !reminder.isCompleted ? "text-red-500" : "text-sky-400"} />
                              <span className={`text-[10px] font-black uppercase ${itemsDue && !reminder.isCompleted ? "text-red-600" : "text-gray-400"}`}>
                                {reminder.dueTime}
                              </span>
                            </div>
                            <span className="text-gray-200">|</span>
                            <div className="flex items-center gap-1">
                              <History size={12} className="text-sky-400" />
                              <span className="text-[10px] font-black text-gray-400 uppercase">
                                {getCountdown(reminder.dueDate, reminder.dueTime)}
                              </span>
                            </div>
                          </div>

                          {reminder.description && (
                            <p className="text-[11px] font-medium text-gray-500 leading-relaxed pt-1">{reminder.description}</p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {!reminder.isCompleted && (
                            <button 
                              onClick={() => {
                                onSnooze(reminder.id!);
                              }}
                              className="p-2 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                              title="נודניק (10 דקות)"
                            >
                              <Clock size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              if (window.confirm('למחוק את התזכורת?')) onDelete(reminder.id!);
                            }}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="מחק"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Action Bar for Active/Due Reminders */}
                      {!reminder.isCompleted && itemsDue && (
                        <div className="mt-4 pt-4 border-t border-red-100/50 flex gap-2">
                          <button 
                            onClick={() => onToggleComplete(reminder.id!, true)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-[10px] font-black shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={14} /> סמן כבוצע
                          </button>
                          <button 
                            onClick={() => onSnooze(reminder.id!)}
                            className="flex-1 bg-white border border-gray-200 text-gray-600 py-2 rounded-xl text-[10px] font-black hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                          >
                            <Clock size={14} /> נודניק (10 דק')
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
            
            {/* Footer */}
            <div className="p-6 bg-gray-50/50 border-t border-gray-100">
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <AlertTriangle size={14} />
                <p className="text-[10px] font-black uppercase tracking-widest">מערכת התראות בזמן אמת של SabanOS</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
