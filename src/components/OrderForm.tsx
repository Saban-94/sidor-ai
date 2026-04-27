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
  Calendar,
  Clock
} from 'lucide-react';
import { InventoryItem, Order, Driver } from '../types';
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
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }),
    driverId: 'pending'
  });

  const [selectedItems, setSelectedItems] = useState<{item: InventoryItem, quantity: number}[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [manualItems, setManualItems] = useState('');
  const [isManualItems, setIsManualItems] = useState(false);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [customerLookup, setCustomerLookup] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    const loadDrivers = async () => {
      const { getAllDrivers } = await import('../services/auraService');
      const all = await getAllDrivers();
      setDrivers(all);
    };
    if (isOpen) loadDrivers();
  }, [isOpen]);

  const customerNameInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus customer name on open if not editing
    if (isOpen && !editingOrder) {
      setTimeout(() => customerNameInputRef.current?.focus(), 150);
    }
  }, [isOpen, editingOrder]);

  useEffect(() => {
    // Single fetch for customer lookup data from orders to save bandwidth
    const loadLookupData = async () => {
      const { fetchOrders } = await import('../services/auraService');
      const all = await fetchOrders();
      setOrderHistory(all);
      const uniqueNames = Array.from(new Set(all.map(o => o.customerName))).filter(Boolean);
      setCustomerLookup(uniqueNames);
    };
    if (isOpen) loadLookupData();
  }, [isOpen]);

  const filteredCustomers = customerLookup
    .filter(name => 
      name.toLowerCase().includes(formData.customerName.toLowerCase()) && 
      name !== formData.customerName
    )
    .slice(0, 5);

  const handleSelectCustomer = (name: string) => {
    const lastOrder = [...orderHistory]
      .reverse()
      .find(o => o.customerName === name);
    
    setFormData({
      ...formData,
      customerName: name,
      customerPhone: lastOrder?.customerPhone || lastOrder?.phone || formData.customerPhone,
      destination: lastOrder?.destination || formData.destination
    });
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    
    if (e.key === 'ArrowDown') {
      setFocusedIndex(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      handleSelectCustomer(filteredCustomers[focusedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    if (editingOrder) {
      setFormData({
        customerName: editingOrder.customerName || '',
        customerPhone: editingOrder.customerPhone || editingOrder.phone || '',
        destination: editingOrder.destination || '',
        warehouse: editingOrder.warehouse || 'החרש',
        orderNumber: editingOrder.orderNumber || '',
        date: editingOrder.date || new Date().toISOString().split('T')[0],
        time: editingOrder.time || new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }),
        driverId: editingOrder.driverId || 'pending'
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
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }),
        driverId: 'pending'
      });
      setManualItems('');
      setIsManualItems(false);
      setSelectedItems([]);
    }
    setSuccessOrder(null);
  }, [editingOrder, isOpen]);

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddItem = (item: InventoryItem) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.item.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setSelectedItems(prev => prev.map(i => {
      if (i.item.id === itemId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const validatePhone = (phone: string) => {
    const re = /^05\d{8}$/;
    return re.test(phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(formData.customerPhone)) {
      alert('נא להזין מספר טלפון תקין (05XXXXXXXX)');
      return;
    }
    if (!isManualItems && selectedItems.length === 0) {
      alert('נא לבחור לפחות פריט אחד');
      return;
    }

    setLoading(true);
    try {
      const itemsString = isManualItems ? manualItems : selectedItems
        .map(i => `${i.item.name} (${i.quantity} ${i.item.unit || 'יח'})`)
        .join(', ');

      const orderData: Partial<Order> = {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        destination: formData.destination,
        items: itemsString,
        warehouse: formData.warehouse,
        orderNumber: formData.orderNumber,
        date: formData.date,
        time: formData.time,
        driverId: formData.driverId,
        status: editingOrder ? editingOrder.status : 'pending'
      };

      if (editingOrder?.id) {
        const { updateOrder } = await import('../services/auraService');
        await updateOrder(editingOrder.id, orderData);
        onSuccess({...editingOrder, ...orderData});
        onClose();
      } else {
        const result = await createOrder(orderData);
        setSuccessOrder(result);
        onSuccess(result);
      }
    } catch (error) {
      console.error('Error saving order:', error);
      alert('שגיאה בשמירת ההזמנה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsApp = () => {
    if (!successOrder) return;
    const phone = formData.customerPhone.startsWith('0') ? '972' + formData.customerPhone.slice(1) : formData.customerPhone;
    const link = `https://sidor-ai-xi.vercel.app/track/${successOrder.trackingId}`;
    const message = `שלום ${formData.customerName}, הזמנתך מסבן חומרי בניין התקבלה! עקוב אחר ההתקדמות בדף הקסם שלך כאן: ${link}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {!successOrder ? (
          <>
            <div className="bg-gray-900 p-8 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-600/20">
                  <Package className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black italic tracking-tight">{editingOrder ? 'עדכון הזמנה' : 'הזמנה חדשה'}</h3>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">SabanOS Order Engine</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Customer Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 relative">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider px-1">
                      <User size={14} className="text-sky-600" />
                      שם לקוח
                    </label>
                    <input 
                      ref={customerNameInputRef}
                      required
                      type="text" 
                      placeholder="שם מלא של הלקוח"
                      value={formData.customerName}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={handleKeyDown}
                      onChange={(e) => {
                        setFormData({...formData, customerName: e.target.value});
                        setShowSuggestions(true);
                      }}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-600/5 outline-none transition-all"
                    />

                    <AnimatePresence>
                      {showSuggestions && filteredCustomers.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute z-[101] w-full bg-white rounded-2xl shadow-2xl border border-gray-100 mt-2 overflow-hidden"
                        >
                          {filteredCustomers.map((name, i) => (
                            <motion.button
                              key={name}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              type="button"
                              onClick={() => handleSelectCustomer(name)}
                              className={`w-full text-right px-6 py-4 text-sm font-bold flex items-center justify-between hover:bg-sky-50 transition-colors ${
                                focusedIndex === i ? 'bg-sky-50' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center text-sky-600">
                                  <User size={14} />
                                </div>
                                <span>{name}</span>
                              </div>
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">לקוח קיים</span>
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider px-1">
                      <Phone size={14} className="text-sky-600" />
                      טלפון
                    </label>
                    <input 
                      required
                      type="tel" 
                      placeholder="05XXXXXXXX"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-600/5 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider px-1">
                      <MapPin size={14} className="text-sky-600" />
                      כתובת אספקה
                    </label>
                    <input 
                      required
                      type="text" 
                      placeholder="כתובת מלאה ומדויקת"
                      value={formData.destination}
                      onChange={(e) => setFormData({...formData, destination: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-600/5 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider px-1">
                      <Package size={14} className="text-sky-600" />
                      מספר הזמנה / ליד
                    </label>
                    <input 
                      type="text" 
                      placeholder="מס' נתור / הזמנה"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-600/5 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider px-1">
                      <Calendar size={14} className="text-sky-600" />
                      תאריך אספקה
                    </label>
                    <input 
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-600/5 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider px-1">
                      <Clock size={14} className="text-sky-600" />
                      שעת אספקה
                    </label>
                    <input 
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-600/5 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider px-1">
                      <User size={14} className="text-sky-600" />
                      נהג משובץ
                    </label>
                    <select
                      value={formData.driverId}
                      onChange={(e) => setFormData({...formData, driverId: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-600/5 outline-none transition-all appearance-none"
                    >
                      <option value="pending">ממתין לשיבוץ</option>
                      <option value="self">איסוף עצמי</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.vehicleType === 'crane' ? 'מנוף' : 'משאית'})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider px-1">
                    <Package size={14} className="text-sky-600" />
                    מחסן יציאה
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {['החרש', 'התלמיד'].map((wh) => (
                      <button
                        key={wh}
                        type="button"
                        onClick={() => setFormData({...formData, warehouse: wh as any})}
                        className={`py-4 rounded-2xl text-sm font-black transition-all border-2 ${
                          formData.warehouse === wh 
                            ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-600/20' 
                            : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {wh}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items Selection Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider px-1">
                      <Package size={14} className="text-sky-600" />
                      פירוט פריטים
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualItems(!isManualItems)}
                      className="text-[10px] font-black text-sky-600 bg-sky-50 px-2 py-1 rounded-lg hover:bg-sky-100 transition-all"
                    >
                      {isManualItems ? 'חזור לבחירה ממלאי' : 'הזנה ידנית חופשית'}
                    </button>
                  </div>

                  {isManualItems ? (
                    <textarea 
                      value={manualItems}
                      onChange={(e) => setManualItems(e.target.value)}
                      placeholder="הזן פריטים וכמויות (טקסט חופשי)..."
                      rows={4}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-600/5 outline-none transition-all"
                    />
                  ) : (
                    <>
                      {/* Selected Items Tags */}
                      {selectedItems.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {selectedItems.map(({ item, quantity }) => (
                            <div key={item.id} className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3 py-1.5 animate-in fade-in slide-in-from-top-1 text-xs">
                              <span className="font-black text-sky-700">{item.name}</span>
                              <div className="flex items-center gap-2 border-r border-sky-200 pr-2">
                                <button type="button" onClick={() => updateQuantity(item.id!, -1)} className="p-0.5 hover:bg-sky-200 rounded-md transition-colors">
                                  <Minus size={12} className="text-sky-600" />
                                </button>
                                <span className="font-black text-sky-600 w-4 text-center">{quantity}</span>
                                <button type="button" onClick={() => updateQuantity(item.id!, 1)} className="p-0.5 hover:bg-sky-200 rounded-md transition-colors">
                                  <Plus size={12} className="text-sky-600" />
                                </button>
                                <button type="button" onClick={() => handleRemoveItem(item.id!)} className="p-1 hover:bg-red-100 rounded-md transition-colors mr-1">
                                  <X size={12} className="text-red-500" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="relative">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="חיפוש פריט במלאי..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-gray-50 border-none rounded-2xl px-12 py-4 text-sm font-bold focus:ring-2 focus:ring-sky-600/10 outline-none transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                        {filteredInventory.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleAddItem(item)}
                            className="flex items-center gap-3 p-3 bg-white border-2 border-gray-100 rounded-2xl hover:border-sky-600 hover:shadow-md transition-all text-right group"
                          >
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-sky-50 transition-colors">
                              <Package className="text-gray-400 group-hover:text-sky-600" size={18} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-xs font-black text-gray-800 truncate">{item.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">{item.sku}</p>
                            </div>
                            <Plus size={16} className="text-sky-600" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-sky-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-sky-600/20 hover:bg-sky-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <>
                      <Send size={24} />
                      {editingOrder ? 'שמור שינויים' : 'צור הזמנה ושלח לעיבוד'}
                    </>
                  )}
                </button>
                {editingOrder && (
                  <p className="text-center text-[10px] font-bold text-gray-400">
                    * ניתן להוסיף תעודת משלוח/PDF דרך כרטיס ההזמנה הראשי
                  </p>
                )}
              </form>
            </div>
          </>
        ) : (
          <div className="p-12 text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-emerald-100 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="text-emerald-500" size={48} />
            </div>
            
            <div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">הזמנה נוצרה בהצלחה!</h2>
              <p className="text-gray-500 font-bold">הנתונים עודכנו במאגר וכרטיס לקוח סונכרן</p>
            </div>

            <div className="bg-gray-50 p-8 rounded-[2rem] border-2 border-dashed border-gray-200">
              <p className="text-xs font-black text-gray-400 uppercase mb-4 tracking-widest">פרטי מעקב</p>
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-2xl font-black text-sky-600 tracking-tighter">{successOrder.trackingId}</p>
                </div>
                <p className="text-sm text-gray-600 font-bold">קישור דף קסם למעקב זמין כעת</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={sendWhatsApp}
                className="w-full py-5 bg-emerald-500 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 flex items-center justify-center gap-3 group transition-all"
              >
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                  <MessageCircle size={20} />
                </div>
                שלח עדכון ב-WhatsApp ללקוח
              </button>
              
              <button
                onClick={onClose}
                className="w-full py-5 bg-gray-100 text-gray-600 rounded-[2rem] font-black text-lg hover:bg-gray-200 transition-all"
              >
                סיום וחזרה למערכת
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OrderForm;
