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
import { Avatar } from './Avatar';

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
  
  // Real-time badge state
  const [previewStock, setPreviewStock] = useState<number>(0);
  const [previewMinStock, setPreviewMinStock] = useState<number>(5);

  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, title: string, message: string, type: 'alert'|'confirm', onConfirm?: () => void}>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  useEffect(() => {
    if (editingItem) {
      setPreviewStock(editingItem.currentStock || 0);
      setPreviewMinStock(editingItem.minStock || 5);
    } else {
      setPreviewStock(0);
      setPreviewMinStock(5);
    }
  }, [editingItem, isAddingItem]);

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
      videoUrl: formData.get('videoUrl') as string,
      unit: formData.get('unit') as string || 'יח',
      currentStock: getNum('currentStock'),
      minStock: getNum('minStock'),
      price: getNum('price'),
      category: formData.get('category') as string,
      dryingTime: formData.get('dryingTime') as string,
      coverage: formData.get('coverage') as string,
      applicationMethod: formData.get('applicationMethod') as string,
      noaInsight: formData.get('noaInsight') as string,
      demandTrend: formData.get('demandTrend') as any || 'stable',
      relatedProducts: (formData.get('relatedProducts') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
      upsellItems: (formData.get('upsellItems') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
      createdAt: editingItem?.createdAt || serverTimestamp() as any,
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

  const filteredItems = items.filter(item => {
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
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
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
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col"
              dir="rtl"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                    {editingItem ? 'ניהול מוצר במאגר' : 'הוספת מוצר חדש'}
                  </h3>
                  <p className="text-slate-400 text-sm font-medium mt-1">SabanOS v3.5 Enterprise UI</p>
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

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <form id="productForm" onSubmit={handleAddItem} className="space-y-10 pb-20">
                  
                  {/* Dynamic Image Preview Section */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-1">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">תצוגה מקדימה וקישור</label>
                      <div className="flex items-center gap-2">
                        {previewStock <= 0 ? (
                          <span className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-rose-100">
                            <AlertTriangle size={12} />
                            חסר במלאי
                          </span>
                        ) : previewStock <= previewMinStock ? (
                          <span className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-amber-100">
                            <AlertTriangle size={12} />
                            מלאי נמוך
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-emerald-100">
                            <CheckCircle2 size={12} />
                            במלאי
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="aspect-square w-full max-w-[280px] mx-auto bg-slate-100 rounded-[3rem] border-4 border-white shadow-2xl shadow-slate-200 overflow-hidden relative group/hero">
                      <img 
                        id="heroImagePreview"
                        src={editingItem?.imageUrl || ''} 
                        alt="Product Preview" 
                        className={`w-full h-full object-cover transition-transform duration-700 group-hover/hero:scale-110 ${!editingItem?.imageUrl && 'hidden'}`}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const placeholder = document.getElementById('heroPlaceholder');
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                        onLoad={(e) => {
                          (e.target as HTMLImageElement).style.display = 'block';
                          const placeholder = document.getElementById('heroPlaceholder');
                          if (placeholder) placeholder.style.display = 'none';
                        }}
                      />
                      <div 
                        id="heroPlaceholder" 
                        className={`absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-300 ${editingItem?.imageUrl ? 'hidden' : 'flex'}`}
                      >
                        <div className="p-6 bg-white rounded-3xl shadow-sm">
                          <ImageIcon size={48} strokeWidth={1.5} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">ממתין לתמונה</p>
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <Paperclip size={20} />
                      </div>
                      <input 
                        name="imageUrl" 
                        type="url"
                        defaultValue={editingItem?.imageUrl}
                        placeholder="הדבק כאן קישור לתמונה (URL)..."
                        autoComplete="off"
                        onChange={(e) => {
                          const img = document.getElementById('heroImagePreview') as HTMLImageElement;
                          if (img) img.src = e.target.value;
                        }}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] pr-12 pl-4 py-4 text-sm font-medium text-slate-600 focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300" 
                      />
                    </div>
                  </div>

                  {/* Core Fields Vertical Stack */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">שם מוצר רשמי</label>
                      <input 
                        name="name" 
                        required 
                        defaultValue={editingItem?.name}
                        placeholder="למשל: חול ים מסונן"
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">מק"ט מערכת</label>
                        <input 
                          name="sku" 
                          required 
                          defaultValue={editingItem?.sku}
                          placeholder="Unique ID"
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base font-mono font-black text-indigo-600 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">קטגוריה</label>
                        <input 
                          name="category" 
                          defaultValue={editingItem?.category}
                          placeholder="למשל: חומרי מחצבה"
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">תיאור מוצר (מידע נוסף)</label>
                      <textarea 
                        name="description" 
                        rows={3}
                        defaultValue={editingItem?.description}
                        placeholder="הכנס כאן פרטים נוספים על המוצר, מידות, סוג, או הנחיות מיוחדות..."
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-medium text-slate-600 focus:bg-white focus:border-indigo-500 outline-none transition-all resize-none" 
                      />
                    </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">מחיר ₪</label>
                          <input 
                            name="price" 
                            type="number" 
                            step="0.01"
                            defaultValue={editingItem?.price}
                            className="w-full bg-transparent border-none p-0 text-lg font-black text-emerald-600 outline-none" 
                          />
                        </div>
                        <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">מלאי</label>
                          <input 
                            name="currentStock" 
                            type="number" 
                            required 
                            defaultValue={editingItem?.currentStock || 0}
                            onChange={(e) => setPreviewStock(Number(e.target.value))}
                            className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-800 outline-none" 
                          />
                        </div>
                        <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">יחידה</label>
                           <input 
                            name="unit" 
                            defaultValue={editingItem?.unit || 'יח'}
                            className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-800 outline-none" 
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">סף מינימום</label>
                        <input 
                          name="minStock" 
                          type="number" 
                          required 
                          defaultValue={editingItem?.minStock || 5}
                          onChange={(e) => setPreviewMinStock(Number(e.target.value))}
                          className="w-full bg-transparent border-none p-0 text-lg font-black text-rose-500 outline-none" 
                        />
                      </div>
                    </div>

                    {/* Technical Specifications Grid */}
                    <div className="space-y-6 pt-6 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <FileText size={16} />
                        </div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">מפרט טכני</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">זמן ייבוש</label>
                          <input 
                            name="dryingTime" 
                            defaultValue={editingItem?.dryingTime}
                            placeholder="למשל: 24 שעות"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">כושר כיסוי (מ"ר/יח')</label>
                          <input 
                            name="coverage" 
                            defaultValue={editingItem?.coverage}
                            placeholder="למשל: 15 מ"ר"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">שיטת יישום</label>
                        <input 
                          name="applicationMethod" 
                          defaultValue={editingItem?.applicationMethod}
                          placeholder="למשל: מריחה במאלג' / התזה"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Multimedia - Video Link */}
                    <div className="space-y-4 pt-6 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                          <Play size={16} />
                        </div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">מדיה והדרכות</h4>
                      </div>
                      <div className="relative group">
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors">
                          <Video size={18} />
                        </div>
                        <input 
                          name="videoUrl" 
                          type="url"
                          defaultValue={editingItem?.videoUrl}
                          placeholder="קישור לסרטון הדרכה (YouTube/Direct)..."
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl pr-12 pl-4 py-4 text-sm font-medium text-slate-600 focus:bg-white focus:border-rose-500 outline-none transition-all placeholder:text-slate-300" 
                        />
                      </div>
                    </div>

                    {/* Product Ecosystem */}
                    <div className="space-y-4 pt-6 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <PlusCircle size={16} />
                        </div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">אקו-סיסטם ומוצרים משלימים</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">מוצרים קשורים (מופרדים בפסיק)</label>
                          <input 
                            name="relatedProducts" 
                            defaultValue={editingItem?.relatedProducts?.join(', ')}
                            placeholder="הזן מק'טים של מוצרים משלימים..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-slate-600 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">אפסייל / שדרוגים (מופרדים בפסיק)</label>
                          <input 
                            name="upsellItems" 
                            defaultValue={editingItem?.upsellItems?.join(', ')}
                            placeholder="הזן מק'טים של מוצרי פרימיום..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-slate-600 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* AI Intelligence Hub */}
                    <div className="space-y-4 pt-6 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
                          <Star size={16} />
                        </div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">התובנות של נועה (AI)</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">מגמת ביקוש</label>
                          <select 
                            name="demandTrend"
                            defaultValue={editingItem?.demandTrend || 'stable'}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-sky-500 transition-all appearance-none shadow-sm"
                          >
                            <option value="rising">📈 ביקוש בעלייה</option>
                            <option value="stable">↔️ יציב</option>
                            <option value="falling">📉 ביקוש בירידה</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">תובנה אינטליגנטית (Noa's Insight)</label>
                          <textarea 
                            name="noaInsight" 
                            rows={3}
                            defaultValue={editingItem?.noaInsight}
                            placeholder="נועה מנתחת צריכה... (למשל: ביקוש גבוה בתקופת החורף עקב ריבוי עבודות גמר)"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-xs font-bold text-slate-600 focus:bg-white focus:border-sky-500 outline-none transition-all resize-none italic shadow-inner" 
                          />
                        </div>
                      </div>
                    </div>
                </form>
              </div>

              {/* Action Footer */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 backdrop-blur-md">
                <div className="flex gap-4">
                  <button 
                    form="productForm"
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 h-16 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                    <span>{editingItem ? 'עדכון מוצר בסידור' : 'שמירת מוצר במאגר'}</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsAddingItem(false);
                      setEditingItem(null);
                    }}
                    className="w-16 h-16 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300 rounded-2xl flex items-center justify-center transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">באדיבות נועה ❤️</p>
                </div>
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
