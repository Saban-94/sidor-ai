import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  History, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpDown,
  Filter,
  Download,
  X,
  CheckCircle2,
  Loader2,
  User,
  Calendar,
  Image as ImageIcon,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  where,
  getDocs 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { InventoryItem, SaleRecord, Order } from '../types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { parseItems } from '../lib/utils';
import { UIModal } from './UIModal';
import { useToast } from '../providers/ToastProvider';
import { useSync } from '../providers/SyncManager';
import { Avatar } from './Avatar';
import { InventorySlideOver } from './InventorySlideOver';
import { Cloud, RefreshCw } from 'lucide-react';

interface InventoryManagerProps {
  orders?: Order[];
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ orders = [] }) => {
  const { addToast } = useToast();
  const { syncInventoryNow, status } = useSync();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales'>('inventory');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, title: string, message: string, type: 'alert'|'confirm', onConfirm?: () => void}>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  useEffect(() => {
    const qItems = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[];
      setItems(docs);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'inventory');
      }
    });

    const qSales = query(collection(db, 'sales'), orderBy('date', 'desc'));
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SaleRecord[];
      setSales(docs.slice(0, 50)); // Show last 50 sales
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'sales');
      }
    });

    return () => {
      unsubscribeItems();
      unsubscribeSales();
    };
  }, []);


  const handleDeleteItem = async (id: string) => {
    setModalConfig({
      isOpen: true,
      title: 'מחיקת מוצר',
      message: 'האם אתה בטוח שברצונך למחוק מוצר זה?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'inventory', id));
          addToast('מחיקה הושלמה', 'המוצר הוסר לצמיתות מהמערכת ✅', 'success');
          setModalConfig(prev => ({ ...prev, isOpen: false }));
          setIsAddingItem(false);
          setEditingItem(null);
        } catch (error) {
          console.error("Error deleting item:", error);
        }
      }
    });
  };

  const getItemDemand = (sku: string) => {
    return orders
      .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
      .reduce((acc, order) => {
        const orderItems = parseItems(order.items);
        const item = orderItems.find(i => i.sku === sku);
        return acc + (item ? parseInt(item.quantity) || 1 : 0);
      }, 0);
  };

  const filteredItems = items.filter(item => {
    const name = item?.name || "";
    const sku = item?.sku ? String(item.sku) : "";
    const category = item?.category || "";
    const query = searchQuery || "";
    return (
      name.toLowerCase().includes(query.toLowerCase()) ||
      sku.toLowerCase().includes(query.toLowerCase()) ||
      category.toLowerCase().includes(query.toLowerCase())
    );
  });

  const filteredSales = sales.filter(sale => {
    const searchLower = salesSearchQuery.toLowerCase();
    const inventoryItem = items.find(i => i.sku === sale.itemId);
    const itemName = inventoryItem ? inventoryItem.name : (sale.itemName || '');
    
    return (
      (sale?.customerName || "").toLowerCase().includes(searchLower) ||
      (sale?.date || "").includes(searchLower) ||
      (sale?.itemId || "").toLowerCase().includes(searchLower) ||
      (itemName || "").toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-gray-100 p-1.5 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'inventory' ? 'bg-white shadow-md text-sky-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package size={18} />
            ניהול מוצרים
          </button>
          <button 
            onClick={() => setActiveTab('sales')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'sales' ? 'bg-white shadow-md text-sky-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History size={18} />
            היסטוריית מכירות
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => syncInventoryNow()}
            disabled={status === 'syncing'}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold bg-white border border-sky-100 text-sky-600 shadow-sm hover:bg-sky-50 transition-all disabled:opacity-50"
          >
            {status === 'syncing' ? <RefreshCw size={18} className="animate-spin" /> : <Cloud size={18} />}
            סנכרן מלאי לגליון
          </button>

          <button 
            onClick={() => setIsAddingItem(true)}
            className="bg-sky-600 text-white flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg shadow-sky-600/20 hover:scale-105 transition-transform"
          >
            <Plus size={20} />
            הוסף מוצר למאגר
          </button>
        </div>
      </div>

      {activeTab === 'inventory' ? (
        <>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="חפש לפי שם מוצר, מק'ט או קטגוריה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-2xl py-4 pr-12 pl-4 text-sm focus:ring-2 focus:ring-sky-600 outline-none shadow-sm transition-all"
            />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-sky-100 shadow-sm flex items-center gap-4">
              <div className="bg-sky-50 p-4 rounded-2xl text-sky-600">
                <Package size={28} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">סה"כ מוצרים</p>
                <p className="text-2xl font-black text-gray-900">{items.length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex items-center gap-4">
              <div className="bg-rose-50 p-4 rounded-2xl text-rose-600">
                <AlertTriangle size={28} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">מלאי נמוך</p>
                <p className="text-2xl font-black text-rose-600">{items.filter(i => i.currentStock <= i.minStock).length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm flex items-center gap-4">
              <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600">
                <TrendingUp size={28} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">נמכרו החודש</p>
                <p className="text-2xl font-black text-emerald-600">{sales.length}</p>
              </div>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right" dir="rtl">
                <thead>
                  <tr className="border-b border-slate-100 italic">
                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest text-right">תמונה</th>
                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest text-right">מוצר</th>
                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest text-right">מק"ט</th>
                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest text-right">קטגוריה</th>
                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest text-right whitespace-nowrap">מחיר (₪)</th>
                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest text-center">ניהול</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <Loader2 className="animate-spin mx-auto text-indigo-600" size={32} />
                        <p className="text-slate-400 mt-2 font-bold">טוען מוצרים...</p>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <Package className="mx-auto text-slate-200 mb-4" size={48} />
                        <h4 className="text-lg font-bold text-slate-400">לא נמצאו מוצרים תואמים</h4>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => (
                      <motion.tr 
                        key={item.id} 
                        layoutId={item.id}
                        onClick={() => {
                          setEditingItem(item);
                          setIsAddingItem(true);
                        }}
                        className="group hover:bg-slate-50/80 cursor-pointer transition-all duration-200"
                      >
                        <td className="px-6 py-4">
                          <Avatar 
                            src={item.imageUrl} 
                            name={item.name} 
                            size="sm" 
                            className="ring-2 ring-white shadow-sm group-hover:ring-indigo-100 transition-all" 
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-slate-800 font-black text-sm">{item.name}</span>
                            {item.description && (
                              <span className="text-[10px] text-slate-400 font-medium line-clamp-1 max-w-[200px]" title={item.description}>
                                {item.description}
                              </span>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-black uppercase tracking-tighter ${
                                item.currentStock === 0 ? 'text-rose-500' : 
                                item.currentStock <= item.minStock ? 'text-amber-500' : 'text-emerald-500'
                              }`}>
                                {item.currentStock} {item.unit} במלאי
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-400 font-mono text-xs font-bold leading-none bg-slate-100 px-2 py-1 rounded-md">{item.sku}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-500 text-xs font-medium">{item.category || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-900 font-black text-sm">₪{item.price?.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(item);
                                setIsAddingItem(true);
                              }}
                              className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 rounded-xl transition-all shadow-sm"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(item.id!);
                              }}
                              className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 rounded-xl transition-all shadow-sm"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Sales Tab */
        <div className="space-y-6">
          {/* Sales Search Bar */}
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="חפש לפי שם לקוח, תאריך (YYYY-MM-DD), מוצר או מק'ט..."
              value={salesSearchQuery}
              onChange={(e) => setSalesSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-2xl py-4 pr-12 pl-4 text-sm focus:ring-2 focus:ring-sky-600 outline-none shadow-sm transition-all"
            />
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
                <History className="text-emerald-500" />
                מכירות אחרונות מהשטח
              </h3>
              <button className="flex items-center gap-2 text-sky-600 text-sm font-bold hover:underline">
                <Download size={18} />
                ייצא דוח אקסל
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">מוצר</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">לקוח</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">כמות</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">סה"כ</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">תאריך</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20">
                        <TrendingUp size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-bold">לא נמצאו מכירות תואמות</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(sale => {
                      const inventoryItem = items.find(i => i.sku === sale.itemId);
                      const displayTitle = inventoryItem 
                        ? inventoryItem.name 
                        : sale.itemName || `${sale.itemId} (מוצר חדש/לא מסונכרן)`;
                      
                      return (
                        <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                                <Package className="text-emerald-600" size={16} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900">{displayTitle}</span>
                                <span className="text-[10px] font-mono text-gray-400">{sale.itemId}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <User size={14} className="text-gray-400" />
                              {sale.customerName}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-black">
                              {sale.quantity} {inventoryItem?.unit || 'יחידות'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-black text-emerald-600">
                              ₪{((sale.priceAtSale || inventoryItem?.price || 0) * (sale.quantity || 1)).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400 font-medium">
                              <Calendar size={12} />
                              {sale.date}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
        </div>
      </div>
    )}

      {/* Slide-over Editing Panel - Enterprise Grade */}
      <InventorySlideOver 
        isOpen={isAddingItem}
        onClose={() => {
          setIsAddingItem(false);
          setEditingItem(null);
        }}
        editingItem={editingItem}
      />

      <UIModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
      />
    </div>
  );
};
