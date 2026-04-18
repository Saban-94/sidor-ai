/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText,
  Plus, 
  Search, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  LogOut, 
  MessageSquare, 
  Send,
  Calendar as CalendarIcon,
  Trash2,
  X,
  ChevronRight,
  ChevronLeft,
  Settings,
  MoreVertical,
  Bell,
  BellOff,
  Pencil,
  Users,
  LayoutList,
  CalendarDays,
  Table,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  CheckCircle,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { 
  format, 
  addDays, 
  subDays, 
  isSameDay, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth,
  addMonths,
  subMonths
} from 'date-fns';
import { he } from 'date-fns/locale';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import MorningReportSystem from './components/MorningReportSystem';
import { 
  Order, 
  DRIVERS, 
  createOrder, 
  updateOrder, 
  deleteOrder, 
  askNoa, 
  predictOrderEta,
  INVENTORY_RULES 
} from './services/auraService';

// --- Components ---

const StatusBadge = ({ status }: { status: Order['status'] }) => {
  const configs = {
    pending: { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Clock, label: 'ממתין' },
    preparing: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck, label: 'בהכנה' },
    ready: { color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2, label: 'מוכן' },
    delivered: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: CheckCircle, label: 'סופק' },
    cancelled: { color: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle, label: 'בוטל' },
  };

  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border ${config.color} shadow-sm uppercase tracking-tight`}>
      <Icon size={12} strokeWidth={3} />
      {config.label}
    </span>
  );
};

const SortIcon = ({ field, currentSort, direction }: { field: string, currentSort: string, direction: 'asc' | 'desc' }) => {
  if (currentSort !== field) return <ArrowUpDown size={12} className="inline mr-2 opacity-20" />;
  return direction === 'asc' ? <ArrowUp size={12} className="inline mr-2 text-orange-600" /> : <ArrowDown size={12} className="inline mr-2 text-orange-600" />;
};

const Header = ({ user, notificationsEnabled, onToggleNotifications }: { user: FirebaseUser, notificationsEnabled: boolean, onToggleNotifications: () => void }) => (
  <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
    <div className="flex items-center gap-4">
      <div className="bg-orange-600/10 p-2 rounded-xl">
        <Truck className="text-orange-600" size={24} />
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">ח. סבן לוגיסטיקה</h1>
        <p className="text-xs text-gray-500 font-medium">בוקר טוב, {user.displayName?.split(' ')[0] || 'ראמי'} אחי</p>
      </div>
    </div>
    
    <div className="flex items-center gap-3">
      <button 
        onClick={onToggleNotifications}
        className={`p-2.5 rounded-xl transition-all border ${notificationsEnabled ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
        title={notificationsEnabled ? 'התראות פעילות' : 'הפעל התראות'}
      >
        {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
      </button>

      <div className="hidden md:flex flex-col items-end">
        <span className="text-sm font-semibold text-gray-800">{user.displayName}</span>
        <button onClick={logout} className="text-xs text-red-500 hover:text-red-600 transition-colors flex items-center gap-1">
          <LogOut size={12} /> התנתק
        </button>
      </div>
      <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-orange-50" referrerPolicy="no-referrer" />
    </div>
  </header>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
    <div className="bg-gray-100 p-6 rounded-full mb-4">
      <CalendarIcon className="text-gray-400" size={48} />
    </div>
    <h3 className="text-lg font-bold text-gray-800">אין הזמנות ליום הזה</h3>
    <p className="text-gray-500 mt-2 max-w-xs text-sm">הסידור ריק בינתיים אחי. אפשר להוסיף הזמנה חדשה או לבקש מ-Aura לעזור.</p>
  </div>
);

const DriverTooltip = ({ driverId, allOrders, children }: { driverId: string, allOrders: Order[], children: React.ReactNode }) => {
  const driverOrders = allOrders.filter(o => o.driverId === driverId).sort((a,b) => a.time.localeCompare(b.time));
  const driver = DRIVERS.find(d => d.id === driverId);

  return (
    <div className="relative group/tooltip inline-block">
      {children}
      <div className="absolute bottom-full right-0 mb-3 w-72 bg-gray-900 text-white rounded-[24px] shadow-2xl p-5 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-[100] pointer-events-none border border-white/10 backdrop-blur-md bg-opacity-95 translate-y-2 group-hover/tooltip:translate-y-0 text-right" dir="rtl">
        <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
          <div className="bg-orange-600 p-2 rounded-xl">
            <Truck size={16} />
          </div>
          <div>
            <h4 className="font-bold text-sm leading-tight">{driver?.name}</h4>
            <p className="text-[10px] text-gray-400">סיכום הזמנות להיום</p>
          </div>
        </div>
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {driverOrders.length === 0 ? (
            <p className="text-xs opacity-50 text-center py-4">אין הזמנות משויכות</p>
          ) : (
            driverOrders.map(o => (
              <div key={o.id} className="text-xs flex justify-between items-start gap-3 border-b border-white/5 pb-3 last:border-0 hover:bg-white/5 p-2 rounded-xl transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-100 truncate mb-1" title={o.customerName}>{o.customerName}</p>
                  <p className="text-[10px] text-gray-500 truncate" title={o.destination}>{o.destination}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                   <div className="flex items-center gap-1.5 font-black text-orange-400 text-sm">
                     <Clock size={12} />
                     <span>{o.time}</span>
                   </div>
                   <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black ${
                     o.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                     o.status === 'ready' ? 'bg-blue-500/20 text-blue-400' :
                     o.status === 'preparing' ? 'bg-orange-500/10 text-orange-300' :
                     'bg-gray-500/20 text-gray-400'
                   }`}>
                     {o.status === 'pending' && <Clock size={10} />}
                     {o.status === 'preparing' && <Truck size={10} />}
                     {o.status === 'ready' && <CheckCircle2 size={10} />}
                     {o.status === 'delivered' && <CheckCircle size={10} />}
                     <span>{o.status === 'pending' ? 'ממתין' : o.status === 'preparing' ? 'בהכנה' : o.status === 'ready' ? 'מוכן' : 'נמסר'}</span>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const OrderCard = ({ 
  order, 
  onEdit, 
  onUpdateStatus, 
  onUpdateEta,
  onDelete,
  onAddToast,
  allOrders
}: { 
  order: Order, 
  onEdit: (o: Order) => void, 
  onUpdateStatus: (id: string, s: any) => void, 
  onUpdateEta: (id: string, eta: string) => void,
  onDelete: (id: string) => void,
  onAddToast: (title: string, msg: string, type?: any) => void,
  allOrders: Order[],
  key?: string
}) => {
  const [isEditingEta, setIsEditingEta] = useState(false);
  const [etaInput, setEtaInput] = useState(order.eta || '');
  const [isPredicting, setIsPredicting] = useState(false);

  const handleSmartPredict = async () => {
    setIsPredicting(true);
    try {
      // Use delivered orders as historical context
      const historicalOrders = allOrders.filter(o => o.status === 'delivered');
      const predictedEta = await predictOrderEta(order, historicalOrders);
      
      if (predictedEta) {
        setEtaInput(predictedEta);
        onUpdateEta(order.id!, predictedEta);
        onAddToast('חיזוי ETA חכם', `נמצא זמן הגעה משוער: ${predictedEta} על סמך תנועה אחי`, 'success');
      } else {
        onAddToast('שגיאה בחיזוי', 'לא הצלחתי לחשב זמן הגעה, תנסה שוב שותף', 'warning');
      }
    } catch (error) {
      console.error(error);
      onAddToast('שגיאה', 'משהו השתבש בחיבור ל-AI', 'warning');
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${DRIVERS.find(d => d.id === order.driverId)?.type === 'crane' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
            <Truck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="text-[10px] font-black bg-gray-900 text-white px-1.5 py-0.5 rounded-md">
                 #{order.orderNumber || order.id?.slice(-4).toUpperCase()}
               </span>
               <h3 className="font-bold text-gray-900 text-lg leading-none">{order.customerName}</h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-gray-400 font-medium">{order.destination}</p>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">מחסן: {order.warehouse}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={order.status} />
          {order.eta && (
            <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-2 py-0.5 rounded-lg text-[10px] font-black border border-orange-100 animate-pulse">
              <Clock size={10} />
              <span>הגעה משוערת: {order.eta}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-50/50 rounded-2xl p-4 mb-4 grid grid-cols-2 gap-4">
        <div>
          <span className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider">פריטים</span>
          <p className="text-sm font-bold text-gray-700">{order.items}</p>
        </div>
        <div className="text-left" dir="ltr">
          <span className="text-[10px] text-gray-400 font-bold block mb-1 uppercase tracking-wider text-right">נהג, שעה ותאריך</span>
          <div className="flex items-center gap-2 justify-end">
            <span className="text-sm font-black text-gray-900">{order.time}</span>
            <span className="text-sm font-bold text-gray-600">| {order.date.split('-').reverse().slice(0, 2).join('/')}</span>
            <DriverTooltip driverId={order.driverId} allOrders={allOrders}>
              <span className="text-sm font-bold text-gray-600 hover:text-orange-600 transition-colors cursor-help">| {DRIVERS.find(d => d.id === order.driverId)?.name || order.driverId}</span>
            </DriverTooltip>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => {
              const nextStatusMap: Record<string, string> = {
                  pending: 'preparing',
                  preparing: 'ready',
                  ready: 'delivered'
              };
              const newStatus = nextStatusMap[order.status] || order.status;
              onUpdateStatus(order.id!, newStatus);
            }}
            className="text-xs font-black text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-xl transition-colors border border-orange-100 flex items-center gap-1.5"
          >
            <ChevronLeft size={14} strokeWidth={3} />
            קדם סטטוס
          </button>
          
          {isEditingEta ? (
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
              <input 
                type="time" 
                value={etaInput}
                onChange={(e) => setEtaInput(e.target.value)}
                className="text-xs font-bold border-none bg-transparent outline-none w-20 px-1"
              />
              <button 
                onClick={() => {
                  onUpdateEta(order.id!, etaInput);
                  setIsEditingEta(false);
                }}
                className="bg-orange-600 text-white p-1 rounded-lg hover:bg-orange-700"
              >
                <Plus size={12} />
              </button>
              <button 
                onClick={() => setIsEditingEta(false)}
                className="text-gray-400 p-1"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsEditingEta(true)}
                className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-xl transition-colors border border-blue-100 flex items-center gap-1"
              >
                <Clock size={12} />
                עדכן הגעה
              </button>
              <button 
                onClick={handleSmartPredict}
                disabled={isPredicting}
                className="text-[10px] font-black text-white bg-gray-900 hover:bg-orange-600 px-2.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                title="Smart traffic-based ETA prediction"
              >
                {isPredicting ? (
                  <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Sparkles size={12} />
                )}
                <span>Predict ETA</span>
              </button>
            </div>
          )}

          <button 
            onClick={() => onEdit(order)}
            className="text-xs font-bold text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-xl transition-colors border border-gray-200 flex items-center gap-1"
          >
            <Pencil size={12} />
            ערוך
          </button>
        </div>
        <button 
          onClick={() => onDelete(order.id!)}
          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [groupByDriver, setGroupByDriver] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'table' | 'reports' | 'chat'>('list');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [toasts, setToasts] = useState<any[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isNotificationListenerReady = useRef(false);

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // --- Auth & Init ---
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // --- Background Notification Listener ---
  useEffect(() => {
    if (!user || !notificationsEnabled) {
      isNotificationListenerReady.current = false;
      return;
    }

    // Listen to all active/recent orders (from 2 days ago to forever)
    const recentDate = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'orders'),
      where('date', '>=', recentDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isNotificationListenerReady.current) {
        if (!snapshot.metadata.fromCache) {
          isNotificationListenerReady.current = true;
        }
        return;
      }

      snapshot.docChanges().forEach((change) => {
        // Skip local changes
        if (change.doc.metadata.hasPendingWrites) return;

        const order = change.doc.data() as Order;
        
        if (change.type === 'added') {
          const title = 'הזמנה חדשה אחי! 🚛';
          const msg = `${order.customerName} - ${order.items}`;
          addToast(title, msg, 'success');
          
          if (Notification.permission === 'granted') {
            new Notification(title, { body: msg });
          }
        }
        
        if (change.type === 'modified') {
          const title = 'עדכון הזמנה ✏️';
          const msg = `הסטטוס של ${order.customerName} השתנה ל-${order.status}`;
          addToast(title, msg, 'info');
          
          if (Notification.permission === 'granted') {
            new Notification(title, { body: msg });
          }
        }
      });
    });

    return () => {
      unsubscribe();
      isNotificationListenerReady.current = false;
    };
  }, [user, notificationsEnabled]);

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      } else {
        alert('כדי לקבל התראות צריך לאשר אותן בדפדפן אחי.');
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    let startStr, endStr;
    let actualIsRange = isRangeMode;

    if (viewMode === 'calendar') {
      startStr = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
      endStr = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');
      actualIsRange = true;
    } else {
      startStr = format(startDate, 'yyyy-MM-dd');
      endStr = format(endDate, 'yyyy-MM-dd');
    }
    
    let q;
    if (!actualIsRange) {
      q = query(
        collection(db, 'orders'),
        where('date', '==', startStr),
        orderBy('time', 'asc')
      );
    } else {
      q = query(
        collection(db, 'orders'),
        where('date', '>=', startStr),
        where('date', '<=', endStr),
        orderBy('date', 'asc'),
        orderBy('time', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(docs);
    });

    return () => unsubscribe();
  }, [user, startDate, endDate, isRangeMode, viewMode, calendarMonth]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // --- Aura AI Handlers ---
  const handleAuraAction = async (msg: string) => {
    const userMsg = { role: 'user', parts: [{ text: msg }] };
    setChatHistory(prev => [...prev, userMsg]);
    
    try {
      const result = await askNoa(msg, chatHistory);
      const functionCalls = result.functionCalls;

      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'create_order') {
            await createOrder(call.args as any);
          } else if (call.name === 'update_order') {
            const { orderId, ...rest } = call.args as any;
            await updateOrder(orderId, rest);
          } else if (call.name === 'update_order_status') {
            const { orderId, status } = call.args as any;
            await updateOrder(orderId, { status });
          } else if (call.name === 'delete_order_by_customer') {
            const { customerName } = call.args as any;
            const q = query(collection(db, 'orders'), where('customerName', '==', customerName));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await deleteOrder(d.id);
            }
          } else if (call.name === 'search_orders') {
            const { query: qStr } = call.args as any;
            setSearchQuery(qStr);
            setViewMode('list');
            addToast('חיפוש הזמנות', `מחפשת את "${qStr}" בלוח אחי`, 'info');
          }
        }
      }

      const auraResponse = { role: 'model', parts: [{ text: result.text || "בוצע אחי." }] };
      setChatHistory(prev => [...prev, auraResponse]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "משהו לא הסתדר אחי, תנסה שוב." }] }]);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-50">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="text-orange-600"
      >
        <Truck size={40} />
      </motion.div>
    </div>
  );

  if (!user) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-6" dir="rtl">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="bg-orange-600/10 p-6 rounded-3xl">
            <Truck className="text-orange-600" size={64} />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 text-center mb-2 tracking-tight">נועה - לוגיסטיקה חכמה</h1>
        <p className="text-center text-gray-500 mb-10 text-lg">המערכת המבצעית של ח. סבן חומרי בניין</p>
        
        <button 
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all shadow-xl shadow-gray-200"
        >
          <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="" />
          כניסה עם Google
        </button>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">© 2026 ח. סבן חומרי בניין - תפעול ולוגיסטיקה</p>
        </div>
      </div>
    </div>
  );

  if (viewMode === 'reports') {
    return <MorningReportSystem onBack={() => setViewMode('list')} />;
  }

  if (viewMode === 'chat') {
    return (
      <div className="h-screen bg-white flex flex-col md:flex-row" dir="rtl">
        {/* Left Sidebar for Desktop (Quick Info) */}
        <div className="hidden md:flex w-72 bg-gray-50 border-l border-gray-100 flex-col p-6 overflow-y-auto">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
              <ChevronRight size={20} />
            </button>
            <h1 className="text-xl font-bold">נועה AI</h1>
          </div>
          
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 mb-2 uppercase">סטטוס מערכת</p>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                <span className="text-sm font-bold">זמינה לראמי</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 mb-2 uppercase">חוקי תפעול</p>
              <div className="space-y-2">
                {INVENTORY_RULES.map((r, i) => (
                  <div key={i} className="bg-orange-50 text-orange-800 text-[10px] font-bold p-3 rounded-xl border border-orange-100">
                    {r.item}: {r.rule}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full bg-white relative">
          <header className="p-4 border-b border-gray-100 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-3">
               <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-xl">
                 <ChevronRight size={20} />
               </button>
               <h1 className="font-bold">נועה לוגיסטיקה</h1>
            </div>
          </header>

          <div 
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full pb-60"
          >
            {chatHistory.length === 0 && (
              <div className="text-center py-20 opacity-30">
                <div className="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                   <MessageSquare size={48} />
                </div>
                <h2 className="text-xl font-black mb-2">אחי, אני כאן בשבילך</h2>
                <p className="text-sm">"תפתחי הזמנה חדשה לחכמת לשעה 9 ליעד ברקאי"</p>
              </div>
            )}
            
            {chatHistory.map((chat, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex w-full ${chat.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[70%] md:max-w-md p-5 rounded-[2.5rem] text-sm md:text-base font-medium leading-relaxed shadow-xl ${
                  chat.role === 'user' 
                    ? 'bg-orange-600 text-white rounded-tr-none shadow-orange-600/10' 
                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                }`}>
                  {chat.parts[0].text}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="fixed bottom-0 md:bottom-0 left-0 right-0 md:right-72 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-20 md:pb-10 px-6 z-20">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Quick Actions */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 scroll-smooth">
                {[
                  { label: 'הזמנה חדשה ✍️', action: 'הזמנה חדשה אחי' },
                  { label: 'עדכון סטטוס ✅', action: 'אני רוצה לעדכן סטטוס להזמנה' },
                  { label: 'דוח בוקר 📋', action: 'תכיני לי דוח בוקר' },
                  { label: 'צפי הגעה ⏱️', action: 'מה צפי ההגעה של ההזמנות שלי?' }
                ].map((btn, i) => (
                  <button 
                    key={i}
                    onClick={() => handleAuraAction(btn.action)}
                    className="whitespace-nowrap bg-white hover:bg-orange-600 hover:text-white text-gray-900 text-[11px] font-black px-4 py-2.5 rounded-xl transition-all border border-gray-100 shadow-sm hover:shadow-orange-200"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.target as any;
                  const val = input.message.value;
                  if (!val) return;
                  handleAuraAction(val);
                  input.message.value = '';
                }}
                className="flex gap-3 items-center"
              >
                <input 
                  name="message"
                  autoComplete="off"
                  placeholder="דבר איתי אחי..."
                  className="flex-1 bg-white border-2 border-gray-100 rounded-[2rem] px-8 py-4 text-base focus:border-orange-600 transition-all outline-none shadow-xl"
                />
                <button 
                  type="submit"
                  className="bg-gray-900 text-white p-4 rounded-full hover:bg-orange-600 transition-all shadow-xl hover:scale-110 active:scale-95"
                >
                  <Send size={24} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredOrders = orders
    .filter(order => {
      const matchesSearch = 
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesDriver = driverFilter === 'all' || order.driverId === driverFilter;
      const matchesWarehouse = warehouseFilter === 'all' || order.warehouse === warehouseFilter;
      
      return matchesSearch && matchesStatus && matchesDriver && matchesWarehouse;
    })
    .sort((a: any, b: any) => {
      let comparison = 0;
      if (sortBy === 'time') {
        comparison = a.date.localeCompare(b.date);
        if (comparison === 0) comparison = a.time.localeCompare(b.time);
      } else {
        const valA = String(a[sortBy] || '');
        const valB = String(b[sortBy] || '');
        comparison = valA.localeCompare(valB, 'he', { numeric: true });
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending').length;
  const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered').length;
  const totalOrders = filteredOrders.length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans mb-20 md:mb-0" dir="rtl">
      <Header 
        user={user} 
        notificationsEnabled={notificationsEnabled} 
        onToggleNotifications={toggleNotifications} 
      />

      {/* Manual Order Modal */}
      <AnimatePresence>
        {(isAddingOrder || editingOrder) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingOrder(false);
                setEditingOrder(null);
              }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingOrder ? 'עדכון הזמנה אחי' : 'הזמנה חדשה אחי'}</h3>
                <button onClick={() => {
                  setIsAddingOrder(false);
                  setEditingOrder(null);
                }} className="p-1 hover:bg-white/10 rounded-lg">
                  <X size={24} />
                </button>
              </div>
              
              <form 
                key={editingOrder?.id || 'new'}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as any;
                  const data = {
                    date: form.date.value,
                    time: form.time.value,
                    driverId: form.driver.value,
                    orderNumber: form.orderNumber.value,
                    customerName: form.customer.value,
                    destination: form.destination.value,
                    items: form.items.value,
                    warehouse: form.warehouse.value as any,
                  };
                  
                  if (editingOrder) {
                    await updateOrder(editingOrder.id!, data);
                  } else {
                    await createOrder(data);
                  }
                  
                  setIsAddingOrder(false);
                  setEditingOrder(null);
                }}
                className="p-6 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">תאריך</label>
                    <input name="date" type="date" required defaultValue={editingOrder ? editingOrder.date : format(startDate, 'yyyy-MM-dd')} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">שעה</label>
                    <input name="time" type="time" required defaultValue={editingOrder?.time || ''} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">מחסן</label>
                    <select name="warehouse" required defaultValue={editingOrder?.warehouse || "החרש"} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none">
                      <option value="החרש">החרש</option>
                      <option value="התלמיד">התלמיד</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">נהג</label>
                    <select name="driver" required defaultValue={editingOrder?.driverId || DRIVERS[0].id} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none">
                      {DRIVERS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">לקוח</label>
                    <input name="customer" required defaultValue={editingOrder?.customerName || ''} placeholder="שם הלקוח" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">מספר הזמנה / ליד</label>
                    <input name="orderNumber" defaultValue={editingOrder?.orderNumber || ''} placeholder="מס' נתור / הזמנה" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">יעד</label>
                  <input name="destination" required defaultValue={editingOrder?.destination || ''} placeholder="לאן נוסעים?" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">פריטים</label>
                  <textarea name="items" required defaultValue={editingOrder?.items || ''} placeholder="מה מעמיסים?" rows={3} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none resize-none" />
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20">
                    {editingOrder ? 'תעדכן לי אחי' : 'תאשר לי אחי, הכל מוכן'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8">
        
        {/* Date Selector */}
        {viewMode === 'list' ? (
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <CalendarIcon size={18} className="text-orange-600" />
                בחירת תאריך
              </h3>
              <button 
                onClick={() => setIsRangeMode(!isRangeMode)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${isRangeMode ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {isRangeMode ? 'ביטול טווח' : 'סינון לפי טווח'}
              </button>
            </div>

            {!isRangeMode ? (
              <div className="flex items-center justify-between bg-gray-50 p-2 rounded-2xl">
                <button onClick={() => setStartDate(subDays(startDate, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
                  <ChevronRight size={20} className="text-gray-400" />
                </button>
                
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-gray-900">{format(startDate, 'dd/MM/yyyy')}</span>
                  <span className="text-xs font-semibold text-orange-600">
                    {isSameDay(startDate, new Date()) ? 'היום' : format(startDate, 'EEEE', { locale: he })}
                  </span>
                </div>

                <button onClick={() => setStartDate(addDays(startDate, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
                  <ChevronLeft size={20} className="text-gray-400" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">מתאריך</label>
                  <input 
                    type="date" 
                    value={format(startDate, 'yyyy-MM-dd')}
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">עד תאריך</label>
                  <input 
                    type="date" 
                    value={format(endDate, 'yyyy-MM-dd')}
                    onChange={(e) => setEndDate(new Date(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-600 outline-none font-bold"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-2 hover:bg-orange-50 rounded-xl transition-colors text-orange-600">
                <ChevronRight size={24} />
              </button>
              <h3 className="text-xl font-black text-gray-900 capitalize">
                {format(calendarMonth, 'MMMM yyyy', { locale: he })}
              </h3>
              <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-2 hover:bg-orange-50 rounded-xl transition-colors text-orange-600">
                <ChevronLeft size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => (
                <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const monthStart = startOfMonth(calendarMonth);
                const monthEnd = endOfMonth(monthStart);
                const startDateRange = startOfWeek(monthStart);
                const endDateRange = endOfWeek(monthEnd);
                
                return eachDayOfInterval({
                  start: startDateRange,
                  end: endDateRange,
                }).map((day, i) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayOrders = orders.filter(o => o.date === dayStr);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, startDate);

                  return (
                    <button 
                      key={day.toString()}
                      onClick={() => {
                        setStartDate(day);
                        setIsRangeMode(false);
                        setViewMode('list');
                      }}
                      className={`
                        min-h-[80px] p-2 rounded-2xl border transition-all flex flex-col items-start relative
                        ${!isCurrentMonth ? 'bg-gray-50/50 border-transparent opacity-30 cursor-default' : 
                          isSelected ? 'bg-orange-50 border-orange-200 shadow-inner' : 
                          'bg-white border-gray-100 hover:border-orange-200 hover:shadow-sm'}
                      `}
                    >
                      <span className={`text-xs font-bold ${isToday ? 'bg-orange-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-900'}`}>
                        {format(day, 'd')}
                      </span>
                      {dayOrders.length > 0 && isCurrentMonth && (
                        <div className="mt-auto space-y-1 w-full">
                          <div className="bg-orange-100 text-orange-700 text-[9px] font-black px-1.5 py-0.5 rounded-md flex justify-between items-center w-full">
                            <span>{dayOrders.length}</span>
                            <span>📦</span>
                          </div>
                          {dayOrders.some(o => o.status === 'delivered') && (
                            <div className="w-full h-1 bg-green-400 rounded-full" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-gray-900 underline decoration-orange-500 decoration-4 underline-offset-8">
              {viewMode === 'list' ? 'דוח בוקר' : viewMode === 'calendar' ? 'לוח שנתי' : 'כל הנתונים'}
            </h2>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <LayoutList size={20} />
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <CalendarDays size={20} />
              </button>
              <button 
                onClick={() => {
                   setViewMode('table');
                   setIsRangeMode(true); // Default table view to range for better overview
                }}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Table size={20} />
              </button>
              <button 
                onClick={() => setViewMode('reports')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'reports' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="ארכיון דוחות"
              >
                <FileText size={20} />
              </button>
              <button 
                onClick={() => setViewMode('chat')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'chat' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="נועה AI"
              >
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
          <button 
            onClick={() => setIsAddingOrder(true)}
            className="bg-orange-600 text-white flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-orange-600/20 hover:scale-105 transition-transform"
          >
            <Plus size={20} />
            הזמנה חדשה
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="חפש לקוח, יעד, פריט או מס' הזמנה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm focus:ring-2 focus:ring-orange-600 outline-none shadow-sm transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-orange-600 transition-all cursor-pointer"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="preparing">בהכנה</option>
              <option value="ready">מוכן ✅</option>
              <option value="delivered">סופק</option>
              <option value="cancelled">בוטל</option>
            </select>
            
            <select 
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-orange-600 transition-all cursor-pointer"
            >
              <option value="all">כל הנהגים</option>
              {DRIVERS.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select 
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-orange-600 transition-all cursor-pointer"
            >
              <option value="all">כל המחסנים</option>
              <option value="החרש">מחסן החרש 🏭</option>
              <option value="התלמיד">מחסן התלמיד 🏗️</option>
            </select>

            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-orange-600 transition-all cursor-pointer"
            >
              <option value="time">מיין לפי שעת יציאה 🕒</option>
              <option value="customerName">מיין לפי לקוח 👤</option>
              <option value="destination">מיין לפי יעד 📍</option>
            </select>
          </div>
        </div>

        {/* Daily Summary */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-sm">סיכום מסירות</h3>
          <button 
            onClick={() => setGroupByDriver(!groupByDriver)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${groupByDriver ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Users size={14} />
            {groupByDriver ? 'בטל הקבצה' : 'קבץ לפי נהג'}
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">סה"כ</span>
            <span className="text-2xl font-black text-gray-900">{totalOrders}</span>
          </div>
          <div className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">סופקו</span>
            <span className="text-2xl font-black text-green-600">{deliveredOrders}</span>
          </div>
          <div className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ממתינות</span>
            <span className="text-2xl font-black text-orange-600">{pendingOrders}</span>
          </div>
        </div>

        {/* Orders List / Table */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-3 text-gray-400">
                <Search size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">לא מצאתי תוצאות אחי</h3>
              <p className="text-gray-500 text-sm">נסה לחפש משהו אחר או לשנות את הסינון.</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th onClick={() => toggleSort('date')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">תאריך <SortIcon field="date" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th onClick={() => toggleSort('time')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">שעת יציאה <SortIcon field="time" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th onClick={() => toggleSort('eta')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">הגעה משוערת <SortIcon field="eta" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th onClick={() => toggleSort('driverId')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">נהג <SortIcon field="driverId" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th onClick={() => toggleSort('customerName')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">לקוח <SortIcon field="customerName" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th onClick={() => toggleSort('orderNumber')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">מס' הזמנה <SortIcon field="orderNumber" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th onClick={() => toggleSort('destination')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">יעד <SortIcon field="destination" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th onClick={() => toggleSort('items')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">פריטים <SortIcon field="items" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th onClick={() => toggleSort('warehouse')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">מחסן <SortIcon field="warehouse" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th onClick={() => toggleSort('status')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">סטטוס <SortIcon field="status" currentSort={sortBy} direction={sortDirection} /></div>
                      </th>
                      <th className="px-6 py-4">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                          {format(new Date(order.date), 'dd/MM/yy')}
                        </td>
                        <td className="px-6 py-4 font-bold text-orange-600">{order.time}</td>
                        <td className="px-6 py-4 font-black text-orange-700 bg-orange-50/30">
                          {order.eta || '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          <DriverTooltip driverId={order.driverId} allOrders={orders}>
                            <span className="cursor-help hover:text-orange-600 transition-colors">
                              {DRIVERS.find(d => d.id === order.driverId)?.name.split(' ')[0] || order.driverId}
                            </span>
                          </DriverTooltip>
                        </td>
                        <td className="px-6 py-4 font-black text-gray-900">{order.customerName}</td>
                        <td className="px-6 py-4 font-bold text-gray-500 text-xs">#{order.orderNumber || '-'}</td>
                        <td className="px-6 py-4 text-gray-400 text-xs">{order.destination}</td>
                        <td className="px-6 py-4 text-gray-600 text-xs max-w-[200px] truncate" title={order.items}>
                          {order.items}
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg font-bold">{order.warehouse}</span>
                        </td>
                        <td className="px-6 py-4">
                           <StatusBadge status={order.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setEditingOrder(order)} 
                              className="text-gray-400 hover:text-orange-600 transition-colors p-1"
                              title="ערוך"
                            >
                              <Pencil size={16} />
                            </button>
                            <button 
                              onClick={() => deleteOrder(order.id!)} 
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="מחק"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : groupByDriver ? (
            <div className="space-y-8">
              {DRIVERS.filter(driver => filteredOrders.some(o => o.driverId === driver.id)).map(driver => {
                const driverOrders = filteredOrders.filter(o => o.driverId === driver.id);
                return (
                  <div key={driver.id} className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <div className="flex items-center gap-2">
                         <div className={`w-2 h-8 rounded-full ${driver.type === 'crane' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                         <h3 className="text-xl font-black text-gray-900">{driver.name}</h3>
                         <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg text-xs font-bold">
                           {driverOrders.length} הזמנות
                         </span>
                       </div>
                    </div>
                    <div className="grid gap-4">
                      {driverOrders.map((order) => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          allOrders={orders}
                          onEdit={setEditingOrder}
                          onUpdateStatus={(id, status) => updateOrder(id, { status })}
                          onUpdateEta={(id, eta) => updateOrder(id, { eta })}
                          onDelete={deleteOrder}
                          onAddToast={addToast}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  allOrders={orders}
                  onEdit={setEditingOrder}
                  onUpdateStatus={(id, status) => updateOrder(id, { status })}
                  onUpdateEta={(id, eta) => updateOrder(id, { eta })}
                  onDelete={deleteOrder}
                  onAddToast={addToast}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Rules Section */}
        <div className="mt-12 mb-20 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-orange-500" />
            <h3 className="font-bold text-gray-800">חוקי מלאי ותפעול</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INVENTORY_RULES.map((rule, idx) => (
              <div key={idx} className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                <p className="text-sm text-orange-800 font-bold">● {rule.item}: {rule.rule}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Toasts */}

      {/* Mobile Nav Overlay */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-8 py-3 flex justify-between items-center z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setViewMode('list')}
          className={`flex flex-col items-center gap-1 ${viewMode === 'list' ? 'text-orange-600' : 'text-gray-300'}`}
        >
          <Truck size={20} />
          <span className="text-[10px] font-bold">סידור</span>
        </button>
        <button 
          onClick={() => setViewMode('chat')}
          className={`flex flex-col items-center gap-1 ${viewMode === 'chat' ? 'text-orange-600' : 'text-gray-300'}`}
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-bold">נועה</span>
        </button>
        <button 
          onClick={() => setViewMode('reports')}
          className={`flex flex-col items-center gap-1 ${viewMode === 'reports' ? 'text-orange-600' : 'text-gray-300'}`}
        >
          <FileText size={20} />
          <span className="text-[10px] font-bold">דוחות</span>
        </button>
      </div>

      {/* Toasts */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm" dir="rtl">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 flex gap-4 overflow-hidden relative"
            >
              <div className={`w-1 absolute right-0 top-0 bottom-0 ${
                toast.type === 'success' ? 'bg-green-500' : 
                toast.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
              }`} />
              
              <div className={`p-2 rounded-xl h-fit ${
                toast.type === 'success' ? 'bg-green-50' : 
                toast.type === 'warning' ? 'bg-orange-50' : 'bg-blue-50'
              }`}>
                {toast.type === 'success' && <CheckCircle size={20} className="text-green-600" />}
                {toast.type === 'warning' && <AlertTriangle size={20} className="text-orange-600" />}
                {toast.type === 'info' && <Info size={20} className="text-blue-600" />}
              </div>

              <div className="flex-1">
                <h4 className="font-black text-gray-900 text-sm mb-0.5">{toast.title}</h4>
                <p className="text-gray-500 text-xs leading-relaxed">{toast.message}</p>
              </div>

              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
