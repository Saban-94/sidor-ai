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
  Sparkles,
  Package,
  Menu
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
// הוספת הניתוב
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import MorningReportSystem from './components/MorningReportSystem';
import { OrderCard, StatusBadge } from './components/OrderCard';
import { DriverList } from './components/DriverList';
import { DriverCard } from './components/DriverCard';
import { SearchSuggestions } from './components/SearchSuggestions';
import { NoaChat } from './components/NoaChat';
import { UserApp } from './pages/UserApp'; // ייבוא הדף החדש
import { 
  Order, 
  Driver,
  createOrder, 
  updateOrder, 
  updateDriver,
  deleteOrder, 
  askNoa, 
  predictOrderEta,
  createDriver
} from './services/auraService';
import { useUserMemory } from './hooks/useUserMemory';

// --- Components ---

const SortIcon = ({ field, currentSort, direction }: { field: string, currentSort: string, direction: 'asc' | 'desc' }) => {
  if (currentSort !== field) return <ArrowUpDown size={12} className="inline mr-2 opacity-20" />;
  return direction === 'asc' ? <ArrowUp size={12} className="inline mr-2 text-sky-600" /> : <ArrowDown size={12} className="inline mr-2 text-sky-600" />;
};

const Header = ({ 
  user, 
  notificationsEnabled, 
  onToggleNotifications,
  onOpenDrawer,
  onInstallApp
}: { 
  user: FirebaseUser, 
  notificationsEnabled: boolean, 
  onToggleNotifications: () => void,
  onOpenDrawer: () => void,
  onInstallApp: () => void | null
}) => (
  <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-sky-100 sticky top-0 z-30">
    <div className="flex items-center gap-3">
      <button 
        onClick={onOpenDrawer}
        className="p-2 hover:bg-sky-50 rounded-xl text-gray-600 md:hidden"
      >
        <MoreVertical size={24} />
      </button>
      <div className="flex items-center gap-3">
        <div className="bg-sky-600/10 p-2 rounded-xl">
          <Truck className="text-sky-600" size={24} />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-lg font-bold text-gray-900 leading-tight tracking-tight">ח. סבן לוגיסטיקה</h1>
          <p className="text-[10px] text-gray-500 font-medium">בוקר טוב, {user.displayName?.split(' ')[0] || 'ראמי'} אחי</p>
        </div>
      </div>
    </div>
    
    <div className="flex items-center gap-2">
      {onInstallApp && (
        <button 
          onClick={onInstallApp}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-xl text-[10px] font-bold shadow-lg hover:scale-105 transition-all"
        >
          <Plus size={14} /> התקן אפליקציה
        </button>
      )}
      
      <button 
        onClick={onToggleNotifications}
        className={`p-2.5 rounded-xl transition-all border ${notificationsEnabled ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
        title={notificationsEnabled ? 'התראות פעילות' : 'הפעל התראות'}
      >
        {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
      </button>

      <div className="hidden md:flex flex-col items-end mr-2">
        <span className="text-sm font-semibold text-gray-800">{user.displayName}</span>
        <button onClick={logout} className="text-xs text-red-500 hover:text-red-600 transition-colors flex items-center gap-1">
          <LogOut size={12} /> התנתק
        </button>
      </div>
      <img src={user.photoURL || ''} alt="" className="w-9 h-9 rounded-full border-2 border-sky-50 shadow-sm" referrerPolicy="no-referrer" />
    </div>
  </header>
);

const Drawer = ({ 
  isOpen, 
  onClose, 
  user, 
  viewMode, 
  setViewMode,
  installPrompt
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  user: FirebaseUser,
  viewMode: string,
  setViewMode: (v: any) => void,
  installPrompt: any
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60]"
        />
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[70] flex flex-col p-6 overflow-y-auto"
          dir="rtl"
        >
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3">
              <div className="bg-sky-600 p-2 rounded-xl text-white">
                <Truck size={20} />
              </div>
              <h2 className="text-xl font-bold italic">ח. סבן</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X size={24} className="text-gray-400" />
            </button>
          </div>

          <div className="flex-1 space-y-2">
            {[
              { id: 'chat', label: 'דברו עם נועה (AI)', icon: MessageSquare },
              { id: 'list', label: 'לוח הזמנות', icon: LayoutList },
              { id: 'calendar', label: 'סידור עבודה שבועי', icon: CalendarDays },
              { id: 'reports', label: 'דוח בוקר (ארכיון)', icon: FileText },
              { id: 'table', label: 'סטטוס מלאי', icon: Table },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = viewMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setViewMode(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                    isActive 
                      ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 transform scale-[1.02]' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 3 : 2} />
                  <span className="font-bold">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-8 border-t border-gray-100 mt-auto">
            {installPrompt && (
              <button 
                onClick={() => {
                  installPrompt.prompt();
                  onClose();
                }}
                className="w-full mb-4 flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-transform"
              >
                <Plus size={20} /> התקן כאפליקציה
              </button>
            )}
            
            <div className="flex items-center gap-4 mb-6 px-2">
              <img src={user.photoURL || ''} alt="" className="w-12 h-12 rounded-full border-2 border-sky-100" />
              <div>
                <p className="font-bold text-gray-900 leading-none mb-1">{user.displayName}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{user.email}</p>
              </div>
            </div>
            
            <button 
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 text-red-500 font-bold p-4 hover:bg-red-50 rounded-2xl transition-colors"
            >
              <LogOut size={20} /> התנתק מהמערכת
            </button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
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

// --- קומפוננטת התוכן המקורית של ראמי ---
const MainAppContent = ({ user, installPrompt }: { user: FirebaseUser, installPrompt: any }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const [settings, setSettings] = useUserMemory(user?.uid, 'ui_settings', {
    viewMode: 'list' as 'list' | 'calendar' | 'reports' | 'chat' | 'drivers',
    statusFilter: 'all',
    driverFilter: 'all',
    warehouseFilter: 'all',
    sortBy: 'time',
    sortDirection: 'asc' as 'asc' | 'desc',
    groupByDriver: false,
    notificationsEnabled: false,
    isRangeMode: false
  });

  const [draftOrder, setDraftOrder, clearDraftOrder] = useUserMemory(user?.uid, 'new_order_draft', {
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '',
    driverId: '',
    customerName: '',
    destination: '',
    items: '',
    orderNumber: '',
    warehouse: 'החרש'
  });

  const viewMode = settings.viewMode;
  const setViewMode = (v: any) => setSettings({ viewMode: v });
  const statusFilter = settings.statusFilter;
  const setStatusFilter = (v: any) => setSettings({ statusFilter: v });
  const driverFilter = settings.driverFilter;
  const setDriverFilter = (v: any) => setSettings({ driverFilter: v });
  const warehouseFilter = settings.warehouseFilter;
  const setWarehouseFilter = (v: any) => setSettings({ warehouseFilter: v });
  const sortBy = settings.sortBy;
  const setSortBy = (v: any) => setSettings({ sortBy: v });
  const sortDirection = settings.sortDirection;
  const setSortDirection = (v: any) => setSettings({ sortDirection: v });
  const groupByDriver = settings.groupByDriver;
  const setGroupByDriver = (v: any) => setSettings({ groupByDriver: v });
  const notificationsEnabled = settings.notificationsEnabled;
  const setNotificationsEnabled = (v: any) => setSettings({ notificationsEnabled: v });
  const isRangeMode = settings.isRangeMode;
  const setIsRangeMode = (v: any) => setSettings({ isRangeMode: v });
  const isNotificationListenerReady = useRef(false);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {}
  };

  const handleStatusUpdate = async (id: string, newStatus: Order['status']) => {
    try {
      await updateOrder(id, { status: newStatus });
      if (newStatus === 'preparing') {
        const order = orders.find(o => o.id === id);
        if (order) {
          addToast('מחשבת צפי הגעה', `מעדכנת צפי ל-${order.customerName} אחי...`, 'info');
          const predictedEta = await predictOrderEta(order, orders.filter(o => o.status === 'delivered'));
          if (predictedEta) {
            await updateOrder(id, { eta: predictedEta });
            addToast('צפי עודכן אוטומטית', `צפי הגעה ל-${order.customerName}: ${predictedEta}`, 'success');
          }
        }
      }
      if (newStatus === 'delivered') {
        const order = orders.find(o => o.id === id);
        if (order && order.driverId && order.driverId !== 'self') {
          const driver = drivers.find(d => d.id === order.driverId);
          if (driver) {
            await updateDriver(driver.id, { totalDeliveries: (driver.totalDeliveries || 0) + 1 });
          }
        }
      }
    } catch (error) {
      addToast('שגיאה', 'משהו השתבש בעדכון הסטטוס אחי', 'warning');
    }
  };

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 5000);
  };

  useEffect(() => {
    if (!user || !notificationsEnabled) {
      isNotificationListenerReady.current = false;
      return;
    }
    const recentDate = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const q = query(collection(db, 'orders'), where('date', '>=', recentDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isNotificationListenerReady.current) {
        if (!snapshot.metadata.fromCache) isNotificationListenerReady.current = true;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.doc.metadata.hasPendingWrites) return;
        const order = change.doc.data() as Order;
        if (change.type === 'added') {
          const title = 'הזמנה חדשה אחי! 🚛';
          const msg = `${order.customerName} - ${order.items}`;
          addToast(title, msg, 'success');
          if (Notification.permission === 'granted') new Notification(title, { body: msg });
        }
      });
    });
    return () => { unsubscribe(); isNotificationListenerReady.current = false; };
  }, [user, notificationsEnabled]);

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') setNotificationsEnabled(true);
    } else setNotificationsEnabled(false);
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
      q = query(collection(db, 'orders'), where('date', '==', startStr), orderBy('time', 'asc'));
    } else {
      q = query(collection(db, 'orders'), where('date', '>=', startStr), where('date', '<=', endStr), orderBy('date', 'asc'), orderBy('time', 'asc'));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(docs);
    });
    return () => unsubscribe();
  }, [user, startDate, endDate, isRangeMode, viewMode, calendarMonth]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'drivers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Driver[];
        setDrivers(docs);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleAuraAction = async (msg: string) => {
    const userMsg = { role: 'user', parts: [{ text: msg }] };
    setChatHistory(prev => [...prev, userMsg]);
    try {
      const result = await askNoa(msg, chatHistory);
      const auraResponse = { role: 'model', parts: [{ text: result.text || "בוצע אחי." }] };
      setChatHistory(prev => [...prev, auraResponse]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "משהו לא הסתדר אחי, תנסה שוב." }] }]);
    }
  };

  if (viewMode === 'reports') return <MorningReportSystem onBack={() => setViewMode('list')} drivers={drivers} />;
  if (viewMode === 'chat') return <NoaChat chatHistory={chatHistory} chatScrollRef={chatScrollRef} onBack={() => setViewMode('list')} onAction={handleAuraAction} orders={orders} />;

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || order.destination.toLowerCase().includes(searchQuery.toLowerCase()) || order.items.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesDriver = driverFilter === 'all' || order.driverId === driverFilter;
    const matchesWarehouse = warehouseFilter === 'all' || order.warehouse === warehouseFilter;
    const isDelivered = order.status === 'delivered';
    const shouldHideDelivered = viewMode !== 'reports' && isDelivered && statusFilter === 'all';
    return matchesSearch && matchesStatus && matchesDriver && matchesWarehouse && !shouldHideDelivered;
  }).sort((a: any, b: any) => {
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans mb-20 md:mb-0" dir="rtl">
      <Header user={user} notificationsEnabled={notificationsEnabled} onToggleNotifications={toggleNotifications} onOpenDrawer={() => setIsDrawerOpen(true)} onInstallApp={installPrompt ? handleInstallClick : null} />
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} user={user} viewMode={viewMode} setViewMode={setViewMode} installPrompt={installPrompt} />
      <AnimatePresence>
        {(isAddingOrder || editingOrder) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsAddingOrder(false); setEditingOrder(null); }} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden">
              <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingOrder ? 'עדכון הזמנה אחי' : 'הזמנה חדשה אחי'}</h3>
                <button onClick={() => { setIsAddingOrder(false); setEditingOrder(null); }} className="p-1 hover:bg-white/10 rounded-lg"><X size={24} /></button>
              </div>
              <form key={editingOrder?.id || 'new'} onSubmit={async (e) => { e.preventDefault(); const form = e.target as any; const data = { date: form.date.value, time: form.time.value, driverId: form.driver.value, orderNumber: form.orderNumber.value, customerName: form.customer.value, destination: form.destination.value, items: form.items.value, warehouse: form.warehouse.value as any }; if (editingOrder) await updateOrder(editingOrder.id!, data); else { await createOrder(data); clearDraftOrder(); } setIsAddingOrder(false); setEditingOrder(null); }} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-400 mb-1">תאריך</label><input name="date" type="date" required defaultValue={editingOrder ? editingOrder.date : draftOrder.date} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" /></div>
                  <div><label className="block text-xs font-bold text-gray-400 mb-1">שעה</label><input name="time" type="time" required defaultValue={editingOrder ? editingOrder.time : draftOrder.time} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-400 mb-1">מחסן</label><select name="warehouse" required defaultValue={editingOrder ? editingOrder.warehouse : draftOrder.warehouse} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none"><option value="החרש">החרש</option><option value="התלמיד">התלמיד</option></select></div>
                  <div><label className="block text-xs font-bold text-gray-400 mb-1">נהג</label><select name="driver" required defaultValue={editingOrder ? editingOrder.driverId : (draftOrder.driverId || (drivers.length > 0 ? drivers[0].id : ''))} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none">{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-400 mb-1">לקוח</label><input name="customer" required defaultValue={editingOrder ? editingOrder.customerName : draftOrder.customerName} placeholder="שם הלקוח" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" /></div>
                  <div><label className="block text-xs font-bold text-gray-400 mb-1">מספר הזמנה / ליד</label><input name="orderNumber" defaultValue={editingOrder ? editingOrder.orderNumber : draftOrder.orderNumber} placeholder="מס' נתור / הזמנה" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" /></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-400 mb-1">יעד</label><input name="destination" required defaultValue={editingOrder ? editingOrder.destination : draftOrder.destination} placeholder="לאן נוסעים?" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-400 mb-1">פריטים</label><textarea name="items" required defaultValue={editingOrder ? editingOrder.items : draftOrder.items} placeholder="מה מעמיסים?" rows={3} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none resize-none" /></div>
                <div className="pt-4"><button type="submit" className="w-full bg-sky-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-sky-700 transition-colors shadow-lg shadow-sky-600/20">{editingOrder ? 'תעדכן לי אחי' : 'תאשר לי אחי, הכל מוכן'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 pb-32 sm:pb-8">
        <div className="pb-[env(safe-area-inset-bottom)]">
        {viewMode === 'list' ? (
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-sky-100 mb-8">
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-800 flex items-center gap-2"><CalendarIcon size={18} className="text-sky-600" />בחירת תאריך</h3><button onClick={() => setIsRangeMode(!isRangeMode)} className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${isRangeMode ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{isRangeMode ? 'ביטול טווח' : 'סינון לפי טווח'}</button></div>
            {!isRangeMode ? (
              <div className="flex items-center justify-between bg-gray-50/50 p-2 rounded-2xl"><button onClick={() => setStartDate(subDays(startDate, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight size={20} className="text-gray-400" /></button><div className="flex flex-col items-center"><span className="text-lg font-bold text-gray-900">{format(startDate, 'dd/MM/yyyy')}</span><span className="text-xs font-semibold text-sky-600">{isSameDay(startDate, new Date()) ? 'היום' : format(startDate, 'EEEE', { locale: he })}</span></div><button onClick={() => setStartDate(addDays(startDate, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft size={20} className="text-gray-400" /></button></div>
            ) : (
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">מתאריך</label><input type="date" value={format(startDate, 'yyyy-MM-dd')} onChange={(e) => setStartDate(new Date(e.target.value))} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none font-bold" /></div><div><label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">עד תאריך</label><input type="date" value={format(endDate, 'yyyy-MM-dd')} onChange={(e) => setEndDate(new Date(e.target.value))} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none font-bold" /></div></div>
            )}
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-sky-100 mb-8"><div className="flex items-center justify-between mb-6"><div className="flex items-center gap-2"><button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-2 hover:bg-sky-50 rounded-xl transition-colors text-sky-600"><ChevronRight size={24} /></button><h3 className="text-xl font-black text-gray-900 capitalize min-w-[150px] text-center">{format(calendarMonth, 'MMMM yyyy', { locale: he })}</h3><button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-2 hover:bg-sky-50 rounded-xl transition-colors text-sky-600"><ChevronLeft size={24} /></button></div></div><div className="grid grid-cols-7 gap-1 mb-2">{['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => (<div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase py-2">{day}</div>))}</div><div className="grid grid-cols-7 gap-1">{eachDayOfInterval({ start: startOfWeek(startOfMonth(calendarMonth)), end: endOfWeek(endOfMonth(calendarMonth)) }).map((day) => { const dayStr = format(day, 'yyyy-MM-dd'); const dayOrders = orders.filter(o => o.date === dayStr); return (<button key={day.toString()} onClick={() => { setStartDate(day); setEndDate(day); setIsRangeMode(false); setViewMode('list'); }} className={`min-h-[90px] p-2 rounded-2xl border transition-all flex flex-col items-start relative overflow-hidden ${!isSameMonth(day, calendarMonth) ? 'opacity-30' : isSameDay(day, startDate) ? 'bg-sky-50 border-sky-200' : 'bg-white border-gray-100'}`}><span className="text-[10px] font-bold">{format(day, 'd')}</span>{dayOrders.length > 0 && <span className="text-[9px] font-black text-gray-400 mt-auto">#{dayOrders.length}</span>}</button>); })}</div></div>
        )}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4"><h2 className="text-2xl font-black text-gray-900 underline decoration-sky-500 decoration-4 underline-offset-8">{viewMode === 'list' ? 'דוח בוקר' : viewMode === 'calendar' ? 'לוח שנתי' : viewMode === 'drivers' ? 'נהגים וביצועים' : 'ארכיון דוחות'}</h2><div className="flex bg-gray-100 p-1 rounded-xl"><button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutList size={20} /></button><button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}><CalendarDays size={20} /></button><button onClick={() => setViewMode('drivers')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'drivers' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}><Users size={20} /></button><button onClick={() => setViewMode('reports')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'reports' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}><FileText size={20} /></button><button onClick={() => setViewMode('chat')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'chat' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}><MessageSquare size={20} /></button></div></div>
          <button onClick={() => setIsAddingOrder(true)} className="bg-sky-600 text-white flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-sky-600/20 hover:scale-105 transition-transform"><Plus size={20} />הזמנה חדשה</button>
        </div>
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative"><Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="חפש לקוח, יעד, פריט או מס' הזמנה..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => setIsSearchFocused(true)} onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)} className="w-full bg-white border border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm focus:ring-2 focus:ring-sky-600 outline-none shadow-sm transition-all" /><AnimatePresence>{isSearchFocused && <SearchSuggestions orders={orders} searchQuery={searchQuery} isVisible={isSearchFocused} onSelect={(val) => { setSearchQuery(val); setIsSearchFocused(false); }} />}</AnimatePresence></div>
          <div className="flex flex-wrap gap-3"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"><option value="all">כל הסטטוסים</option><option value="pending">ממתין</option><option value="preparing">בהכנה</option><option value="ready">מוכן ✅</option><option value="delivered">סופק</option><option value="cancelled">בוטל</option></select><select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"><option value="all">כל הנהגים</option>{drivers.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}</select><select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"><option value="all">כל המחסנים</option><option value="החרש">מחסן החרש 🏭</option><option value="התלמיד">מחסן התלמיד 🏗️</option></select><select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"><option value="time">מיין לפי שעת יציאה 🕒</option><option value="customerName">מיין לפי לקוח 👤</option><option value="destination">מיין לפי יעד 📍</option></select></div>
        </div>
        <div className="space-y-4">
          {filteredOrders.length === 0 && viewMode === 'list' ? (<div className="text-center py-12"><Search size={32} className="mx-auto mb-3 text-gray-400" /><h3 className="text-lg font-bold">לא מצאתי תוצאות אחי</h3></div>) : groupByDriver ? (<DriverList orders={filteredOrders} drivers={drivers} searchQuery={searchQuery} onOrderEdit={setEditingOrder} onOrderUpdateStatus={handleStatusUpdate} onOrderUpdateEta={(id, eta) => updateOrder(id, { eta })} onOrderDelete={deleteOrder} onAddToast={addToast} onDriverSelect={id => setSelectedDriverId(id === selectedDriverId ? null : id)} selectedDriverId={selectedDriverId} />) : viewMode === 'drivers' ? (<div className="space-y-6">{drivers.map(driver => (<DriverCard key={driver.id} driver={driver} orders={orders.filter(o => o.driverId === driver.id)} allOrders={orders} searchQuery={searchQuery} onOrderEdit={setEditingOrder} onOrderUpdateStatus={handleStatusUpdate} onOrderUpdateEta={(id, eta) => updateOrder(id, { eta })} onOrderDelete={deleteOrder} onAddToast={addToast} />))}</div>) : (<div className="grid gap-4">{filteredOrders.map((order) => (<OrderCard key={order.id} order={order} drivers={drivers} allOrders={orders} searchQuery={searchQuery} onEdit={setEditingOrder} onUpdateStatus={handleStatusUpdate} onUpdateEta={(id, eta) => updateOrder(id, { eta })} onDelete={deleteOrder} onAddToast={addToast} />))}</div>)}
        </div>
        </div>
      </main>
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-sky-100 px-8 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex justify-between items-center z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <button onClick={() => setViewMode('list')} className={`flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${viewMode === 'list' ? 'text-sky-600' : 'text-gray-300'}`}><Truck size={20} /><span className="text-[10px] font-bold">סידור</span></button>
        <button onClick={() => setViewMode('chat')} className={`flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${viewMode === 'chat' ? 'text-sky-600' : 'text-gray-300'}`}><MessageSquare size={20} /><span className="text-[10px] font-bold">נועה</span></button>
        <button onClick={() => setViewMode('drivers')} className={`flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${viewMode === 'drivers' ? 'text-sky-600' : 'text-gray-300'}`}><Users size={20} /><span className="text-[10px] font-bold">נהגים</span></button>
        <button onClick={() => setViewMode('reports')} className={`flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${viewMode === 'reports' ? 'text-sky-600' : 'text-gray-300'}`}><FileText size={20} /><span className="text-[10px] font-bold">דוחות</span></button>
      </div>
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm" dir="rtl">
        <AnimatePresence>{toasts.map(toast => (<motion.div key={toast.id} initial={{ opacity: 0, x: 20, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20, scale: 0.9 }} className="pointer-events-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-sky-100 p-4 flex gap-4 overflow-hidden relative"><div className={`w-1 absolute right-0 top-0 bottom-0 ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'warning' ? 'bg-sky-500' : 'bg-blue-500'}`} /><div className={`p-2 rounded-xl h-fit ${toast.type === 'success' ? 'bg-green-50' : toast.type === 'warning' ? 'bg-sky-50' : 'bg-blue-50'}`}>{toast.type === 'success' && <CheckCircle size={20} className="text-green-600" />}{toast.type === 'warning' && <AlertTriangle size={20} className="text-sky-600" />}{toast.type === 'info' && <Info size={20} className="text-blue-600" />}</div><div className="flex-1"><h4 className="font-black text-gray-900 text-sm mb-0.5">{toast.title}</h4><p className="text-gray-500 text-xs leading-relaxed">{toast.message}</p></div><button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button></motion.div>))}</AnimatePresence>
      </div>
    </div>
  );
};

// --- פונקציית האפליקציה הראשית שמנהלת את הניתוב ---
export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <Router>
      <Routes>
        {/* דף הבית - מציג את הסידור הראשי */}
        <Route path="/" element={<MainAppContent user={user!} installPrompt={installPrompt} />} />
        
        {/* דף המשתמש האישי - /harel, /oren וכו' */}
        <Route path="/:userKey" element={<UserApp />} />
        
        {/* ברירת מחדל חזרה לבית */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
