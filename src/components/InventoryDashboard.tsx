import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Search, 
  Edit3, 
  Trash2, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  User,
  Calendar,
  Image as ImageIcon,
  ChevronRight,
  ArrowRight,
  ShoppingCart,
  Building2,
  Box,
  ExternalLink,
  BarChart3,
  List as ListIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  where,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { InventoryItem, SaleRecord, Order } from '../types';
import { calculateInventoryStats } from '../lib/inventoryUtils';
import { InventoryAnalytics } from './InventoryAnalytics';
import { UIModal } from './UIModal';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface InventoryDashboardProps {
  orders?: Order[];
  onViewOrder?: (orderId: string) => void;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ orders = [], onViewOrder }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'inventory' | 'analytics'>('inventory');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    // Inventory listener
    const qItems = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[];
      setItems(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    // Sales listener (last 100 records for the dashboard insights)
    const qSales = query(collection(db, 'sales'), orderBy('date', 'desc'), limit(100));
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SaleRecord[];
      setSales(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    return () => {
      unsubscribeItems();
      unsubscribeSales();
    };
  }, []);

  // Use the utility to calculate stats
  const { topProducts, allStats } = useMemo(() => 
    calculateInventoryStats(items, sales), 
  [items, sales]);

  const filteredItems = allStats.filter(item => {
    const name = item?.name || "";
    const sku = item?.sku || "";
    const category = item?.category || "";
    const query = searchQuery || "";
    return (
      name.toLowerCase().includes(query.toLowerCase()) ||
      sku.toLowerCase().includes(query.toLowerCase()) ||
      category.toLowerCase().includes(query.toLowerCase())
    );
  });

  const handleQuickUpdate = async (id: string, newValue: number) => {
    try {
      await updateDoc(doc(db, 'inventory', id), {
        currentStock: newValue,
        updatedAt: serverTimestamp()
      });
      setEditingItemId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory');
    }
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setModalOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'inventory', itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'inventory');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32" dir="rtl">
        <Loader2 className="animate-spin text-sky-600 mb-4" size={48} />
        <p className="text-gray-500 font-bold">נועה מרעננת את המלאי... רק רגע ❤️</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir="rtl">
      {/* 1. Header & Tab Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Package className="text-sky-600" size={32} />
            ניהול מלאי חכם
          </h2>
          <p className="text-slate-500 font-medium mt-1">סקירה מלאה של תנועות מלאי וביצועי מכירות</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'inventory' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ListIcon size={18} />
            רשימת מלאי
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'analytics' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <BarChart3 size={18} />
            אנליטיקה
          </button>
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <InventoryAnalytics />
      ) : (
        <>
          {/* 2. Top Selling Section (Hot Products) */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2 px-2">
              <TrendingUp className="text-orange-500" size={20} />
              <h3 className="text-lg font-black text-slate-800">המוצרים החמים (Top Selling)</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {topProducts.map((p, idx) => (
                <motion.div 
                  key={p.sku}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-sky-500" />
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <p className="text-[10px] font-black text-sky-600 uppercase tracking-wider mb-1">Rank #{idx + 1}</p>
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{p.name}</h4>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div className="text-slate-400">
                        <span className="text-xs">נמכרו:</span>
                        <p className="text-xl font-black text-slate-900">{p.totalSold}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-600">
                        <ShoppingCart size={14} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {topProducts.length === 0 && (
                <div className="col-span-full py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 font-medium">
                  נתונים יופיעו לאחר ביצוע מכירות ראשונות 🚜
                </div>
              )}
            </div>
          </section>

          {/* 3. Recent Project Movements (Cards) */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2 px-2">
              <Building2 className="text-sky-600" size={20} />
              <h3 className="text-lg font-black text-slate-800">תנועות פרויקטים אחרונות</h3>
            </div>
            <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide snap-x">
              {sales.slice(0, 8).map((sale, idx) => (
                <motion.div 
                  key={sale.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="min-w-[280px] bg-sky-600 rounded-[2.5rem] p-6 text-white shadow-xl shadow-sky-600/20 snap-start flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-white/20 p-2 rounded-xl">
                        <Building2 size={24} />
                      </div>
                      <span className="bg-white text-sky-600 text-[10px] font-black px-2 py-1 rounded-full uppercase">
                        Sale #{sale.id?.slice(-4)}
                      </span>
                    </div>
                    <h4 className="text-xl font-black mb-1 truncate">{sale.customerName}</h4>
                    <p className="text-sky-100 text-xs font-medium flex items-center gap-1">
                      <Package size={12} /> {sale.itemName || sale.itemId}
                    </p>
                  </div>
                  
                  <div className="mt-8 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-sky-200 uppercase font-bold tracking-widest">כמות שיצאה</p>
                      <p className="text-2xl font-black">{sale.quantity}</p>
                    </div>
                    {sale.orderId && (
                      <button 
                        onClick={() => onViewOrder?.(sale.orderId!)}
                        className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white text-white hover:text-sky-600 transition-all flex items-center justify-center border border-white/20 shadow-lg"
                      >
                        <ExternalLink size={18} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
              {sales.length === 0 && (
                <div className="w-full py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 font-medium">
                  ממתינים לתנועות מלאי ראשונות בשטח... 🚚
                </div>
              )}
            </div>
          </section>

          {/* 4. Modern Inventory Table */}
          <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="חפש לפי שם מוצר, מק'ט או קטגוריה..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50/80 border-none rounded-2xl py-3 pr-12 pl-4 text-sm focus:ring-2 focus:ring-sky-600 outline-none transition-all font-medium"
                />
              </div>
              <div className="flex items-center gap-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <span>מציג {filteredItems.length} מוצרים</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-md">
                  <tr className="border-b border-slate-100 italic">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">תמונה</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">מוצר</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">מק"ט</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">מלאי נוכחי</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">מלאי שיצא</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">מינימום</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">סטטוס</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <AnimatePresence mode="popLayout">
                    {filteredItems.map((item) => (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={item.id} 
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm">
                            {item.imageUrl ? (
                              <img 
                                src={item.imageUrl.startsWith('http:') ? item.imageUrl.replace('http:', 'https:') : item.imageUrl} 
                                alt={item.name} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=?';
                                }}
                              />
                            ) : (
                              <ImageIcon className="text-slate-300" size={20} />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-black text-slate-900">{item.name}</p>
                            {item.description && (
                              <p className="text-[10px] text-slate-400 font-medium line-clamp-1 max-w-[180px]" title={item.description}>
                                {item.description}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{item.category || 'ללא קטגוריה'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {item.sku}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {editingItemId === item.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <input 
                                type="number" 
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(Number(e.target.value))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleQuickUpdate(item.id!, editValue);
                                  if (e.key === 'Escape') setEditingItemId(null);
                                }}
                                className="w-16 bg-white border border-sky-300 rounded-lg px-2 py-1 text-center text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none"
                              />
                              <button onClick={() => handleQuickUpdate(item.id!, editValue)} className="text-emerald-600 hover:scale-110 transition-transform">
                                <CheckCircle2 size={18} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className={`text-base font-black ${item.currentStock <= item.minStock ? 'text-rose-600' : 'text-slate-900'}`}>
                                {item.currentStock}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">{item.unit}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-base font-black text-sky-600">
                              {item.totalSold}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold tracking-tight">כמות שיצאה</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-bold text-slate-300 italic">{item.minStock}</span>
                        </td>
                        <td className="px-6 py-4">
                          {item.currentStock <= 0 ? (
                            <span className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center justify-center gap-1 w-fit border border-rose-100">
                              <AlertTriangle size={12} />
                              חסר במלאי
                            </span>
                          ) : item.currentStock <= item.minStock ? (
                            <span className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center justify-center gap-1 w-fit border border-amber-100">
                              <AlertTriangle size={12} />
                              מלאי נמוך
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center justify-center gap-1 w-fit border border-emerald-100">
                              <CheckCircle2 size={12} />
                              במלאי
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button 
                              onClick={() => {
                                setEditingItemId(item.id!);
                                setEditValue(item.currentStock);
                              }}
                              className="p-2.5 bg-slate-50 hover:bg-sky-50 text-slate-400 hover:text-sky-600 rounded-xl transition-all"
                              title="עריכה מהירה"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={() => confirmDelete(item.id!)}
                              className="p-2.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
                              title="מחיקה"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      
      <UIModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="מחיקת מוצר"
        message="האם אתה בטוח שברצונך למחוק מוצר זה מהמלאי? פעולה זו אינה ניתנת לביטול."
        type="confirm"
        onConfirm={handleDeleteItem}
        confirmText="כן, מחק מוצר"
        cancelText="לא, חזור"
      />
    </div>
  );
};
