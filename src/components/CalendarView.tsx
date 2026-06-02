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
  CalendarDays,
  Sparkles,
  MapPin,
  CalendarRange
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
  
  // Unlimited Future Data Visibility starting May 2026.
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    return new Date(2026, 4, 1); // May 2026 (index 4 is May in JS Date)
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

  // Firestore Listeners: Fetch all orders across past and unlimited future delivery schedules
  useEffect(() => {
    setLoading(true);
    const ordersQuery = query(collection(db, 'orders'), orderBy('date', 'asc'), orderBy('time', 'asc'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

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

  // Month navigation: Unlimited future months viewable
  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleResetToCurrent = () => {
    setCurrentMonth(new Date(2026, 4, 1)); // Back to May 2026
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
    return date.getDate() === 31 && date.getMonth() === 4 && date.getFullYear() === 2026; // May 31, 2026 (current local time)
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

  // High-Contrast Solid Tints specifically for Smartphone/Mobile legibility
  const getHighContrastBadgeColors = (status: Order['status']) => {
    switch (status) {
      case 'pending': 
        return {
          bg: 'bg-[#FEF3C7]',
          border: 'border-2 border-[#D97706]',
          text: 'text-[#78350F]',
          dot: 'bg-[#D97706]'
        };
      case 'preparing': 
        return {
          bg: 'bg-[#E0F2FE]',
          border: 'border-2 border-[#0284C7]',
          text: 'text-[#0C4A6E]',
          dot: 'bg-[#0284C7]'
        };
      case 'ready': 
        return {
          bg: 'bg-[#D1FAE5]',
          border: 'border-2 border-[#059669]',
          text: 'text-[#064E3B]',
          dot: 'bg-[#059669]'
        };
      case 'on_the_way': 
        return {
          bg: 'bg-[#FFE4E6]',
          border: 'border-2 border-[#E11D48]',
          text: 'text-[#4C0519]',
          dot: 'bg-[#E11D48]'
        };
      case 'delivered': 
        return {
          bg: 'bg-[#D1FAE5]',
          border: 'border-2 border-[#047857]',
          text: 'text-[#065F46]',
          dot: 'bg-[#047857]'
        };
      case 'cancelled': 
        return {
          bg: 'bg-[#FEE2E2]',
          border: 'border-2 border-[#DC2626]',
          text: 'text-[#7F1D1D]',
          dot: 'bg-[#DC2626]'
        };
      default: 
        return {
          bg: 'bg-[#F1F5F9]',
          border: 'border-2 border-[#475569]',
          text: 'text-[#1E293B]',
          dot: 'bg-[#475569]'
        };
    }
  };

  // Save changes handler to Firestore with structural updates
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !selectedOrder.id) return;

    setIsSaving(true);
    const orderId = selectedOrder.id;
    const orderRef = doc(db, 'orders', orderId);

    // Schema Enforcement on Edit:
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
      addToast('סנכרון סבב בוצע', `תעודת גליה שוכפלה בהצלחה ביומן. סטטוס: ${getStatusTextHe(editStatus)} 💾`, 'success');
      setSelectedOrder(null); // Close Drawer
    } catch (error: any) {
      addToast('שגיאה בסנכרון', 'מפתח מסד חסם גישה לשינוי הזמנה זו.', 'warning');
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const daysGrid = getDaysInMonth();

  return (
    <div 
      id="sabanos-calendar"
      className="flex-1 flex flex-col h-full bg-[#0B0F19] border-2 border-[#D4AF37]/35 rounded-3xl p-3 sm:p-4 overflow-hidden relative text-white" 
      dir="rtl"
    >
      {/* EXQUISITE LUXURY HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-[#D4AF37]/20 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/35 flex items-center justify-center text-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.15)] shrink-0">
            <CalendarRange size={20} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight flex items-center gap-2 text-white">
              יומן משימות והפצה
              <span className="bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] px-2 py-0.5 rounded-full font-black border border-[#D4AF37]/25">סבן 6.0 👑</span>
            </h2>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">Saban VIP Logistics Calendar Engine</p>
          </div>
        </div>

        {/* MONTH CONTROLS */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <button 
            onClick={handleResetToCurrent}
            className="px-2.5 py-1.5 bg-[#0F172A] hover:bg-slate-900 text-[#D4AF37] text-[10px] sm:text-[11px] font-black tracking-tight rounded-xl border border-[#D4AF37]/25 transition-all cursor-pointer active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
          >
            חזרה לחודש הנוכחי
          </button>
          
          <div className="flex items-center bg-[#070A12] border border-[#D4AF37]/25 p-1 rounded-xl">
            <button 
              onClick={handlePrevMonth}
              className="p-1 sm:p-1.5 hover:bg-slate-900 rounded-lg text-[#D4AF37] hover:text-amber-300 transition-all cursor-pointer"
              title="חודש קודם"
            >
              <ChevronRight size={15} strokeWidth={3} />
            </button>
            <span className="px-2 sm:px-3 text-[11px] font-black min-w-[90px] text-center text-white">
              {HebrewMonths[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-1 sm:p-1.5 hover:bg-slate-900 rounded-lg text-[#D4AF37] hover:text-amber-300 transition-all cursor-pointer"
              title="חודש הבא"
            >
              <ChevronLeft size={15} strokeWidth={3} />
            </button>
          </div>

          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all shrink-0"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* CALENDAR WEEKDAY HEADERS IN SOLID GOLD ACCENTS */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5 shrink-0">
        {HebrewDays.map((day) => (
          <div 
            key={day} 
            className="text-center text-[10px] font-black text-[#D4AF37] uppercase py-1 bg-[#161D30]/70 border border-[#D4AF37]/15 rounded-lg"
          >
            {day}
          </div>
        ))}
      </div>

      {/* CALENDAR CELLS GRID */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-[#0F172A] border-t-[#D4AF37] rounded-full animate-spin" />
          <span className="text-xs font-black text-slate-300 animate-pulse">סורק ומסנכרן הזמנות...</span>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-1 sm:gap-1.5 overflow-y-auto custom-scrollbar p-0.5 min-h-0">
          {daysGrid.map((day, idx) => {
            if (!day) {
              return (
                <div key={`empty-${idx}`} className="bg-[#070A12]/40 border border-slate-900/40 rounded-xl opacity-20" />
              );
            }

            const dayStr = formatDateString(day);
            const dayOrders = orders.filter(o => o.date === dayStr);
            const isToday = isTodayDate(day);

            return (
              <div 
                key={dayStr}
                className={`flex flex-col rounded-xl border p-1 transition-all relative group bg-[#0F172A]/80 ${
                  isToday 
                    ? 'border-2 border-[#D4AF37] bg-[#D4AF37]/10 shadow-[0_0_12px_rgba(212,175,55,0.25)] z-10' 
                    : 'border-slate-800/80 hover:border-[#D4AF37]/30 hover:bg-[#131B2D]'
                }`}
              >
                {/* DAY NUMBER */}
                <div className="flex items-center justify-between mb-1 shrink-0 px-0.5">
                  <span className={`text-[11px] font-black leading-none ${isToday ? 'text-[#D4AF37] text-xs' : 'text-slate-300'}`}>
                    {day.getDate()}
                  </span>
                  {dayOrders.length > 0 && (
                    <span className="text-[9px] font-black bg-[#D4AF37]/20 border border-[#D4AF37]/40 px-1 rounded-full text-white">
                      {dayOrders.length}
                    </span>
                  )}
                </div>

                {/* HIGH-DENSITY HIGH-CONTRAST SUMMARY BADGES FOR PHONE VISIBILITY */}
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar min-h-0">
                  {dayOrders.map((order) => {
                    const badge = getHighContrastBadgeColors(order.status);
                    const orderNumShort = order.orderNumber || order.id?.slice(-4);
                    return (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={`w-full text-right p-1 rounded-lg ${badge.bg} ${badge.border} ${badge.text} transition-all flex flex-col justify-between gap-0.5 overflow-hidden active:scale-95 shadow-[0_1px_3px_rgba(0,0,0,0.15)]`}
                        title={`${order.customerName} - #${orderNumShort}`}
                      >
                        <div className="flex items-center justify-between w-full leading-tight">
                          <span className="text-[10px] font-black truncate max-w-[82%]">
                            {order.customerName}
                          </span>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dot}`} />
                        </div>
                        <div className="flex items-center justify-between w-full text-[8.5px] font-bold opacity-90">
                          <span className="font-mono">{order.time || '--:--'}</span>
                          <span className="font-mono">#{orderNumShort}</span>
                        </div>
                        {order.driverId && order.driverId !== 'self' && (
                          <div className="flex items-center gap-0.5 text-[7.5px] font-extrabold mt-0.5 border-t border-black/10 pt-0.5">
                            <Truck size={8} />
                            <span className="truncate">{drivers.find(d => d.id === order.driverId)?.name || 'משויך'}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK-EDIT SLIDE-OVER DRAWER WITH LUXURY DESIGN */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="fixed inset-0 bg-[#070A12]/80 z-40 backdrop-blur-sm"
            />
            
            {/* Slide-over Container */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-[#0B0F19] border-l-2 border-[#D4AF37]/50 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 flex flex-col p-6 text-white overflow-y-auto"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#D4AF37]/15">
                <div className="flex items-center gap-2">
                  <Database className="text-[#D4AF37]" size={18} />
                  <h3 className="text-sm font-black text-white">עריכת פרטי סבב מהירה</h3>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Order Info Summary Card */}
              <div className="p-4 bg-slate-950/90 rounded-2xl border border-[#D4AF37]/20 mb-5 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#D4AF37] font-black">לקוח:</span>
                  <span className="text-white font-black">{selectedOrder.customerName}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300 font-bold">מספר הזמנה:</span>
                  <span className="text-[#D4AF37] font-mono font-black">#{selectedOrder.orderNumber || selectedOrder.id?.slice(-6)}</span>
                </div>
                <div className="flex justify-between items-start text-[11px] gap-2">
                  <span className="text-slate-300 font-bold shrink-0">פריטים:</span>
                  <span className="text-slate-100 text-left line-clamp-2 max-w-[200px]">{selectedOrder.items}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] gap-2">
                  <span className="text-slate-300 font-bold">יעד פריקה:</span>
                  <span className="text-slate-100 truncate max-w-[180px]">{selectedOrder.destination}</span>
                </div>
              </div>

              {/* EDIT FORM */}
              <form onSubmit={handleSaveChanges} className="flex-1 flex flex-col gap-4 justify-between">
                <div className="space-y-4">
                  {/* Select Driver */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <Truck size={12} className="text-[#D4AF37]" />
                      שייך לנהג הפצה
                    </label>
                    <select
                      value={editDriverId}
                      onChange={(e) => setEditDriverId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#D4AF37] outline-none transition-all cursor-pointer"
                    >
                      <option value="self">איסוף עצמי 👤</option>
                      {drivers.map(drv => (
                        <option key={drv.id} value={drv.id}>{drv.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date Input */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <CalendarIcon size={12} className="text-[#D4AF37]" />
                      מועד אספקה מתוכנן
                    </label>
                    <input 
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#D4AF37] outline-none transition-all"
                    />
                  </div>

                  {/* Time Input */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <Clock size={12} className="text-[#D4AF37]" />
                      שעת הגעה משוערת ליציאה
                    </label>
                    <input 
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#D4AF37] outline-none transition-all"
                    />
                  </div>

                  {/* Status Selection */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <Check size={12} className="text-[#D4AF37]" />
                      מצב / סטטוס נוכחי
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as Order['status'])}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#D4AF37] outline-none transition-all cursor-pointer"
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
                    className="w-full py-3 bg-[#D4AF37] hover:bg-[#b89528] disabled:opacity-50 text-slate-950 font-black text-xs tracking-wide rounded-xl shadow-[0_4px_12px_rgba(212,175,55,0.25)] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#D4AF37]/30"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        מסנכרן שינויים...
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
                    className="w-full py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 text-xs font-bold rounded-xl transition-all"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* SIGNATURE ACCORDING TO PROTOCOL */}
      <div className="mt-2 flex justify-between items-center border-t border-[#D4AF37]/15 pt-2 px-1 text-[10px] text-slate-400 shrink-0">
        <span>SabanOS v6.0 System Logs: Synchronized</span>
        <div className="signature m-0 p-0 text-[10px] font-bold text-[#D4AF37]">באדיבות נועה ❤️</div>
      </div>
    </div>
  );
};
