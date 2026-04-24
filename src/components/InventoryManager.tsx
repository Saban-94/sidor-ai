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
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  where,
  getDocs 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { InventoryItem, SaleRecord, Order } from '../types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { parseItems } from '../lib/utils';

interface InventoryManagerProps {
  orders?: Order[];
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ orders = [] }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales'>('inventory');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const qItems = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[];
      setItems(docs);
      setLoading(false);
    });

    const qSales = query(collection(db, 'sales'), orderBy('date', 'desc'));
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SaleRecord[];
      setSales(docs.slice(0, 50)); // Show last 50 sales
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
      if (editingItem) {
        const { createdAt, ...updateData } = newItem;
        await updateDoc(doc(db, 'inventory', editingItem.id!), {
          ...updateData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'inventory'), newItem);
      }
      setIsAddingItem(false);
      setEditingItem(null);
    } catch (error: any) {
      console.error("Error saving item to Firestore:", error);
      if (error?.code === 'permission-denied') {
        console.error("DEBUG: Current user email:", auth.currentUser?.email);
        alert("אין לך הרשאות מתאימות לביצוע פעולה זו. וודא שאתה מחובר עם המייל המורשה.");
      } else {
        alert("שגיאה בשמירת המוצר: " + (error?.message || "שגיאה לא ידועה"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק מוצר זה?")) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      console.error("Error deleting item:", error);
    }
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

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingItem(false);
                setEditingItem(null);
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
                <h3 className="text-xl font-bold">{editingItem ? 'ערוך מוצר' : 'הוסף מוצר חדש'}</h3>
                <button onClick={() => {
                  setIsAddingItem(false);
                  setEditingItem(null);
                }} className="p-1 hover:bg-white/10 rounded-lg">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAddItem} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">מק"ט</label>
                    <input 
                      name="sku" 
                      required 
                      defaultValue={editingItem?.sku}
                      placeholder="למשל: 11501"
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">שם מוצר</label>
                    <input 
                      name="name" 
                      required 
                      defaultValue={editingItem?.name}
                      placeholder="למשל: חול שק גדול"
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">תיאור</label>
                  <textarea 
                    name="description" 
                    defaultValue={editingItem?.description}
                    placeholder="תיאור קצר של המוצר..."
                    rows={2}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none resize-none" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">לינק לתמונת מוצר</label>
                  <div className="flex gap-2">
                    <input 
                      name="imageUrl" 
                      type="url"
                      defaultValue={editingItem?.imageUrl}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" 
                    />
                    {editingItem?.imageUrl && (
                      <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                        <img 
                          src={editingItem.imageUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">יחידה</label>
                    <select name="unit" defaultValue={editingItem?.unit || 'יחידה'} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none">
                      <option value="יחידה">יחידה</option>
                      <option value="קילו">קילו</option>
                      <option value="שק">שק</option>
                      <option value="משטח">משטח</option>
                      <option value="בלה">בלה</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">קטגוריה</label>
                    <input 
                      name="category" 
                      defaultValue={editingItem?.category}
                      placeholder="למשל: חומרי מחצבה"
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">מחיר (₪)</label>
                    <input 
                      name="price" 
                      type="number" 
                      step="0.01"
                      defaultValue={editingItem?.price}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">מלאי נוכחי</label>
                    <input 
                      name="currentStock" 
                      type="number" 
                      required 
                      defaultValue={editingItem?.currentStock || 0}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">מלאי מינימום</label>
                    <input 
                      name="minStock" 
                      type="number" 
                      required 
                      defaultValue={editingItem?.minStock || 5}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-sky-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-sky-700 transition-colors shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : editingItem ? 'עדכן מוצר' : 'שמור מוצר במאגר'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
