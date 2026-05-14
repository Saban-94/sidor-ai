import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  Calendar as CalendarIcon,
  Filter
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth,
  addMonths,
  subMonths
} from 'date-fns';
import { he } from 'date-fns/locale';
import { Order } from '../types';

interface SmartCalendarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  calendarMonth: Date;
  onMonthChange: (date: Date) => void;
  isRangeMode: boolean;
  onToggleRangeMode: (val: boolean) => void;
  startDate: Date;
  endDate: Date;
  onRangeSelect: (start: Date, end: Date) => void;
}

export const SmartCalendarDrawer = ({
  isOpen,
  onClose,
  orders,
  selectedDate,
  onDateSelect,
  calendarMonth,
  onMonthChange,
  isRangeMode,
  onToggleRangeMode,
  startDate,
  endDate,
  onRangeSelect
}: SmartCalendarDrawerProps) => {
  
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDateRange = startOfWeek(monthStart);
  const endDateRange = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({
    start: startDateRange,
    end: endDateRange,
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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[160] flex flex-col overflow-hidden border-l border-slate-200"
            dir="rtl"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center text-gold shadow-lg shadow-navy/20">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">יומן משלוחים</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bridging Space & Time</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-900 group"
              >
                <X size={20} className="group-active:scale-90 transition-transform" />
              </button>
            </div>

            {/* Calendar Control */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-8 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <button 
                  onClick={() => onMonthChange(subMonths(calendarMonth, 1))}
                  className="p-2 hover:bg-white rounded-xl transition-all text-navy"
                >
                  <ChevronRight size={20} strokeWidth={3} />
                </button>
                <h3 className="text-lg font-black text-navy uppercase tracking-tighter">
                  {format(calendarMonth, 'MMMM yyyy', { locale: he })}
                </h3>
                <button 
                  onClick={() => onMonthChange(addMonths(calendarMonth, 1))}
                  className="p-2 hover:bg-white rounded-xl transition-all text-navy"
                >
                  <ChevronLeft size={20} strokeWidth={3} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-6 px-1">
                <button 
                  onClick={() => onToggleRangeMode(false)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all border ${!isRangeMode ? 'bg-navy text-white shadow-lg border-navy' : 'bg-white text-slate-400 border-slate-200'}`}
                >
                  יום בודד
                </button>
                <button 
                  onClick={() => onToggleRangeMode(true)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all border ${isRangeMode ? 'bg-navy text-white shadow-lg border-navy' : 'bg-white text-slate-400 border-slate-200'}`}
                >
                  בחירת טווח
                </button>
              </div>

              {/* Grid Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => (
                  <div key={day} className="text-center text-[10px] font-black text-slate-300 uppercase py-2">{day}</div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((day) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayOrders = orders.filter(o => o.date === dayStr);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isTodayActive = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, startDate);
                  const isEndSelected = isRangeMode && isSameDay(day, endDate);
                  const isInRange = isRangeMode && day >= startDate && day <= endDate;

                  return (
                    <button 
                      key={day.toString()}
                      onClick={() => {
                        if (isRangeMode) {
                          if (isSameDay(startDate, endDate) && day > startDate) {
                            onRangeSelect(startDate, day);
                          } else {
                            onRangeSelect(day, day);
                          }
                        } else {
                          onDateSelect(day);
                          onClose();
                        }
                      }}
                      className={`
                        aspect-square p-1 rounded-xl border transition-all flex flex-col items-center justify-center relative group
                        ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : 
                          isSelected || isEndSelected ? 'bg-navy border-navy text-white shadow-xl scale-105 z-10' : 
                          isInRange ? 'bg-navy/10 border-navy/20 text-navy' :
                          'bg-white border-slate-100 hover:border-gold hover:shadow-md'}
                      `}
                    >
                      <span className={`text-xs font-black ${isTodayActive && !isSelected ? 'text-gold underline decoration-2 underline-offset-4' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      
                      {dayOrders.length > 0 && isCurrentMonth && (
                        <div className="flex gap-0.5 mt-1">
                          {dayOrders.slice(0, 3).map((_, i) => (
                            <div 
                              key={i} 
                              className={`w-1 h-1 rounded-full ${isSelected || isEndSelected ? 'bg-gold' : 'bg-gold animate-pulse'}`} 
                              style={{ animationDelay: `${i * 0.2}s` }}
                            />
                          ))}
                          {dayOrders.length > 3 && (
                            <div className={`w-1 h-1 rounded-full ${isSelected || isEndSelected ? 'bg-white/40' : 'bg-slate-300'}`} />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Context Info */}
            <div className="mt-auto p-6 bg-slate-900 border-t border-slate-800">
               <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>סטטוס סידור</span>
                    <span className="text-gold">Saban Intelligence</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white/70">הזמנות למחר:</span>
                      <span className="text-xs font-black text-white">{orders.filter(o => isSameDay(new Date(o.date), addMonths(new Date(), 0))).length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white/70">צפי עומס:</span>
                      <span className="text-xs font-black text-gold">בינוני</span>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
