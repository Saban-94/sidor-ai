import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  Calendar as CalendarIcon,
  User,
  Truck,
  Clock,
  Check,
  AlertTriangle,
  Database,
  CalendarDays
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { Order, Driver } from '../types';
import { useToast } from '../providers/ToastProvider';

interface CalendarViewProps {
  onClose?: () => void;
}

const HebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const HebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export const CalendarView: React.FC<CalendarViewProps> = ({ onClose }) => {
  const { addToast } = useToast();
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    // Start with current local date/month (May 2026 based on metadata)
    return new Date(2026, 5, 1); // 2026-05-31 is current local time
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states for Quick-Edit Drawer
  const [editDriverId, setEditDriverId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editStatus, setEditStatus] = useState<Order['status']>('pending');
  const [isSaving, setIsSaving] = useState(false);

  // Firestore Listeners
  useEffect(() => {
    setLoading(true);
    // Listen to all orders for rendering in monthly grid
    const ordersQuery = query(collection(db, 'orders'), orderBy('date', 'asc'), orderBy('time', 'asc'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // Listen to drivers for select options
    const driversQuery = query(collection(db, 'drivers'), orderBy('name', 'asc'));
    const unsubscribeDrivers = onSnapshot(driversQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Driver[];
      setDrivers(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'drivers');
    });

    return () => {
      unsubscribeOrders();
      unsubscribeDrivers();
    };
  }, []);

  // Update form fields when selected order changes
  useEffect(() => {
    if (selectedOrder) {
      setEditDriverId(selectedOrder.driverId || 'self');
      setEditDate(selectedOrder.date || '');
      setEditTime(selectedOrder.time || '');
      setEditStatus(selectedOrder.status || 'pending');
    }
  }, [selectedOrder]);

  // Navigate Months
  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleResetToCurrent = () => {
    setCurrentMonth(new Date(2026, 5, 1)); // Back to May/June 2026
  };

  // Generate Days Grid for standard Month View
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayInstance = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOfWeekDay = firstDayInstance.getDay(); // 0 = Sunday, 1 = Monday...

    const daysGrid: (Date | null)[] = [];

    // Pads for week days before first day of current month
    for (let i = 0; i < startOfWeekDay; i++) {
      daysGrid.push(null);
    }

    // Days of current month
    for (let day = 1; day <= totalDays; day++) {
      daysGrid.push(new Date(year, month, day));
    }

    return daysGrid;
  };

  // Check if a day is today
  const isTodayDate = (date: Date) => {
    const today = new Date(); // In production simulated as today, but let's check May 31 2026 explicitly
    return date.getDate() === 31 && date.getMonth() === 5 && date.getFullYear() === 2026;
  };

  // Format Helper: date object to YYYY-MM-DD
  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Get status text helper
  const getStatusTextHe = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'ממתין';
      case 'preparing': return 'בהכנה';
      case 'ready': return 'מוכן';
      case 'on_the_way': return 'בדרך';
      case 'delivered': return 'סופק';
      case 'cancelled': return 'בוטל';
      default: return 'ממתין';
    }
  };

  // Get Status Dot Color
  const getStatusColorClass = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-500';
      case 'preparing': return 'bg-sky-500';
      case 'ready': return 'bg-emerald-400';
      case 'on_the_way': return 'bg-indigo-500';
      case 'delivered': return 'bg-emerald-600';
      case 'cancelled': return 'bg-rose-500';
      default: return 'bg-slate-400';
    }
  };

  // Save changes handler to Firestore
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !selectedOrder.id) return;

    setIsSaving(true);
    const orderId = selectedOrder.id;
    const orderRef = doc(db, 'orders', orderId);

    // Schema Enforcement on Edit:
    // Saving any manual change MUST instantly reset original ETA field ("")
    // and automatically append/update the updatedAt timestamp using new Date().toISOString()
    const updates = {
      driverId: editDriverId,
      date: editDate,
      time: editTime,
      status: editStatus,
      eta: '', // Resets original ETA
      updatedAt: new Date().toISOString() // automatically append/update to ISO string
    };

    try {
      await updateDoc(orderRef, updates);
      addToast('הזמנה עודכנה', `השינויים נשמרו בהצלחה! הסטטוס עודכן ל-${getStatusTextHe(editStatus)} 💾`, 'success');
      setSelectedOrder(null); // Close Drawer
    } catch (error: any) {
      addToast('שגיאה בעדכון', 'ארעה שגיאה בעת שמירת השינויים.', 'warning');
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const daysGrid = getDaysInMonth();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111827] border border-slate-800 rounded-3xl p-4 overflow-hidden relative text-white" dir="rtl">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/20 flex items-center justify-center text-[#C5A059]">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight flex items-center gap-2">
              יומן משימות והפצה
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/20 animate-pulse">חי ✅</span>
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Saban Precision Operations Calendar</p>
          </div>
        </div>

        {/* MONTH CONTROLS */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleResetToCurrent}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-[11px] font-black tracking-tight rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            חזרה להיום
          </button>
          
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              title="חודש קודם"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
            <span className="px-3 text-xs font-black min-w-[100px] text-center text-white">
              {HebrewMonths[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              title="חודש הבא"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
          </div>

          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* CALENDAR WEEKDAY HEADERS */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {HebrewDays.map((day) => (
          <div key={day} className="text-center text-[10px] font-black text-slate-400 uppercase py-1 bg-slate-900/50 border border-slate-800/30 rounded-lg">
            {day}
          </div>
        ))}
      </div>

      {/* CALENDAR CELLS GRID */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-slate-800 border-t-[#C5A059] rounded-full animate-spin" />
          <span className="text-xs font-black text-slate-400 animate-pulse">סורק ומסנכרן הזמנות...</span>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-1.5 overflow-y-auto custom-scrollbar p-1">
          {daysGrid.map((day, idx) => {
            if (!day) {
              return (
                <div key={`empty-${idx}`} className="bg-slate-950/20 border border-slate-900/40 rounded-xl aspect-[1.1] opacity-25" />
              );
            }

            const dayStr = formatDateString(day);
            const dayOrders = orders.filter(o => o.date === dayStr);
            const isToday = isTodayDate(day);

            return (
              <div 
                key={dayStr}
                className={`flex flex-col rounded-xl border p-1 aspect-[1.1] min-h-[90px] transition-all bg-slate-950/40 relative group ${
                  isToday 
                    ? 'border-[#C5A562] bg-[#C5A562]/10 shadow-[inner_0_0_8px_rgba(197,160,89,0.25)]' 
                    : 'border-slate-800/50 hover:border-slate-700 hover:bg-slate-900/40'
                }`}
              >
                {/* DAY NUMBER */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-black leading-none ${isToday ? 'text-[#C5A562]' : 'text-slate-400'}`}>
                    {day.getDate()}
                  </span>
                  {dayOrders.length > 0 && (
                    <span className="text-[9px] font-bold bg-slate-800 px-1 rounded-full text-slate-400">
                      {dayOrders.length}
                    </span>
                  )}
                </div>

                {/* HIGH-DENSITY SUMMARY BADGES */}
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar scroll-dense" style={{ maxHeight: 'calc(100% - 14px)' }}>
                  {dayOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order);
                      }}
                      className="w-full text-right p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-[#C5A562] transition-all flex items-center justify-between gap-1 overflow-hidden group/badge active:scale-95"
                    >
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-[10px] font-black text-slate-100 truncate group-hover/badge:text-[#C5A562]">
                          {order.customerName}
                        </span>
                        <span className="text-[8px] text-slate-400 font-mono tracking-tighter">
                          #{order.orderNumber || order.id?.slice(-4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[8px] font-semibold text-slate-400">{order.time}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColorClass(order.status)}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK-EDIT SLIDE-OVER DRAWER */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="fixed inset-0 bg-black z-40"
            />
            
            {/* Slide-over Container */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col p-6 text-white overflow-y-auto"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="text-[#C5A562]" size={18} />
                  <h3 className="text-sm font-black text-white">עריכת פרטי סבב מהירה</h3>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Order Info Summary */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 mb-6 space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-bold">לקוח:</span>
                  <span className="text-[#C5A562] font-black">{selectedOrder.customerName}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-bold">מספר הזמנה:</span>
                  <span className="text-slate-100 font-mono tracking-widest">#{selectedOrder.orderNumber || selectedOrder.id?.slice(-6)}</span>
                </div>
                <div className="flex justify-between items-start text-[11px]">
                  <span className="text-slate-400 font-bold shrink-0">פריטים:</span>
                  <span className="text-slate-200 text-left line-clamp-2 max-w-[200px]">{selectedOrder.items}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-bold">יעד פריקה:</span>
                  <span className="text-slate-300 truncate max-w-[200px]">{selectedOrder.destination}</span>
                </div>
              </div>

              {/* EDIT FORM */}
              <form onSubmit={handleSaveChanges} className="flex-1 flex flex-col gap-5 justify-between">
                <div className="space-y-4">
                  {/* Select Driver */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wildest mb-1.5 flex items-center gap-1.5">
                      <Truck size={12} className="text-slate-400" />
                      שייך לנהג הפצה
                    </label>
                    <select
                      value={editDriverId}
                      onChange={(e) => setEditDriverId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#C5A562] outline-none transition-all cursor-pointer"
                    >
                      <option value="self">איסוף עצמי 👤</option>
                      {drivers.map(drv => (
                        <option key={drv.id} value={drv.id}>{drv.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date Input */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wildest mb-1.5 flex items-center gap-1.5">
                      <CalendarIcon size={12} className="text-slate-400" />
                      מועד אספקה מתוכנן
                    </label>
                    <input 
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#C5A562] outline-none transition-all"
                    />
                  </div>

                  {/* Time Input */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wildest mb-1.5 flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400" />
                      שעת הגעה משוערת ליציאה
                    </label>
                    <input 
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#C5A562] outline-none transition-all"
                    />
                  </div>

                  {/* Status Selection */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wildest mb-1.5 flex items-center gap-1.5">
                      <Check size={12} className="text-slate-400" />
                      מצב / סטטוס נוכחי
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as Order['status'])}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#C5A562] outline-none transition-all cursor-pointer"
                    >
                      <option value="pending">ממתין</option>
                      <option value="preparing">בהכנה</option>
                      <option value="ready">מוכן</option>
                      <option value="on_the_way">בדרך</option>
                      <option value="delivered">סופק</option>
                      <option value="cancelled">בוטל</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800/50 mt-auto space-y-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-3 bg-[#C5A059] hover:bg-[#b08e4d] disabled:opacity-50 text-slate-950 font-black text-xs tracking-wide rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        שומר שינויים...
                      </>
                    ) : (
                      <>
                        שמור שינויים 💾
                      </>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl transition-all"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
