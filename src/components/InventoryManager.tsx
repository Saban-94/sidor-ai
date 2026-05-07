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

interface InventoryManagerProps {
  orders?: Order[];
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ orders = [] }) => {
  const { addToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales'>('inventory');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const getNum = (key: string) => {
      const val = formData.get(key);
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };
    
    const newItem: Partial<InventoryItem> = {
      sku: formData.get('sku') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      imageUrl: formData.get('imageUrl') as string,
      unit: formData.get('unit') as string,
      currentStock: getNum('currentStock'),
      minStock: getNum('minStock'),
      price: getNum('price'),
      category: formData.get('category') as string,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    try {
      const sku = formData.get('sku') as string;
      if (editingItem) {
        const { createdAt, ...updateData } = newItem;
        await updateDoc(doc(db, 'inventory', editingItem.id!), {
          ...updateData,
          updatedAt: serverTimestamp()
        });
        addToast('המוצר עודכן', `המוצר ${newItem.name} עודכן בהצלחה בסידור ח.סבן! ✅`, 'success');
      } else {
        // Use SKU as document ID for new products as requested
        await setDoc(doc(db, 'inventory', sku), newItem);
        addToast('המוצר נוסף', `המוצר ${newItem.name} נוסף בהצלחה למאגר ח.סבן! ✅`, 'success');
      }
      setIsAddingItem(false);
      setEditingItem(null);
    } catch (error: any) {
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'inventory');
      setModalConfig({
        isOpen: true,
        title: 'שגיאה',
        message: "שגיאה בשמירת המוצר: " + (error?.message || "שגיאה לא ידועה"),
        type: 'alert'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSales = sales.filter(sale => {
    const searchLower = salesSearchQuery.toLowerCase();
    const inventoryItem = items.find(i => i.sku === sale.itemId);
    const itemName = inventoryItem ? inventoryItem.name : (sale.itemName || '');
    
    return (
      (sale.customerName?.toLowerCase().includes(searchLower)) ||
      (sale.date?.includes(searchLower)) ||
      (sale.itemId?.toLowerCase().includes(searchLower)) ||
      (itemName.toLowerCase().includes(searchLower))
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

        <button 
          onClick={() => setIsAddingItem(true)}
          className="bg-sky-600 text-white flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg shadow-sky-600/20 hover:scale-105 transition-transform"
        >
          <Plus size={20} />
          הוסף מוצר למאגר
        </button>
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
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">תמונה</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">מק"ט</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">שם מוצר</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">מלאי נוכחי</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">ביקוש פעיל</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">מינימום</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">מחיר (₪)</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">סטטוס</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-20 text-center">
                        <Loader2 className="animate-spin mx-auto text-sky-600" size={32} />
                        <p className="text-gray-400 mt-2 font-bold">טוען מוצרים...</p>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-20 text-center">
                        <Package className="mx-auto text-gray-200 mb-4" size={48} />
                        <h4 className="text-lg font-bold text-gray-400">לא נמצאו מוצרים תואמים</h4>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 text-center">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                            {item.imageUrl ? (
                              <img 
                                src={item.imageUrl} 
                                alt={item.name} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=Error';
                                }}
                              />
                            ) : (
                              <ImageIcon className="text-gray-300" size={20} />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-500">{item.sku}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{item.name}</span>
                            <span className="text-[10px] text-gray-400">{item.category || 'ללא קטגוריה'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-black ${item.currentStock <= item.minStock ? 'text-rose-600' : 'text-gray-900'}`}>
                            {item.currentStock} {item.unit}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-bold ${getItemDemand(item.sku) > 0 ? 'text-sky-600 bg-sky-50 px-2 py-1 rounded-lg' : 'text-gray-400'}`}>
                            {getItemDemand(item.sku)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-gray-400">{item.minStock}</td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-emerald-600">{item.price?.toFixed(2) || '0.00'}</td>
                        <td className="px-6 py-4">
                          {item.currentStock <= item.minStock ? (
                            <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 w-fit">
                              <AlertTriangle size={10} />
                              מלאי נמוך
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 w-fit">
                              <CheckCircle2 size={10} />
                              תקין
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEditingItem(item);
                                setIsAddingItem(true);
                              }}
                              className="p-2 hover:bg-sky-50 text-sky-600 rounded-lg transition-colors"
                              title="ערוך מוצר"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteItem(item.id!)}
                              className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                              title="מחק מוצר"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
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

      {/* Add / Edit Modal - Redesigned for Enterprise Standards */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSubmitting) {
                  setIsAddingItem(false);
                  setEditingItem(null);
                }
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="bg-white border-b border-slate-100 p-8 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                    {editingItem ? 'עריכת מוצר במערכת' : 'הוספת מוצר חדש למערכת'}
                  </h3>
                  <p className="text-slate-400 text-sm font-medium mt-1">ניהול מלאי מתקדם - SabanOS v3.5</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAddingItem(false);
                    setEditingItem(null);
                  }} 
                  className="p-3 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAddItem} className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  
                  {/* Left Column: Product Details */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">מק"ט (מזהה ייחודי)</label>
                        <div className="relative group">
                          <input 
                            name="sku" 
                            required 
                            defaultValue={editingItem?.sku}
                            placeholder="למשל: 11501"
                            className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-sm font-mono font-bold text-indigo-600 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all shadow-inner" 
                          />
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 opacity-0 group-focus-within:opacity-100 transition-opacity">
                            <span className="text-[10px] font-black uppercase">Unique</span>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">שם מוצר</label>
                        <input 
                          name="name" 
                          required 
                          defaultValue={editingItem?.name}
                          placeholder="למשל: חול שק גדול"
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">קטגוריה</label>
                        <input 
                          name="category" 
                          defaultValue={editingItem?.category}
                          placeholder="למשל: חומרי מחצבה"
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">יחידת מידה</label>
                        <select 
                          name="unit" 
                          defaultValue={editingItem?.unit || 'יחידה'} 
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all appearance-none"
                        >
                          <option value="יחידה">יחידה</option>
                          <option value="קילו">קילו</option>
                          <option value="שק">שק</option>
                          <option value="משטח">משטח</option>
                          <option value="בלה">בלה</option>
                          <option value="קוב">קוב</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">מחיר ליחידה (₪)</label>
                        <input 
                          name="price" 
                          type="number" 
                          step="0.01"
                          defaultValue={editingItem?.price}
                          placeholder="0.00"
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-sm font-bold text-emerald-600 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50/50 outline-none transition-all" 
                        />
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between gap-6">
                      <div className="flex-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">מלאי זמין כרגע</label>
                        <input 
                          name="currentStock" 
                          type="number" 
                          required 
                          id="currentStockInput"
                          defaultValue={editingItem?.currentStock || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const minVal = parseInt((document.getElementsByName('minStock')[0] as HTMLInputElement)?.value) || 0;
                            const badge = document.getElementById('inventoryStatusBadge');
                            if (badge) {
                              if (val === 0) {
                                badge.className = "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter text-rose-600 bg-rose-100 border border-rose-200";
                                badge.innerText = "אזל מהמלאי";
                              } else if (val <= minVal) {
                                badge.className = "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter text-amber-600 bg-amber-100 border border-amber-200";
                                badge.innerText = "מלאי נמוך";
                              } else {
                                badge.className = "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter text-emerald-600 bg-emerald-100 border border-emerald-200";
                                badge.innerText = "במלאי";
                              }
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 focus:ring-2 focus:ring-indigo-600 outline-none" 
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">סף מלאי מינימלי</label>
                        <input 
                          name="minStock" 
                          type="number" 
                          required 
                          defaultValue={editingItem?.minStock || 5}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 focus:ring-2 focus:ring-indigo-600 outline-none" 
                        />
                      </div>
                      <div className="flex flex-col items-center justify-center pt-5">
                        <span 
                          id="inventoryStatusBadge"
                          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                            (editingItem?.currentStock || 0) === 0 ? 'text-rose-600 bg-rose-100 border border-rose-200' :
                            (editingItem?.currentStock || 0) <= (editingItem?.minStock || 5) ? 'text-amber-600 bg-amber-100 border border-amber-200' :
                            'text-emerald-600 bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {(editingItem?.currentStock || 0) === 0 ? 'אזל מהמלאי' :
                           (editingItem?.currentStock || 0) <= (editingItem?.minStock || 5) ? 'מלאי נמוך' : 'במלאי'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Media & Actions */}
                  <div className="lg:col-span-5 space-y-8">
                    <div className="space-y-4">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">ניהול מדיה ותמונות</label>
                      <div className="relative group">
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <Paperclip size={20} />
                        </div>
                        <input 
                          name="imageUrl" 
                          type="url"
                          id="imageUrlInput"
                          defaultValue={editingItem?.imageUrl}
                          placeholder="הדבק לינק לתמונה (URL)..."
                          onChange={(e) => {
                            const img = document.getElementById('productImagePreview') as HTMLImageElement;
                            if (img) img.src = e.target.value || '';
                          }}
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl pr-12 pl-4 py-4 text-sm font-medium text-slate-600 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                        />
                      </div>

                      <div className="aspect-square w-full max-w-[280px] mx-auto bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group/preview">
                        <img 
                          id="productImagePreview"
                          src={editingItem?.imageUrl || ''} 
                          alt="Product Preview" 
                          className={`w-full h-full object-cover transition-transform duration-500 group-hover/preview:scale-110 ${!editingItem?.imageUrl && 'hidden'}`}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = document.getElementById('previewPlaceholder');
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                          onLoad={(e) => {
                             const target = e.target as HTMLImageElement;
                             target.style.display = 'block';
                             const placeholder = document.getElementById('previewPlaceholder');
                             if (placeholder) placeholder.style.display = 'none';
                          }}
                        />
                        <div 
                          id="previewPlaceholder" 
                          className={`flex flex-col items-center gap-3 text-slate-300 ${editingItem?.imageUrl ? 'hidden' : 'flex'}`}
                        >
                          <ImageIcon size={64} strokeWidth={1} />
                          <p className="text-[10px] font-black uppercase tracking-widest">תצוגה מקדימה</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-10 border-t border-slate-100">
                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full h-20 bg-indigo-600 hover:bg-slate-900 text-white rounded-[1.5rem] font-black text-base uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-2xl shadow-indigo-100 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-3">
                            <Loader2 className="animate-spin" size={24} />
                            <span>מעדכנת מאגר...</span>
                          </div>
                        ) : (
                          <>
                            <CheckCircle2 size={24} />
                            <span>{editingItem ? 'עדכון מוצר בסידור' : 'שמירת מוצר חדש'}</span>
                          </>
                        )}
                      </button>

                      <div className="flex gap-4">
                        <button 
                          type="button"
                          onClick={() => {
                            setIsAddingItem(false);
                            setEditingItem(null);
                          }}
                          className="flex-1 h-16 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl font-bold transition-all"
                        >
                          ביטול
                        </button>
                        {editingItem && (
                          <button 
                            type="button"
                            onClick={() => handleDeleteItem(editingItem.id!)}
                            className="h-16 w-16 flex items-center justify-center text-rose-500 hover:bg-rose-50 border-2 border-rose-100 rounded-xl transition-all"
                            title="מחק לצמיתות"
                          >
                            <Trash2 size={24} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
              <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">באדיבות נועה ❤️</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
