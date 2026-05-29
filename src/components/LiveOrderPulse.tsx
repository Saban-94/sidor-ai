import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  Package, 
  MapPin, 
  Clock, 
  ChevronLeft, 
  Share2, 
  Layout, 
  Search, 
  Activity,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Target,
  Maximize2
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, InventoryItem } from '../types';
import { format } from 'date-fns';
import { cn, parseItems } from '../lib/utils';
import { askNoa } from '../services/auraService';

interface LiveOrderPulseProps {
  onViewKanban: () => void;
  onAddToast: (title: string, msg: string, type?: any) => void;
  onOrderUpdateStatus?: (id: string, s: Order['status']) => void;
}

export const LiveOrderPulse: React.FC<LiveOrderPulseProps> = ({
  onViewKanban,
  onAddToast,
  onOrderUpdateStatus
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 1. REAL-TIME CONNECTIVITY: Fetch active orders
  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'preparing', 'ready', 'on_the_way']),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(docs);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Inventory for cross-referencing
  useEffect(() => {
    const q = query(collection(db, 'inventory'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(docs);
    });
    return () => unsubscribe();
  }, []);

  const selectedOrder = useMemo(() => 
    orders.find(o => o.id === selectedOrderId),
    [orders, selectedOrderId]
  );

  const filteredOrders = useMemo(() => 
    orders.filter(o => {
      const customer = o?.customerName || "";
      const destination = o?.destination || "";
      const orderNum = o?.orderNumber || "";
      const term = searchTerm || "";
      
      return (
        customer.toLowerCase().includes(term.toLowerCase()) ||
        destination.toLowerCase().includes(term.toLowerCase()) ||
        orderNum.toLowerCase().includes(term.toLowerCase())
      );
    }),
    [orders, searchTerm]
  );

  const copyToClipboardFallback = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      return false;
    }
  };

  const handleShareUpdate = async (order: Order) => {
    // 1. INITIALIZATION RESET: Re-verify data presence
    const orderData = {
      customerName: order.customerName,
      destination: order.destination,
      status: order.status,
      items: order.items,
      orderNumber: order.orderNumber || order.id?.slice(-4).toUpperCase()
    };

    // 3. DEBUGGING TOAST: Specific error alerts
    if (!orderData.customerName) {
      onAddToast('שגיאה בסנכרון נתונים', 'חסר שדה: שם לקוח', 'warning');
      return;
    }
    if (!orderData.items) {
      onAddToast('שגיאה בסנכרון נתונים', 'חסר שדה: פריטים', 'warning');
      return;
    }

    setIsGenerating(true);
    try {
      const statusHebrew: Record<string, string> = {
        pending: 'ממתין לטיפול 🕒',
        preparing: 'בהכנה במחסן 🏭',
        ready: 'מוכן למשלוח 📦',
        on_the_way: 'בדרך ליעד 🚚',
        delivered: 'סופק בהצלחה ✅',
        cancelled: 'בוטל'
      };

      const currentStatus = statusHebrew[orderData.status] || orderData.status;

      const prompt = `צור הודעת עדכון מקצועית בווטסאפ ללקוח ${orderData.customerName}.
      תבנית: "שלום ${orderData.customerName}, כאן נועה מסידור ח.סבן... האתר ב-${orderData.destination} עודכן לסטטוס ${currentStatus}".
      פריטים: ${orderData.items}.
      השתמש בטון של נועה: פשוט, מקצועי, חם, עם אימוג'ים רלוונטיים.
      סיים ב"באדיבות נועה ❤️".
      החזר רק את טקסט ההודעה המלא לפי התבנית.`;

      const response = await askNoa(prompt, []);
      let shareText = response.answer;

      // 2. FALLBACK INJECTION & 4. CACHE CLEARING
      if (!shareText || shareText.toLowerCase().includes('undefined') || shareText.trim().length < 10) {
        console.warn('AI Generation failed or returned junk, using fallback template.');
        shareText = `שלום ${orderData.customerName}, כאן נועה מסידור ח.סבן. עדכון לגבי הזמנה ${orderData.orderNumber}: הסטטוס הוא ${currentStatus} ליעד ${orderData.destination}. המשך יום מצוין! ✅\n\nבאדיבות נועה ❤️`;
      }

      try {
        await navigator.clipboard.writeText(shareText);
        onAddToast('ההודעה הועתקה! ✅', `שלח עכשיו בוואטסאפ ל-${orderData.customerName}`, 'success');
      } catch (clipErr) {
        if (copyToClipboardFallback(shareText)) {
          onAddToast('ההודעה הועתקה! ✅', `שלח עכשיו בוואטסאפ ל-${orderData.customerName}`, 'success');
        } else {
          onAddToast('⚠️ חסימת הרשאת העתקה', 'אנא העתק ידנית מהפאנל', 'warning');
        }
      }
    } catch (err) {
      const statusHebrew: Record<string, string> = {
        pending: 'ממתין לטיפול',
        preparing: 'בהכנה במחסן',
        ready: 'מוכן למשלוח',
        on_the_way: 'בדרך ליעד',
        delivered: 'סופק',
        cancelled: 'בוטל'
      };
      const currentStatus = statusHebrew[orderData.status] || orderData.status;
      const fallbackText = `שלום ${orderData.customerName}, כאן נועה מסידור ח.סבן. עדכון לגבי הזמנה ${orderData.orderNumber}: הסטטוס הוא ${currentStatus} ליעד ${orderData.destination}. המשך יום מצוין! ✅\n\nבאדיבות נועה ❤️`;
      
      if (copyToClipboardFallback(fallbackText)) {
        onAddToast('הועתק (מצב חירום) ⚠️', 'השתמשנו בתבנית בסיסית עקב תקלת תקשורת', 'warning');
      } else {
        onAddToast('⚠️ חסימת הרשאת העתקה', 'אנא העתק ידנית מהפאנל', 'warning');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50 font-sans text-slate-900 overflow-hidden" dir="rtl">
      {/* 1. LIVE PULSE FEED - Fixed width logic for toggle */}
      <motion.div 
        animate={{ width: isSidebarOpen ? 450 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex flex-col border-l border-slate-200 bg-white shadow-xl relative z-10 overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Activity size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 italic">דופק הזמנות חי</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">מעקב בזמן אמת • SabanOS Enterprise</span>
                </div>
              </div>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Zap size={18} className="animate-pulse" />
            </div>
          </div>

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="חפש הזמנה, לקוח או יעד..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl pr-11 pl-4 text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {filteredOrders.map((order) => {
            const statusMap: Record<string, { label: string; color: string; icon: any }> = {
              pending: { label: 'ממתין לטיפול 🕒', color: 'bg-slate-100 text-slate-600', icon: Clock },
              preparing: { label: 'בהכנה במחסן 🏭', color: 'bg-amber-100 text-amber-700', icon: Package },
              ready: { label: 'מוכן למשלוח 📦', color: 'bg-indigo-100 text-indigo-700', icon: Package },
              on_the_way: { label: 'בדרך ליעד 🚚', color: 'bg-blue-100 text-blue-700', icon: Truck },
              delivered: { label: 'סופק בהצלחה ✅', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 }
            };
            const currentStatus = statusMap[order.status] || { label: order.status, color: 'bg-gray-100', icon: Package };

            return (
              <motion.button
                key={order.id}
                layoutId={`order-${order.id}`}
                onClick={() => setSelectedOrderId(order.id!)}
                className={cn(
                  "w-full text-right p-6 rounded-3xl border transition-all relative overflow-hidden group",
                  selectedOrderId === order.id 
                    ? "bg-white border-indigo-500 shadow-2xl shadow-indigo-100 scale-[1.02] z-10" 
                    : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-lg"
                )}
              >
                {order.status === 'on_the_way' && (
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500 animate-pulse" />
                )}
                
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
          <div style={{ marginRight: '0px' }} className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110",
            order.status === 'on_the_way' ? "bg-indigo-500 shadow-indigo-200" : 
            order.status === 'delivered' ? "bg-emerald-500 shadow-emerald-200" : "bg-slate-200 text-slate-500"
          )}>
                      <currentStatus.icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg">#{order.orderNumber || order.id?.slice(-4).toUpperCase()}</h3>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{order.customerName}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter",
                    currentStatus.color
                  )}>
                    {currentStatus.label}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="truncate">{order.destination}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Clock size={12} />
                      <span>{order.time}</span>
                    </div>
                    <div className="flex items-center gap-1 text-indigo-600 group-hover:translate-x-[-4px] transition-transform">
                      <span className="font-black">צפה בפרטים</span>
                      <ChevronLeft size={14} />
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center py-20 grayscale opacity-50">
              <Package size={64} className="mb-4" strokeWidth={1} />
              <p className="text-sm font-bold tracking-widest uppercase">לא נמצאו משלוחים פעילים</p>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={onViewKanban}
            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 active:scale-95 transition-all shadow-xl shadow-slate-200"
          >
            <Layout size={18} />
            לוח קנבן מלא
          </button>
        </div>
      </motion.div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
        
        {/* Top bar with Toggle */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-6">
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex flex-col">
              <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight italic leading-none">SabanOS 6.1 - מהדורת ניהול</h1>
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="mt-1 flex items-center gap-2 group transition-all"
              >
                <div className="p-1 px-2 bg-slate-100 rounded-md flex items-center gap-2 border border-slate-200 group-hover:bg-indigo-50 group-hover:border-indigo-200">
                  <Maximize2 size={10} className={cn("text-slate-500 group-hover:text-indigo-600 transition-transform", !isSidebarOpen && "rotate-180")} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-600">הצג/הסתר רשימה</span>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-[11px] font-black border border-emerald-100">
               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
               מחובר לסנכרון חי
             </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-12">
          {/* Decorative mesh bridge background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')]" />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative text-center max-w-2xl"
          >
            <div className="inline-flex p-5 bg-white rounded-3xl shadow-2xl border border-slate-100 mb-10 text-indigo-600 animate-bounce">
              <Target size={48} />
            </div>
            <h2 className="text-7xl font-black text-slate-900 tracking-tighter mb-6 italic uppercase leading-none">
              חדר בקרה <span className="text-indigo-600">SabanOS</span>
            </h2>
            <p className="text-xl font-bold text-slate-500 leading-relaxed max-w-lg mx-auto">
              מערכת תיאום לוגיסטית ומעקב משלוחים בזמן אמת. בחר הזמנה מהרשימה כדי לצפות בתכולה ואימות נתונים.
            </p>
            
            <div className="grid grid-cols-3 gap-6 mt-20 text-right">
              <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">הזמנות פעילות</span>
                <p className="text-4xl font-black text-slate-900">{orders.length}</p>
              </div>
              <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">משלוחים בדרך</span>
                <p className="text-4xl font-black text-indigo-600">{orders.filter(o => o.status === 'on_the_way').length}</p>
              </div>
              <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">אחוזי הצלחה (חודשי)</span>
                <p className="text-4xl font-black text-emerald-500">98%</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Floating Noa Badge */}
        <div className="absolute bottom-10 right-10 flex items-center gap-4 p-5 bg-white backdrop-blur-md rounded-3xl border border-slate-200 shadow-2xl z-20">
           <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
             <Activity size={24} className="text-indigo-600" />
           </div>
           <div>
             <p className="text-[13px] font-black text-slate-900 italic">באדיבות נועה ❤️</p>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SabanOS AI Operations</p>
           </div>
          {/* Tactical Summary - Precision UI Update */}
          <div className="mt-12 flex justify-center">
            <div 
              id="tactical-summary-hub"
              style={{ width: '560.242px', backgroundColor: '#d2dcf3' }}
              className="p-8 rounded-[2.5rem] shadow-2xl border border-blue-200/50 flex flex-col items-center text-center"
            >
               <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4">Tactical Operations Summary</span>
               <div style={{ display: 'flex', gap: '31px', justifyContent: 'center' }} className="w-full">
                  <div className="flex flex-col">
                    <p style={{ fontSize: '18px', fontWeight: 'bold' }} className="text-blue-900 leading-none mb-1">
                      {orders.length}
                    </p>
                    <span className="text-[8px] font-black text-blue-400 uppercase">משימות</span>
                  </div>
                  <div className="w-px h-8 bg-blue-300/30" />
                  <div className="flex flex-col">
                    <p style={{ fontSize: '18px', fontWeight: 'bold' }} className="text-blue-900 leading-none mb-1">
                      {orders.filter(o => o.status === 'delivered').length}
                    </p>
                    <span className="text-[8px] font-black text-blue-400 uppercase">בוצעו</span>
                  </div>
                  <div className="w-px h-8 bg-blue-300/30" />
                  <div className="flex flex-col">
                    <p style={{ fontSize: '18px', fontWeight: 'bold' }} className="text-blue-900 leading-none mb-1">
                      {orders.filter(o => o.status === 'on_the_way').length}
                    </p>
                    <span className="text-[8px] font-black text-blue-400 uppercase">בדרך</span>
                  </div>
               </div>
               <p className="mt-4 text-[10px] font-bold text-blue-700 italic">"כל הגלגלים מסתובבים לפי התוכנית של ראמי" ❤️</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ORDER CONTENT PREVIEW (The Detail View) */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrderId(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-[550px] bg-white shadow-2xl z-50 p-12 flex flex-col overflow-hidden border-r border-slate-100"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                     <Package size={32} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 leading-none">פירוט הזמנה #{selectedOrder.orderNumber || selectedOrder.id?.slice(-4).toUpperCase()}</h2>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">{selectedOrder.customerName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedOrderId(null)}
                  className="p-4 bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-12 shadow-inner p-2 custom-scrollbar">
                
                {/* Status Track */}
                <div className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100">
                   <div className="flex items-center justify-between mb-6">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">סטטוס לוגיסטי</span>
                      <span className="px-4 py-2 bg-white text-indigo-600 rounded-2xl text-[11px] font-black uppercase shadow-sm border border-slate-100">
                        {selectedOrder.status.toUpperCase()}
                      </span>
                   </div>
                   <div className="grid grid-cols-4 gap-3 h-2 mt-10">
                     {['pending', 'preparing', 'ready', 'on_the_way'].map((s, idx) => {
                       const statuses = ['pending', 'preparing', 'ready', 'on_the_way'];
                       const currentIdx = statuses.indexOf(selectedOrder.status);
                       return (
                         <div 
                           key={s} 
                           className={cn(
                             "rounded-full transition-all duration-700",
                             idx <= currentIdx ? "bg-indigo-600 shadow-lg shadow-indigo-200" : "bg-slate-200"
                           )} 
                         />
                       );
                     })}
                   </div>
                </div>

                {/* Items List - SYNC with Inventory */}
                <div className="space-y-6">
                   <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                     <Zap size={14} className="text-indigo-600" />
                     אימות פריטים מול מחסן
                   </h3>
                   <div className="space-y-4">
                     {parseItems(selectedOrder.items).map((item, idx) => {
                       const invItem = inventory.find(i => (item.sku && i.sku === item.sku) || (i.name && item.name && i.name.includes(item.name)));
                       return (
                         <motion.div 
                           key={idx}
                           initial={{ opacity: 0, y: 15 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: idx * 0.05 }}
                           className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center justify-between group hover:border-indigo-500 hover:shadow-xl transition-all"
                         >
                            <div className="flex items-center gap-5">
                               <div className="w-14 h-14 bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors border border-slate-100">
                                 {invItem?.imageUrl && invItem.imageUrl.trim() !== "" ? (
                                   <img 
                                     src={invItem.imageUrl} 
                                     alt={item.name} 
                                     className="w-full h-full object-cover"
                                     referrerPolicy="no-referrer"
                                   />
                                 ) : (
                                   <Plus size={24} />
                                 )}
                               </div>
                               <div>
                                 <p className="font-black text-slate-900 text-xl">{item.name}</p>
                                 <div className="flex items-center gap-4 mt-2">
                                   <span className="text-[12px] font-black text-slate-400 uppercase">מק"ט: {item.sku || 'ללא'}</span>
                                   {invItem && (
                                     <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black border border-emerald-100">
                                       <CheckCircle2 size={12} />
                                       מאומת במלאי
                                     </div>
                                   )}
                                 </div>
                               </div>
                            </div>
                            <div className="text-left bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                               <p className="text-3xl font-black text-slate-900 leading-none">{item.quantity}</p>
                               <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">כמות</p>
                            </div>
                         </motion.div>
                       );
                     })}
                   </div>
                </div>

                {/* Logistics Context */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                    <MapPin className="text-indigo-600 mb-4" size={24} />
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">יעד משלוח</p>
                    <p className="text-lg font-black text-slate-900">{selectedOrder.destination}</p>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                    <Clock className="text-indigo-600 mb-4" size={24} />
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">אספקה משוערת</p>
                    <p className="text-lg font-black text-slate-900">{selectedOrder.time}</p>
                  </div>
                </div>

              </div>

              {/* Detail Panel Actions */}
              <div className="mt-12 pt-10 border-t border-slate-100 flex gap-5">
                <button 
                  onClick={() => {
                    if (onOrderUpdateStatus && selectedOrder) {
                      const nextStatusMap: Record<string, Order['status']> = {
                        pending: 'preparing',
                        preparing: 'ready',
                        ready: 'on_the_way',
                        on_the_way: 'delivered',
                        delivered: 'delivered',
                        cancelled: 'cancelled'
                      };
                      onOrderUpdateStatus(selectedOrder.id!, nextStatusMap[selectedOrder.status] || selectedOrder.status);
                    }
                  }}
                  disabled={selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled'}
                  className="flex-1 h-20 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black text-base uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-2xl shadow-emerald-100 disabled:opacity-50 disabled:bg-slate-200"
                >
                  <CheckCircle2 size={24} />
                  קדם סטטוס
                </button>
                <button 
                  onClick={() => handleShareUpdate(selectedOrder)}
                  disabled={isGenerating || !selectedOrder.customerName || !selectedOrder.items}
                  className="flex-1 h-20 bg-indigo-600 hover:bg-slate-900 text-white rounded-[1.5rem] font-black text-base uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-2xl shadow-indigo-100 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>מייצרת הודעה...</span>
                    </div>
                  ) : (!selectedOrder.customerName || !selectedOrder.items) ? (
                    <div className="flex items-center gap-3">
                      <Clock size={20} className="animate-pulse" />
                      <span>טוען נתונים...</span>
                    </div>
                  ) : (
                    <>
                      <Share2 size={24} />
                      שתף עדכון חכם (Noa)
                    </>
                  )}
                </button>
                <button 
                  className="w-20 h-20 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-[1.5rem] flex items-center justify-center transition-all border border-slate-100"
                >
                  <Maximize2 size={28} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};
