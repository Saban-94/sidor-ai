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
  Download,
  X,
  CheckCircle2,
  Loader2,
  User,
  Calendar
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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InventoryItem, SaleRecord, Order } from '../types';
import { parseItems } from '../lib/utils';

interface InventoryManagerProps {
  orders?: Order[];
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ orders = [] }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales'>('inventory');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // מאזין למוצרים
    const qItems = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[];
      setItems(docs);
      setLoading(false);
    });

    // מאזין למכירות (50 אחרונות)
    const qSales = query(collection(db, 'sales'), orderBy('date', 'desc'));
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SaleRecord[];
      setSales(docs.slice(0, 50));
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
    
    const newItem: Partial<InventoryItem> = {
      sku: formData.get('sku') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      unit: formData.get('unit') as string,
      currentStock: Number(formData.get('currentStock')),
      minStock: Number(formData.get('minStock')),
      price: Number(formData.get('price')),
      category: formData.get('category') as string,
      updatedAt: serverTimestamp() as any,
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id!), {
          ...newItem,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'inventory'), {
          ...newItem,
          createdAt: serverTimestamp()
        });
      }
      setIsAddingItem(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving item:", error);
      alert("שגיאה בשמירת המוצר");
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
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Tab Navigation */}
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

          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">מק"ט</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">שם מוצר</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">מלאי</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">ביקוש</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">מחיר</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">סטטוס</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <Loader2 className="animate-spin mx-auto text-sky-600" size={32} />
                      </td>
                    </tr>
                  ) : filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">{item.sku}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 text-center font-black text-gray-900">{item.currentStock} {item.unit}</td>
                      <td className="px-6 py-4 text-center font-bold text-sky-600">{getItemDemand(item.sku)}</td>
                      <td className="px-6 py-4 text-center font-bold text-emerald-600">₪{item.price?.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 w-fit ${item.currentStock <= item.minStock ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {item.currentStock <= item.minStock ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                          {item.currentStock <= item.minStock ? 'מלאי נמוך' : 'תקין'}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex justify-center gap-2">
                        <button onClick={() => { setEditingItem(item); setIsAddingItem(true); }} className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg"><Edit3 size={18} /></button>
                        <button onClick={() => handleDeleteItem(item.id!)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
              <History className="text-emerald-500" />
              היסטוריית מכירות
            </h3>
            <button className="flex items-center gap-2 text-sky-600 text-sm font-bold hover:underline">
              <Download size={18} /> ייצא אקסל
            </button>
          </div>

          <div className="space-y-4">
            {sales.map(sale => {
              // חיפוש שם המוצר לפי ה-itemId (ה-SKU)
              const product = items.find(i => i.sku === sale.itemId || i.id === sale.itemId);
              return (
                <div key={sale.id} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-sm">
                      <Package className="text-emerald-600" size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{product?.name || sale.itemName || 'מוצר לא מזוהה'}</h4>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black">
                          {sale.quantity} {product?.unit || 'יחידה'}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <User size={10} /> {sale.customerName || 'לקוח מזדמן'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-emerald-600">₪{(sale.totalPrice || (sale.quantity * (product?.price || 0))).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 flex items-center justify-end gap-1 font-medium">
                      <Calendar size={10} /> {sale.date}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal - הוספה/עריכה */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => {setIsAddingItem(false); setEditingItem(null);}} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden">
              <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingItem ? 'ערוך מוצר' : 'מוצר חדש'}</h3>
                <button onClick={() => {setIsAddingItem(false); setEditingItem(null);}}><X size={24} /></button>
              </div>
              <form onSubmit={handleAddItem} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input name="sku" required defaultValue={editingItem?.sku} placeholder="מק''ט" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                  <input name="name" required defaultValue={editingItem?.name} placeholder="שם מוצר" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <select name="unit" defaultValue={editingItem?.unit || 'יחידה'} className="bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none">
                    <option value="יחידה">יחידה</option>
                    <option value="קילו">קילו</option>
                    <option value="שק">שק</option>
                    <option value="משטח">משטח</option>
                  </select>
                  <input name="category" defaultValue={editingItem?.category} placeholder="קטגוריה" className="bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                  <input name="price" type="number" step="0.01" defaultValue={editingItem?.price} placeholder="מחיר" className="bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input name="currentStock" type="number" required defaultValue={editingItem?.currentStock || 0} placeholder="מלאי נוכחי" className="bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                  <input name="minStock" type="number" required defaultValue={editingItem?.minStock || 5} placeholder="מינימום" className="bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-sky-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg">
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'שמור מוצר'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
