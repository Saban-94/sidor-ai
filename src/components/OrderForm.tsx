import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  Package, 
  Send, 
  CheckCircle2, 
  Loader2, 
  MessageCircle,
  Plus,
  Minus,
  Search,
  Truck,
  Calendar,
  Clock
} from 'lucide-react';
import { InventoryItem, Order } from '../types';
import { createOrder } from '../services/auraService';

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onSuccess: (order: Order) => void;
  editingOrder?: Order | null;
}

const OrderForm: React.FC<OrderFormProps> = ({ 
  isOpen, 
  onClose, 
  inventory,
  onSuccess,
  editingOrder
}) => {
  const [loading, setLoading] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    destination: '',
    warehouse: 'החרש' as 'החרש' | 'התלמיד',
    orderNumber: '',
    driverId: 'pending' as 'ali' | 'hikmat' | 'pending',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }),
  });

  const [selectedItems, setSelectedItems] = useState<{item: InventoryItem, quantity: number}[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualItems, setManualItems] = useState('');
  const [isManualItems, setIsManualItems] = useState(false);

  useEffect(() => {
    if (editingOrder) {
      setFormData({
        customerName: editingOrder.customerName || '',
        customerPhone: editingOrder.customerPhone || editingOrder.phone || '',
        destination: editingOrder.destination || '',
        warehouse: editingOrder.warehouse || 'החרש',
        orderNumber: editingOrder.orderNumber || '',
        driverId: (editingOrder.driverId as any) || 'pending',
        date: editingOrder.date || new Date().toISOString().split('T')[0],
        time: editingOrder.time || new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }),
      });
      setManualItems(editingOrder.items || '');
      setIsManualItems(!!editingOrder.items);
      setSelectedItems([]); 
    } else {
      setFormData({
        customerName: '',
        customerPhone: '',
        destination: '',
        warehouse: 'החרש',
        orderNumber: '',
        driverId: 'pending',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }),
      });
      setManualItems('');
      setIsManualItems(false);
      setSelectedItems([]);
    }
    setSuccessOrder(null);
  }, [editingOrder, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const itemsString = isManualItems ? manualItems : selectedItems
        .map(i => `${i.item.name} (${i.quantity} ${i.item.unit || 'יח'})`)
        .join(', ');

      const orderData: Partial<Order> = {
        ...formData,
        items: itemsString,
        status: editingOrder ? editingOrder.status : 'pending'
      };

      if (editingOrder?.id) {
        const { updateOrder } = await import('../services/auraService');
        await updateOrder(editingOrder.id, orderData);
        onSuccess({...editingOrder, ...orderData} as Order);
        onClose();
      } else {
        const result = await createOrder(orderData);
        setSuccessOrder(result);
        onSuccess(result);
      }
    } catch (error) {
      console.error('Error saving order:', error);
      alert('שגיאה בשמירת ההזמנה.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" dir="rtl">
        {!successOrder ? (
          <>
            <div className="bg-gray-900 p-6 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg"><Package className="text-white" size={20} /></div>
                <h3 className="text-xl font-black italic">{editingOrder ? 'עדכון הזמנה' : 'הזמנה חדשה'}</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Driver Section */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">
                    <Truck size={12} className="text-sky-600" /> שיבוץ נהג
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ id: 'ali', name: 'עלי 🚛' }, { id: 'hikmat', name: 'חכמת 🏗️' }, { id: 'pending', name: 'ממתין ⏳' }].map((d) => (
                      <button key={d.id} type="button" onClick={() => setFormData({...formData, driverId: d.id as any})}
                        className={`py-3 rounded-xl text-xs font-black border-2 transition-all ${formData.driverId === d.id ? 'border-sky-600 bg-sky-50 text-sky-900' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date & Time Section - NEW */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase px-1">
                      <Calendar size={12} className="text-sky-600" /> תאריך אספקה
                    </label>
                    <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-sky-600 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase px-1">
                      <Clock size={12} className="text-sky-600" /> שעת יעד
                    </label>
                    <input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-sky-600 outline-none transition-all" />
                  </div>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="שם לקוח" value={formData.customerName} onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:border-sky-600 outline-none transition-all" />
                  <input required type="tel" placeholder="טלפון לקוח" value={formData.customerPhone} onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:border-sky-600 outline-none transition-all" />
                </div>

                <input required placeholder="כתובת אספקה" value={formData.destination} onChange={(e) => setFormData({...formData, destination: e.target.value})}
                  className="w-full bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:border-sky-600 outline-none transition-all" />

                <button type="submit" disabled={loading} className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black shadow-lg shadow-sky-600/20 flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="animate-spin" /> : <><Send size={20} /> {editingOrder ? 'שמור שינויים' : 'צור הזמנה'}</>}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto"><CheckCircle2 className="text-emerald-500" size={40} /></div>
            <h2 className="text-2xl font-black">הזמנה עודכנה!</h2>
            <button onClick={onClose} className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black">סגור</button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OrderForm;
