import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  X, 
  Home, 
  Package, 
  Truck, 
  Users, 
  Plus, 
  Bell, 
  Search, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  ClipboardList,
  MessageSquare,
  Phone,
  Send,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useSync } from './providers/SyncManager';
import { ConnectionOrbit } from './components/ConnectionOrbit';
import { MobileOrderForm } from './components/MobileOrderForm';
import { WhatsAppPreviewModal } from './components/WhatsAppPreviewModal';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, logout } from './lib/firebase';
import { Order, InventoryItem, Customer } from './types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { parseDate } from './lib/utils';
import { updateOrder } from './services/auraService';
import { NoaChat } from './components/NoaChat';
import { useToast } from './providers/ToastProvider';

const POWER_TILES = [
  { id: 'new_order', label: 'הזמנה חדשה', icon: Plus, color: 'bg-sky-600', textColor: 'text-white' },
  { id: 'stock', label: 'מלאי קריטי', icon: Package, color: 'bg-slate-900', textColor: 'text-white' },
  { id: 'tracking', label: 'מעקב נהגים', icon: Truck, color: 'bg-amber-500', textColor: 'text-slate-950' },
  { id: 'chat', label: 'נועה AI בצ׳אט', icon: Sparkles, color: 'bg-emerald-600', textColor: 'text-white' },
];

export const MobileApp: React.FC = () => {
  const { user } = useAuth();
  const { status } = useSync();
  const { addToast } = useToast();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'orders' | 'stock' | 'customers' | 'chat' | 'ai_log'>('dashboard');
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  
  // WhatsApp Modal State
  const [whatsAppModal, setWhatsAppModal] = useState<{
    isOpen: boolean;
    customerName?: string;
    phone?: string;
    message?: string;
  }>({ isOpen: false });

  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'on_the_way' | 'delivered'>('all');
  const [stockSearch, setStockSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Noa Chat state
  const [chatHistory, setChatHistory] = useState<any[]>([
    {
      role: 'model',
      text: 'שלום! אני נועה, המוח התפעולי של ח. סבן. איך אוכל לסייע לך בסידור או במלאי היום?',
      timestamp: new Date().toISOString()
    }
  ]);

  // Firestore Listeners
  useEffect(() => {
    if (!user) return;

    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
      setLoading(false);
    }, (err) => console.warn("Orders listener warning:", err));

    const qStock = query(collection(db, 'inventory'), orderBy('currentStock', 'asc'), limit(100));
    const unsubscribeStock = onSnapshot(qStock, (snap) => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[]);
    }, (err) => console.warn("Inventory listener warning:", err));

    const qCustomers = query(collection(db, 'customers'), orderBy('name', 'asc'), limit(100));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[]);
    }, (err) => console.warn("Customers listener warning:", err));

    const qAiLogs = query(collection(db, 'aura_logs'), orderBy('timestamp', 'desc'), limit(30));
    const unsubscribeAiLogs = onSnapshot(qAiLogs, (snap) => {
      setAiLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn("Aura logs listener warning:", err));

    return () => {
      unsubscribeOrders();
      unsubscribeStock();
      unsubscribeCustomers();
      unsubscribeAiLogs();
    };
  }, [user]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleNoaAction = async (promptText: string) => {
    if (!promptText.trim()) return;

    const userMsg = { role: 'user', text: promptText, timestamp: new Date().toISOString() };
    setChatHistory(prev => [...prev, userMsg]);

    try {
      const { askNoa } = await import('./services/auraService');
      const response = await askNoa(promptText, chatHistory);
      
      const botMsg = {
        role: 'model',
        text: typeof response === 'string' ? response : (response?.text || response?.message || 'בקשתך עובדה בהצלחה על ידי נועה.'),
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg = {
        role: 'model',
        text: `אירעה שגיאה בעיבוד הבקשה: ${err.message || 'תקלת תקשורת'}`,
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, errorMsg]);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white" dir="rtl">
        <div className="w-24 h-24 bg-sky-600/20 border-2 border-sky-500/50 rounded-3xl mb-6 flex items-center justify-center shadow-2xl shadow-sky-600/30 overflow-hidden relative">
          <img 
            src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
            alt="נועה" 
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-3xl font-black mb-1 italic tracking-tight">סידור | נועה Mobile</h1>
        <p className="text-xs font-bold text-slate-400 mb-8">המערכת המבצעית של ח. סבן חומרי בניין</p>
        
        <button 
          onClick={async () => {
            const { loginWithGoogle } = await import('./lib/firebase');
            await loginWithGoogle();
          }}
          className="w-full max-w-xs py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          <span>התחברות עם גוגל</span>
        </button>

        <div className="mt-12 text-[11px] text-slate-500 font-bold">
          באדיבות נועה ❤️ | גרסה v64 Precision
        </div>
      </div>
    );
  }

  // Filtered Orders
  const filteredOrders = orders.filter(o => {
    const matchSearch = orderSearch === '' || 
      (o.customerName && o.customerName.toLowerCase().includes(orderSearch.toLowerCase())) ||
      (o.destination && o.destination.toLowerCase().includes(orderSearch.toLowerCase())) ||
      (o.items && o.items.toLowerCase().includes(orderSearch.toLowerCase()));
    const matchStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
    return matchSearch && matchStatus;
  });

  // Filtered Stock
  const filteredStock = inventory.filter(i => 
    stockSearch === '' || 
    (i.name && i.name.toLowerCase().includes(stockSearch.toLowerCase())) ||
    (i.sku && i.sku.toLowerCase().includes(stockSearch.toLowerCase()))
  );

  // Filtered Customers
  const filteredCustomers = customers.filter(c => 
    customerSearch === '' ||
    (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase())) ||
    (c.phone && c.phone.includes(customerSearch)) ||
    (c.phoneNumber && c.phoneNumber.includes(customerSearch))
  );

  return (
    <div className="min-h-[100dvh] max-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans select-none" dir="rtl">
      
      {/* HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex justify-between items-center shrink-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleSidebar} 
            className="p-2.5 bg-slate-800 text-slate-200 hover:text-white rounded-xl active:scale-90 transition-transform"
            aria-label="תפריט"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl border border-amber-500/40 overflow-hidden shrink-0">
              <img 
                src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                alt="נועה" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-black italic tracking-tight text-white leading-none">ח.סבן | נועה</h1>
              <span className="text-[10px] font-extrabold text-emerald-400 mt-0.5">נועה | מחוברת ✅</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ConnectionOrbit />
          <button 
            onClick={() => setCurrentView('ai_log')}
            className="p-2 bg-slate-800 text-rose-400 rounded-xl hover:bg-slate-700 transition-colors relative"
            title="יומן AI"
          >
            <Sparkles size={18} />
            {aiLogs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            )}
          </button>
        </div>
      </header>

      {/* MAIN VIEW CONTENT CONTAINER */}
      <main className="flex-1 overflow-y-auto relative bg-slate-950 p-4 pb-28 custom-scrollbar">
        <AnimatePresence mode="wait">
          
          {/* DASHBOARD VIEW */}
          {currentView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              {/* Greeting */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl border border-slate-800 flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-xs font-bold text-slate-400">שלום, {user.displayName || 'משתמש'}</p>
                  <h2 className="text-xl font-black text-amber-400">מרכז השליטה של נועה</h2>
                  <p className="text-[11px] text-slate-400 mt-1">מערכת תפעול ומלאי בזמן אמת</p>
                </div>
                <div className="text-left shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black">
                    {orders.filter(o => o.status === 'pending').length} ממתינות
                  </span>
                </div>
              </div>

              {/* Power Tiles Grid */}
              <div className="grid grid-cols-2 gap-3">
                {POWER_TILES.map((tile) => (
                  <motion.button
                    key={tile.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (tile.id === 'new_order') setIsOrderFormOpen(true);
                      else if (tile.id === 'stock') setCurrentView('stock');
                      else if (tile.id === 'tracking') setCurrentView('orders');
                      else if (tile.id === 'chat') setCurrentView('chat');
                    }}
                    className={`${tile.color} ${tile.textColor} p-4 rounded-2xl flex flex-col justify-between h-32 shadow-md border border-white/10 text-right active:opacity-90 transition-all`}
                  >
                    <tile.icon size={24} />
                    <div>
                      <p className="text-sm font-black leading-tight">{tile.label}</p>
                      <p className="text-[9px] font-extrabold opacity-70 uppercase tracking-widest mt-0.5">Saban Precision</p>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Quick KPI Overview */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                  <p className="text-[10px] text-slate-400 font-bold">סה״כ הזמנות</p>
                  <p className="text-lg font-black text-white mt-0.5">{orders.length}</p>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                  <p className="text-[10px] text-slate-400 font-bold">בדרך לאספקה</p>
                  <p className="text-lg font-black text-sky-400 mt-0.5">{orders.filter(o => o.status === 'on_the_way').length}</p>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                  <p className="text-[10px] text-slate-400 font-bold">סופקו היום</p>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">{orders.filter(o => o.status === 'delivered').length}</p>
                </div>
              </div>

              {/* Recent Orders Section */}
              <section className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
                    <ClipboardList size={18} className="text-sky-400" />
                    הזמנות אחרונות
                  </h3>
                  <button 
                    onClick={() => setCurrentView('orders')} 
                    className="text-xs font-bold text-sky-400 hover:underline"
                  >
                    הצג הכל ({orders.length})
                  </button>
                </div>

                {loading ? (
                  <div className="flex justify-center p-8"><Loader2 className="animate-spin text-sky-400" /></div>
                ) : (
                  <div className="space-y-2.5">
                    {orders.slice(0, 5).map((order) => (
                      <div 
                        key={order.id}
                        className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex justify-between items-center shadow-sm active:bg-slate-850 transition-colors"
                      >
                        <div className="overflow-hidden space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white text-sm truncate">{order.customerName}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                              order.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              order.status === 'on_the_way' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {order.status === 'delivered' ? 'סופק' : order.status === 'on_the_way' ? 'בדרך' : 'ממתין'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate">{order.destination || 'ללא כתובת'}</p>
                          <p className="text-[11px] text-slate-300 font-mono line-clamp-1">{order.items}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 mr-2">
                          <button 
                            onClick={() => setWhatsAppModal({
                              isOpen: true,
                              customerName: order.customerName,
                              phone: order.customerPhone || order.phone || '0501234567',
                              message: `שלום ${order.customerName}, עדכון לגבי הזמנתך: ${order.items}`
                            })}
                            className="p-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-600/30 active:scale-95 transition-all"
                            title="שלח ווטסאפ"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </motion.div>
          )}

          {/* ORDERS VIEW */}
          {currentView === 'orders' && (
            <motion.div 
              key="orders"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <ClipboardList className="text-sky-400" size={20} />
                  <span>ניהול הזמנות ({filteredOrders.length})</span>
                </h2>
                <button 
                  onClick={() => setIsOrderFormOpen(true)}
                  className="px-3 py-1.5 bg-sky-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                >
                  <Plus size={16} />
                  <span>חדשה</span>
                </button>
              </div>

              {/* Search & Filter Controls */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="חיפוש לפי לקוח, יעד או מוצרים..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-sky-500"
                  />
                  {orderSearch && (
                    <button 
                      onClick={() => setOrderSearch('')} 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  {[
                    { id: 'all', label: 'הכל' },
                    { id: 'pending', label: 'ממתינות' },
                    { id: 'on_the_way', label: 'בדרך' },
                    { id: 'delivered', label: 'סופקו' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setOrderStatusFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        orderStatusFilter === tab.id 
                          ? 'bg-sky-600 text-white' 
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orders List */}
              <div className="space-y-3">
                {filteredOrders.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
                    <p className="text-sm font-bold">לא נמצאו הזמנות תואמות</p>
                  </div>
                ) : (
                  filteredOrders.map(order => (
                    <div 
                      key={order.id} 
                      className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-md"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-black text-white text-base">{order.customerName}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{order.destination}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                          order.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          order.status === 'on_the_way' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {order.status === 'delivered' ? 'סופק' : order.status === 'on_the_way' ? 'בדרך' : 'ממתין'}
                        </span>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs font-bold text-slate-300">
                        {order.items}
                      </div>

                      <div className="flex items-center justify-between pt-1 gap-2">
                        <button 
                          onClick={async () => {
                            const nextStatus = order.status === 'pending' ? 'on_the_way' : order.status === 'on_the_way' ? 'delivered' : 'pending';
                            await updateOrder(order.id!, { status: nextStatus as any });
                            addToast('סטטוס עודכן', `הזמנת ${order.customerName} שונתה ל-${nextStatus}`, 'success');
                          }}
                          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                        >
                          <RefreshCw size={14} />
                          <span>עדכן סטטוס</span>
                        </button>

                        <button 
                          onClick={() => setWhatsAppModal({
                            isOpen: true,
                            customerName: order.customerName,
                            phone: order.customerPhone || order.phone || '0501234567',
                            message: `עדכון לגבי הזמנה: ${order.items}`
                          })}
                          className="py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-xl flex items-center gap-1 transition-all"
                        >
                          <Send size={14} />
                          <span>ווטסאפ</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* STOCK VIEW */}
          {currentView === 'stock' && (
            <motion.div 
              key="stock"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Package className="text-amber-400" size={20} />
                  <span>מלאי ומחסן ({filteredStock.length})</span>
                </h2>
              </div>

              <div className="relative">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="חיפוש פריט לפי שם או מק״ט..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-2.5">
                {filteredStock.map(item => (
                  <div key={item.id} className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex justify-between items-center shadow-sm">
                    <div>
                      <p className="font-black text-white text-sm">{item.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">מק״ט: {item.sku || 'ללא'}</p>
                    </div>

                    <div className="text-left shrink-0">
                      <span className={`text-base font-black ${
                        item.currentStock <= (item.minStock || 5) ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {item.currentStock} {item.unit || 'יח׳'}
                      </span>
                      {item.currentStock <= (item.minStock || 5) && (
                        <p className="text-[9px] font-bold text-rose-400 flex items-center gap-0.5 justify-end mt-0.5">
                          <AlertTriangle size={10} />
                          <span>מלאי נמוך</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* CUSTOMERS / CRM VIEW */}
          {currentView === 'customers' && (
            <motion.div 
              key="customers"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Users className="text-sky-400" size={20} />
                  <span>ניהול לקוחות CRM ({filteredCustomers.length})</span>
                </h2>
              </div>

              <div className="relative">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="חיפוש לקוח לפי שם או טלפון..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-2.5">
                {filteredCustomers.map(customer => (
                  <div key={customer.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-white text-base">{customer.name}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{customer.phone || customer.phoneNumber || 'ללא טלפון'}</p>
                      </div>

                      <div className="flex gap-2">
                        {customer.phone && (
                          <a 
                            href={`tel:${customer.phone}`}
                            className="p-2 bg-slate-800 text-sky-400 rounded-xl hover:bg-slate-700 active:scale-95 transition-all"
                            title="חייג"
                          >
                            <Phone size={16} />
                          </a>
                        )}
                        <button 
                          onClick={() => setWhatsAppModal({
                            isOpen: true,
                            customerName: customer.name,
                            phone: customer.phone || customer.phoneNumber || '0501234567',
                            message: `שלום ${customer.name}, הודעה מח. סבן חומרי בניין:`
                          })}
                          className="p-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl active:scale-95 transition-all"
                          title="ווטסאפ"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl">
                      <span>סה״כ הזמנות: <strong className="text-white">{customer.totalOrders || 0}</strong></span>
                      <button 
                        onClick={() => {
                          setIsOrderFormOpen(true);
                        }}
                        className="text-sky-400 font-bold hover:underline"
                      >
                        + הזמנה חדשה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* NOA AI CHAT VIEW */}
          {currentView === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-[calc(100dvh-130px)] flex flex-col"
            >
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Sparkles className="text-amber-400 animate-pulse" size={20} />
                  <span>נועה AI | עוזרת תפעול</span>
                </h2>
              </div>

              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                <NoaChat 
                  chatHistory={chatHistory}
                  onBack={() => setCurrentView('dashboard')}
                  onAction={handleNoaAction}
                  orders={orders}
                  isPopup={false}
                />
              </div>
            </motion.div>
          )}

          {/* AI LOG VIEW */}
          {currentView === 'ai_log' && (
            <motion.div 
              key="ai_log"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-rose-400 flex items-center gap-2">
                  <Sparkles size={20} />
                  <span>יומן אירועים - James AI Log</span>
                </h2>
              </div>

              <div className="space-y-2">
                {aiLogs.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
                    אין אירועי AI רשומים
                  </div>
                ) : (
                  aiLogs.map(log => (
                    <div key={log.id} className="bg-slate-900 p-3.5 rounded-xl border-r-4 border-rose-500 shadow-sm text-xs space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <span>{log.timestamp ? format(parseDate(log.timestamp), 'HH:mm:ss', { locale: he }) : 'עכשיו'}</span>
                        <span className="text-rose-400 font-bold">Aura Log</span>
                      </div>
                      <p className="font-bold text-slate-200">{log.text || log.message || JSON.stringify(log)}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Mandatory Signature Footer */}
        <div className="signature text-center text-xs py-3 text-slate-500 font-bold mt-4">
          באדיבות נועה ❤️
        </div>
      </main>

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-50 px-3 py-2 flex justify-around items-center">
        {[
          { id: 'dashboard', label: 'ראשי', icon: Home },
          { id: 'orders', label: 'הזמנות', icon: ClipboardList },
          { id: 'stock', label: 'מלאי', icon: Package },
          { id: 'customers', label: 'CRM', icon: Users },
          { id: 'chat', label: 'נועה AI', icon: MessageSquare },
        ].map((navItem) => {
          const Icon = navItem.icon;
          const isActive = currentView === navItem.id;
          return (
            <button
              key={navItem.id}
              onClick={() => setCurrentView(navItem.id as any)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all min-h-[48px] ${
                isActive 
                  ? 'text-sky-400 font-black scale-105' 
                  : 'text-slate-400 font-bold hover:text-slate-200'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] mt-1">{navItem.label}</span>
            </button>
          );
        })}
      </nav>

      {/* FLOATING ACTION BUTTON (FAB) FOR NEW ORDER */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOrderFormOpen(true)}
        className="fixed bottom-20 left-5 w-14 h-14 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full shadow-2xl flex items-center justify-center z-50 border-2 border-slate-900 active:scale-95 transition-transform"
        aria-label="הזמנה חדשה"
      >
        <Plus size={28} strokeWidth={3} />
      </motion.button>

      {/* NOA SIDEBAR DRAWER */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]"
            />
            <motion.aside 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-[82%] max-w-xs bg-slate-900 border-l border-slate-800 text-white z-[110] p-6 flex flex-col justify-between shadow-2xl"
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl border-2 border-amber-500/50 overflow-hidden shadow-lg">
                      <img 
                        src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                        alt="נועה" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-base">נועה</h3>
                      <p className="text-[10px] font-extrabold text-emerald-400">מחוברת ✅ (v64)</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleSidebar} 
                    className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                  >
                    <X size={22} />
                  </button>
                </div>

                <nav className="space-y-1.5">
                  {[
                    { id: 'dashboard', label: 'ראשי | דאשבורד', icon: Home },
                    { id: 'orders', label: 'ניהול הזמנות', icon: ClipboardList },
                    { id: 'stock', label: 'ניהול מלאי', icon: Package },
                    { id: 'customers', label: 'מאגר לקוחות CRM', icon: Users },
                    { id: 'chat', label: 'נועה AI בצ׳אט', icon: MessageSquare },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id as any);
                        toggleSidebar();
                      }}
                      className={`w-full flex items-center gap-3.5 p-3 rounded-xl text-xs font-black transition-all ${
                        currentView === item.id 
                          ? 'bg-sky-600 text-white shadow-md' 
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-3">
                <button 
                  onClick={() => logout()}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-black text-rose-400 hover:bg-rose-500/10 transition-all"
                >
                  <X size={18} />
                  <span>התנתק מהמערכת</span>
                </button>
                <div className="text-center text-[10px] font-bold text-slate-500">
                  באדיבות נועה ❤️ | ח. סבן
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MOBILE ORDER FORM MODAL */}
      <MobileOrderForm 
        isOpen={isOrderFormOpen} 
        onClose={() => setIsOrderFormOpen(false)} 
        inventory={inventory}
        onSuccess={() => {
          setIsOrderFormOpen(false);
          addToast('הזמנה נוצרה', 'ההזמנה התווספה בהצלחה למערכת', 'success');
        }}
      />

      {/* WHATSAPP PREVIEW MODAL */}
      <WhatsAppPreviewModal 
        isOpen={whatsAppModal.isOpen}
        onClose={() => setWhatsAppModal({ isOpen: false })}
        customerName={whatsAppModal.customerName}
        recipientPhone={whatsAppModal.phone}
        initialMessage={whatsAppModal.message}
        onAddToast={addToast}
      />

    </div>
  );
};
