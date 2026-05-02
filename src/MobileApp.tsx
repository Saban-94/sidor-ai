import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  X, 
  Home, 
  Package, 
  Truck, 
  Users, 
  BarChart3, 
  Plus, 
  Bell, 
  Search, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useSync } from './providers/SyncManager';
import { ConnectionOrbit } from './components/ConnectionOrbit';
import { MobileOrderForm } from './components/MobileOrderForm';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, logout } from './lib/firebase';
import { Order, InventoryItem } from './types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const POWER_TILES = [
  { id: 'new_order', label: 'הזמנה חדשה', icon: Plus, color: 'bg-sky-600', textColor: 'text-white' },
  { id: 'stock', label: 'מלאי קריטי', icon: Package, color: 'bg-white', textColor: 'text-gray-900' },
  { id: 'tracking', label: 'מעקב נהגים', icon: Truck, color: 'bg-gray-900', textColor: 'text-white' },
  { id: 'ai_log', label: 'James AI Log', icon: Sparkles, color: 'bg-rose-50', textColor: 'text-rose-600' },
];

export const MobileApp: React.FC = () => {
  const { user } = useAuth();
  const { status } = useSync();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'orders' | 'stock' | 'customers' | 'ai_log'>('dashboard');
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Firestore Listeners
  useEffect(() => {
    if (!user) return;

    const qOrders = query(collection(db, 'orders'), orderBy('date', 'desc'), limit(20));
    const unsubscribeOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
      setLoading(false);
    });

    const qStock = query(collection(db, 'inventory'), orderBy('currentStock', 'asc'), limit(50));
    const unsubscribeStock = onSnapshot(qStock, (snap) => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[]);
    });

    const qCustomers = query(collection(db, 'customers'), orderBy('name', 'asc'), limit(100));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qAiLogs = query(collection(db, 'aura_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeAiLogs = onSnapshot(qAiLogs, (snap) => {
      setAiLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeStock();
      unsubscribeCustomers();
      unsubscribeAiLogs();
    };
  }, [user]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  if (!user) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col items-center justify-center p-8 text-center" dir="rtl">
        <div className="w-20 h-20 bg-sky-600 rounded-3xl mb-8 flex items-center justify-center shadow-2xl shadow-sky-600/20 overflow-hidden">
          <img 
            src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
            alt="Noa" 
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-4xl font-black text-white mb-2 italic tracking-tighter">סידור Admin</h1>
        <p className="text-gray-400 font-bold mb-12">המוח התפעולי של ח. סבן</p>
        <button 
          onClick={async () => {
            const { loginWithGoogle } = await import('./lib/firebase');
            await loginWithGoogle();
          }}
          className="w-full py-5 bg-white text-gray-900 rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all"
        >
          התחבר עם Google
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden font-sans select-none" dir="rtl">
      {/* Top Header */}
      <header className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-lg relative z-50">
        <div className="flex items-center gap-4">
          <button onClick={toggleSidebar} className="p-2 -mr-2 active:scale-90 transition-transform">
            <Menu size={28} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic tracking-tighter leading-none">סידור Mobile</h1>
            <span className="text-[10px] font-black tracking-widest text-sky-400 uppercase">נועה מחוברת ✅</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionOrbit />
          <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-white/10 overflow-hidden shadow-inner">
             {user.photoURL ? <img src={user.photoURL} alt="User" /> : <Users size={20} className="m-2" />}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-gray-50 pb-24 custom-scrollbar">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-8"
            >
              {/* Greeting */}
              <div className="mb-2">
                <p className="text-gray-400 font-bold text-sm">שלום, רמי 👋</p>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">היום בסינכרון</h2>
              </div>

              {/* Power Tiles Grid */}
              <div className="grid grid-cols-2 gap-4">
                {POWER_TILES.map((tile) => (
                  <motion.button
                    key={tile.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (tile.id === 'new_order') setIsOrderFormOpen(true);
                      else if (tile.id === 'stock') setCurrentView('stock');
                      else if (tile.id === 'tracking') setCurrentView('orders');
                      else if (tile.id === 'ai_log') setCurrentView('ai_log');
                    }}
                    className={`${tile.color} ${tile.textColor} p-6 rounded-[2.5rem] flex flex-col justify-between h-44 shadow-lg border border-black/5 text-right relative overflow-hidden`}
                  >
                    {tile.id === 'ai_log' && (
                      <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-rose-500 rounded-full blur-3xl animate-pulse" />
                      </div>
                    )}
                    <tile.icon size={28} className={tile.id === 'ai_log' ? 'animate-bounce' : ''} />
                    <div>
                      <p className="text-lg font-black leading-tight">{tile.label}</p>
                      <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">SabanOS Power</p>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Recent Orders Section */}
              <section className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <ClipboardList size={20} className="text-sky-600" />
                    הזמנות אחרונות
                  </h3>
                  <button onClick={() => setCurrentView('orders')} className="text-xs font-black text-sky-600 uppercase tracking-widest">הצג הכל</button>
                </div>
                
                {loading ? (
                   <div className="flex justify-center p-12"><Loader2 className="animate-spin text-sky-600" /></div>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0, 5).map((order) => (
                      <motion.div 
                        key={order.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center active:scale-[0.98] transition-transform"
                        onClick={() => setCurrentView('orders')}
                      >
                        <div className="flex gap-4 items-center overflow-hidden">
                           <div className="text-sm shrink-0">
                             {order.status === 'delivered' ? '✅' : 
                              order.status === 'ready' || order.status === 'loaded' ? '🚚' : 
                              order.status === 'preparing' ? '🛠️' : '🕒'}
                           </div>
                           <div className="overflow-hidden">
                              <p className="font-black text-gray-900 truncate">{order.customerName}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{order.destination}</p>
                           </div>
                        </div>
                        <ChevronLeft size={16} className="text-gray-300" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {currentView === 'stock' && (
            <motion.div 
              key="stock"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentView('dashboard')} className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <ChevronRight size={20} />
                </button>
                <h2 className="text-2xl font-black italic">ניהול מלאי</h2>
                <div className="w-10 h-10" />
              </div>

              <div className="relative mb-6">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder="חיפוש מהיר במלאי..."
                  className="w-full bg-white border-none rounded-2xl p-4 pr-12 text-sm font-bold shadow-sm outline-none"
                />
              </div>

              <div className="space-y-3">
                {inventory.map(item => (
                  <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-black text-gray-900">{item.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{item.sku}</p>
                    </div>
                    <div className="text-left">
                       <p className={`text-xl font-black ${item.currentStock <= (item.minStock || 5) ? 'text-rose-600' : 'text-sky-600'}`}>
                         {item.currentStock} <span className="text-[10px] uppercase">{item.unit || 'יח'}</span>
                       </p>
                       <p className="text-[10px] font-black text-gray-300 uppercase">זמין במחסן {item.category || 'ראשי'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {currentView === 'orders' && (
            <motion.div 
              key="orders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentView('dashboard')} className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <ChevronRight size={20} />
                </button>
                <h2 className="text-2xl font-black italic">ניהול הזמנות</h2>
                <div className="w-10 h-10" />
              </div>

              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="overflow-hidden">
                        <p className="font-black text-gray-900 leading-tight truncate">{order.customerName}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{order.destination}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${
                        order.status === 'delivered' ? 'bg-emerald-100 text-emerald-600' : 
                        order.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-600'
                      }`}>
                        <span>
                          {order.status === 'delivered' ? '✅' : 
                           order.status === 'preparing' ? '🛠️' : 
                           order.status === 'ready' || order.status === 'loaded' ? '🚚' : 
                           order.status === 'cancelled' ? '🛑' : '🕒'}
                        </span>
                        {order.status}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-4 text-[11px] font-bold text-gray-600 line-clamp-2">
                       {order.items}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <button 
                         onClick={async () => {
                           const newStatus = order.status === 'pending' ? 'loaded' : order.status === 'loaded' ? 'delivered' : 'pending';
                           const { updateOrder } = await import('./services/auraService');
                           await updateOrder(order.id!, { status: newStatus as any });
                         }}
                         className="py-3 bg-sky-50 text-sky-600 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-transform"
                       >
                         שנה סטטוס
                       </button>
                       <button className="py-3 bg-gray-50 text-gray-400 rounded-xl font-black text-[10px] uppercase">
                          פרטים נוספים
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {currentView === 'customers' && (
            <motion.div 
              key="customers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentView('dashboard')} className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <ChevronRight size={20} />
                </button>
                <h2 className="text-2xl font-black italic">מאגר לקוחות</h2>
                <div className="w-10 h-10" />
              </div>

              <div className="space-y-4">
                {customers.map(customer => (
                  <div key={customer.id} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600">
                          <Users size={24} />
                        </div>
                        <div>
                          <p className="font-black text-gray-900 leading-tight">{customer.name}</p>
                          <p className="text-xs text-gray-400 font-bold">{customer.phoneNumber || customer.phone}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">הזמנה אחרונה</p>
                      <p className="text-xs font-bold text-gray-600">
                        {customer.lastOrderAt ? format(customer.lastOrderAt.toDate(), 'PPP', { locale: he }) : 'אין נתונים'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {currentView === 'ai_log' && (
            <motion.div 
              key="ai_log"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 space-y-6"
            >
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentView('dashboard')} className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <ChevronRight size={20} />
                </button>
                <h2 className="text-2xl font-black italic text-rose-600">James AI Log</h2>
                <div className="w-10 h-10" />
              </div>

              <div className="space-y-3">
                {aiLogs.map(log => (
                  <div key={log.id} className="bg-white p-4 rounded-2xl border-r-4 border-rose-500 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-black text-gray-400 uppercase">
                         {log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss', { locale: he }) : ''}
                       </span>
                       <Sparkles size={14} className="text-rose-400" />
                    </div>
                    <p className="text-xs font-bold text-gray-800 leading-relaxed">{log.text || log.message}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
              className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100]"
            />
            <motion.aside 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-[80%] max-w-xs bg-gray-900 text-white z-[110] p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-12">
                <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center">
                  <Package size={24} />
                </div>
                <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>

              <nav className="flex-1 space-y-4">
                {[
                  { id: 'dashboard', label: 'דאשבורד ראשי', icon: Home },
                  { id: 'orders', label: 'ניהול הזמנות', icon: ClipboardList },
                  { id: 'stock', label: 'ניהול מלאי', icon: Package },
                  { id: 'customers', label: 'מאגר לקוחות', icon: Users },
                  { id: 'settings', label: 'הגדרות SabanOS', icon: Settings },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'settings') return;
                      if (item.id === 'admin_users') {
                         window.location.href = '/admin/users';
                         return;
                      }
                      setCurrentView(item.id as any);
                      toggleSidebar();
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl font-black transition-all ${
                      currentView === item.id ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="pt-8 border-t border-white/10">
                <button 
                  onClick={() => logout()}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl font-black text-rose-500 hover:bg-rose-500/10 transition-all"
                >
                  <X size={20} />
                  <span>התנתק מהמערכת</span>
                </button>
                <p className="text-[10px] font-bold text-gray-600 text-center mt-6 tracking-widest uppercase">
                  סידור v3.5 Enterprise | נועה ❤️
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Global FAB (Floating Action Button) */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOrderFormOpen(true)}
        className="fixed bottom-8 left-8 w-16 h-16 bg-sky-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 border-4 border-white active:bg-sky-700 transition-colors"
      >
        <Plus size={32} />
      </motion.button>

      {/* Forms */}
      <MobileOrderForm 
        isOpen={isOrderFormOpen} 
        onClose={() => setIsOrderFormOpen(false)} 
        inventory={inventory}
        onSuccess={() => {}}
      />
    </div>
  );
};
