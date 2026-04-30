import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  MapPin, 
  Package, 
  Truck, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Minus,
  Search,
  ShoppingCart,
  Send,
  Loader2,
  CheckCircle2,
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import { Order, InventoryItem } from '../types';
import { createOrder, updateOrder } from '../services/auraService';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

import { useToast } from '../providers/ToastProvider';

interface MobileOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onSuccess: (order: Order) => void;
  editingOrder?: Order | null;
}

const STEPS = [
  { id: 'customer', title: 'פרטי לקוח', icon: User },
  { id: 'logistics', title: 'לוגיסטיקה', icon: Truck },
  { id: 'items', title: 'פריטים', icon: Package },
  { id: 'review', title: 'סיכום ושילוח', icon: Send },
];

export const MobileOrderForm: React.FC<MobileOrderFormProps> = ({ 
  isOpen, 
  onClose, 
  inventory,
  onSuccess,
  editingOrder
}) => {
  const { addToast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    destination: '',
    warehouse: 'החרש',
    driverId: 'pending',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    status: 'pending',
    documentIds: [] as string[]
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [docInput, setDocInput] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ item: InventoryItem, quantity: number }[]>([]);
  const [manualItems, setManualItems] = useState('');
  const [isManualItems, setIsManualItems] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (editingOrder) {
      setFormData({
        customerName: editingOrder.customerName || '',
        customerPhone: editingOrder.customerPhone || editingOrder.phone || '',
        destination: editingOrder.destination || '',
        warehouse: editingOrder.warehouse || 'החרש',
        driverId: editingOrder.driverId || 'pending',
        date: editingOrder.date || format(new Date(), 'yyyy-MM-dd'),
        time: editingOrder.time || format(new Date(), 'HH:mm'),
        status: editingOrder.status || 'pending',
        documentIds: editingOrder.documentIds || []
      });
      setManualItems(editingOrder.items || '');
      setIsManualItems(true);
    } else {
      setFormData({
        customerName: '',
        customerPhone: '',
        destination: '',
        warehouse: 'החרש',
        driverId: 'pending',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        status: 'pending',
        documentIds: []
      });
      setManualItems('');
      setSelectedItems([]);
      setIsManualItems(false);
    }
    setStep(0);
    setSuccessOrder(null);
  }, [editingOrder, isOpen]);

  useEffect(() => {
    const fetchDrivers = async () => {
      const q = query(collection(db, 'drivers'));
      const snap = await getDocs(q);
      setDrivers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchDrivers();
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const validateStep = () => {
    if (step === 0) return formData.customerName.length > 2;
    if (step === 1) return formData.destination.length > 2;
    if (step === 2) return isManualItems ? manualItems.length > 2 : selectedItems.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const itemsString = isManualItems 
        ? manualItems 
        : selectedItems.map(si => `${si.item.name} (${si.quantity})`).join(', ');

      const orderData: any = {
        ...formData,
        items: itemsString,
        updatedAt: new Date()
      };

      if (!editingOrder) {
        orderData.createdAt = new Date();
      }

      if (editingOrder?.id) {
        await updateOrder(editingOrder.id, orderData);
        addToast('עדכון הזמנה', `הזמנה עבור ${formData.customerName} עודכנה בהצלחה! ✅`, 'success');
        onSuccess({...editingOrder, ...orderData});
        onClose();
      } else {
        const result = await createOrder(orderData);
        addToast('הזמנה חדשה', `הזמנה עבור ${formData.customerName} נוצרה ושוגרה! 🚀`, 'success');
        setSuccessOrder(result);
        onSuccess(result);
      }
    } catch (error) {
      console.error(error);
      addToast('שגיאה', 'שגיאה בשמירת ההזמנה', 'warning');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col font-sans" dir="rtl">
      {/* Header */}
      <div className="bg-gray-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center">
            <Package size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black italic">{editingOrder ? 'עדכון הזמנה' : 'הזמנה מהשטח'}</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SabanOS Mobile Wizard</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
          <X size={24} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 w-full bg-gray-100 flex">
        {STEPS.map((_, i) => (
          <div 
            key={i} 
            className={`flex-1 h-full transition-all duration-500 ${i <= step ? 'bg-sky-600' : 'bg-transparent'}`} 
          />
        ))}
      </div>

      {/* Form Content */}
      {!successOrder ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-3 text-sky-600 mb-2">
              {React.createElement(STEPS[step].icon, { size: 24 })}
              <h2 className="text-2xl font-black">{STEPS[step].title}</h2>
            </div>
            <p className="text-gray-400 text-xs font-bold">שלב {step + 1} מתוך {STEPS.length}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 flex-1"
            >
              {step === 0 && (
                <div className="space-y-6">
                  <div className="space-y-2 relative">
                    <label className="text-xs font-black text-gray-400 px-1 uppercase">שם לקוח</label>
                    <input 
                      type="text"
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-sky-600 transition-all outline-none"
                      placeholder="חפש או הזן שם לקוח..."
                      value={formData.customerName}
                      onChange={(e) => {
                        setFormData({...formData, customerName: e.target.value});
                        setShowSuggestions(true);
                      }}
                    />
                    {showSuggestions && (
                      <div className="absolute z-10 w-full bg-white shadow-xl rounded-2xl border border-gray-100 mt-1 max-h-40 overflow-y-auto">
                        {inventory.slice(0, 5).map((_, i) => (
                           // Mock suggestions for demo
                           <button key={i} className="w-full text-right p-4 hover:bg-gray-50 font-bold text-sm border-b border-gray-50 last:border-0" onClick={() => {
                             setFormData({...formData, customerName: 'לקוח מזדמן'});
                             setShowSuggestions(false);
                           }}>
                             לקוח לדוגמה {i+1}
                           </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 px-1 uppercase">טלפון</label>
                    <input 
                      type="tel"
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-sky-600 transition-all outline-none"
                      placeholder="05XXXXXXXX"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 px-1 uppercase">כתובת יעד</label>
                    <input 
                      type="text"
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-sky-600 transition-all outline-none"
                      placeholder="הקלק כתובת לאספקה..."
                      value={formData.destination}
                      onChange={(e) => setFormData({...formData, destination: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {['החרש', 'התלמיד'].map((wh) => (
                      <button
                        key={wh}
                        onClick={() => setFormData({...formData, warehouse: wh as any})}
                        className={`p-4 rounded-2xl font-black text-sm border-2 transition-all ${
                          formData.warehouse === wh ? 'bg-sky-600 border-sky-600 text-white' : 'bg-gray-50 border-transparent text-gray-400'
                        }`}
                      >
                        מחסן {wh}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col h-full gap-4">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-black text-gray-400 uppercase">פירוט הזמנה</label>
                    <button 
                      onClick={() => setIsManualItems(!isManualItems)}
                      className="text-[10px] font-black text-sky-600 underline"
                    >
                      עבור ל{isManualItems ? 'בחירה ממלאי' : 'הקלדה חופשית'}
                    </button>
                  </div>

                  {isManualItems ? (
                    <textarea 
                      className="w-full flex-1 bg-gray-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-sky-600 transition-all outline-none resize-none min-h-[200px]"
                      placeholder="הזן פריטים וכמויות..."
                      value={manualItems}
                      onChange={(e) => setManualItems(e.target.value)}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="relative">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="text"
                          placeholder="חפש פריט..."
                          className="w-full bg-gray-50 rounded-2xl p-4 pr-12 text-sm font-bold outline-none"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {inventory
                          .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .slice(0, 15)
                          .map(item => (
                            <button
                              key={item.id}
                              className="w-full bg-gray-50 p-4 rounded-2xl flex justify-between items-center"
                              onClick={() => {
                                const exist = selectedItems.find(si => si.item.id === item.id);
                                if (exist) {
                                  setSelectedItems(prev => prev.map(si => si.item.id === item.id ? { ...si, quantity: si.quantity + 1 } : si));
                                } else {
                                  setSelectedItems(prev => [...prev, { item, quantity: 1 }]);
                                }
                              }}
                            >
                              <span className="font-bold">{item.name}</span>
                              <Plus size={16} className="text-sky-600" />
                            </button>
                          ))}
                      </div>
                      {selectedItems.length > 0 && (
                        <div className="bg-sky-50 p-4 rounded-2xl space-y-2">
                          <p className="text-[10px] font-black text-sky-600 uppercase mb-2">פריטים שנבחרו ({selectedItems.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedItems.map(({ item, quantity }) => (
                              <div key={item.id} className="bg-white px-3 py-1.5 rounded-xl border border-sky-100 flex items-center gap-3">
                                <span className="text-xs font-bold">{item.name}</span>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setSelectedItems(p => p.map(si => si.item.id === item.id ? { ...si, quantity: Math.max(0, si.quantity - 1) } : si).filter(si => si.quantity > 0))} className="p-0.5 bg-gray-100 rounded">
                                    <Minus size={10} />
                                  </button>
                                  <span className="text-xs font-black">{quantity}</span>
                                  <button onClick={() => setSelectedItems(p => p.map(si => si.item.id === item.id ? { ...si, quantity: si.quantity + 1 } : si))} className="p-0.5 bg-gray-100 rounded">
                                    <Plus size={10} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-6 rounded-[2rem] space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-sky-600 shadow-sm">
                        <User size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-black">{formData.customerName}</p>
                        <p className="text-xs text-gray-500">{formData.customerPhone}</p>
                      </div>
                    </div>
                    <div className="h-px bg-gray-200" />
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-sky-600 shadow-sm">
                        <MapPin size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-black">{formData.destination}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">מחסן {formData.warehouse}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-gray-400 px-1 uppercase">מזהי מסמכים (חשבוניות, תעודות)</label>
                       <div className="flex gap-2">
                         <input 
                           type="text"
                           className="flex-1 bg-gray-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-sky-600 transition-all outline-none"
                           placeholder="הזן מזהה מסמך..."
                           value={docInput}
                           onChange={(e) => setDocInput(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter' && docInput.trim()) {
                               setFormData(prev => ({ ...prev, documentIds: [...prev.documentIds, docInput.trim()] }));
                               setDocInput('');
                             }
                           }}
                         />
                         <button 
                           onClick={() => {
                             if (docInput.trim()) {
                               setFormData(prev => ({ ...prev, documentIds: [...prev.documentIds, docInput.trim()] }));
                               setDocInput('');
                             }
                           }}
                           className="p-4 bg-sky-600 text-white rounded-2xl"
                         >
                           <Plus size={20} />
                         </button>
                       </div>
                       {formData.documentIds.length > 0 && (
                         <div className="flex flex-wrap gap-2 mt-2">
                           {formData.documentIds.map((id, idx) => (
                             <div key={idx} className="bg-sky-50 text-sky-600 px-3 py-1.5 rounded-xl border border-sky-100 flex items-center gap-2">
                               <span className="text-xs font-bold">{id}</span>
                               <button onClick={() => setFormData(prev => ({ ...prev, documentIds: prev.documentIds.filter((_, i) => i !== idx) }))}>
                                 <X size={12} />
                               </button>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 px-1 uppercase">שיבוץ נהג</label>
                      <select 
                        className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-sky-600 transition-all outline-none appearance-none"
                        value={formData.driverId}
                        onChange={(e) => setFormData({...formData, driverId: e.target.value})}
                      >
                        <option value="pending">ממתין לשיבוץ</option>
                        <option value="self">איסוף עצמי</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer Controls */}
          <div className="mt-8 flex gap-4 shrink-0">
            {step > 0 && (
              <button 
                onClick={handleBack}
                className="flex-[0.5] py-4 bg-gray-100 text-gray-600 rounded-2xl font-black transition-all"
              >
                חזור
              </button>
            )}
            <button 
              onClick={step === STEPS.length - 1 ? handleSubmit : handleNext}
              disabled={!validateStep() || loading}
              className={`flex-1 py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
                !validateStep() ? 'bg-gray-200 text-gray-400 shadow-none' : 'bg-sky-600 hover:bg-sky-700'
              }`}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : step === STEPS.length - 1 ? (
                <>שגר נתונים <Send size={18} /></>
              ) : (
                <>המשך <ChevronLeft size={18} /></>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-emerald-100 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="text-emerald-500" size={48} />
          </div>
          <h2 className="text-3xl font-black mb-2">שוגר בהצלחה!</h2>
          <p className="text-gray-500 font-bold mb-12">הזמנה עודכנה ב-Firestore ובענן GAS</p>
          
          <div className="w-full space-y-4">
            <button
              onClick={() => {
                if (!successOrder) return;
                const phone = formData.customerPhone.startsWith('0') ? '972' + formData.customerPhone.slice(1) : formData.customerPhone;
                const link = `https://sidor-ai-xi.vercel.app/track/${successOrder.trackingId}`;
                const message = `שלום ${formData.customerName}, הזמנתך מסבן התקבלה! עקוב כאן: ${link}`;
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              className="w-full py-5 bg-emerald-500 text-white rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-xl"
            >
              <MessageCircle size={20} /> שלח WhatsApp ללקוח
            </button>
            <button
              onClick={onClose}
              className="w-full py-5 bg-gray-100 text-gray-600 rounded-[2rem] font-black"
            >
              סגור וחזור לדאשבורד
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
