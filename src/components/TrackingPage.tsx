import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Truck, 
  Package, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Pencil, 
  X,
  Plus,
  ArrowRight,
  Info,
  Loader2,
  Calendar,
  MapPin,
  User,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseItems } from '../lib/utils';
import { Order } from '../types';

const TrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("מזהה מעקב חסר");
      return;
    }

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('trackingId', '==', id), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const orderData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Order;
        setOrder(orderData);
        setEditItems(orderData.items);
        setError(null);
      } else {
        setOrder(null);
        setError("הזמנה לא נמצאה. וודא שהקישור תקין.");
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setError("שגיאה בטעינת הנתונים");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const handleUpdateItems = async () => {
    if (!order?.id) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), { 
        items: editItems,
        updatedAt: new Date().toISOString()
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Update error:", err);
      alert("שגיאה בעדכון ההזמנה");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6" dir="rtl">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="mb-4"
        >
          <Loader2 size={48} className="text-sky-600" />
        </motion.div>
        <p className="text-gray-500 font-bold animate-pulse">מתחבר למערכת SabanOS...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-24 h-24 bg-red-100 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-lg shadow-red-500/10">
          <AlertCircle className="text-red-500" size={48} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">אופס! משהו לא תקין</h1>
        <p className="text-gray-500 font-bold max-w-xs mx-auto mb-8">{error || "הזמנה זו אינה קיימת במערכת"}</p>
        <a 
          href="/" 
          className="px-8 py-4 bg-sky-600 text-white rounded-[2rem] font-black shadow-xl shadow-sky-600/20 hover:scale-105 transition-transform"
        >
          חזרה לדף הבית
        </a>
      </div>
    );
  }

  const statusSteps = [
    { key: 'pending', label: 'התקבל', icon: Clock },
    { key: 'preparing', label: 'בהכנה', icon: Package },
    { key: 'on_the_way', label: 'בדרך אליך', icon: Truck },
    { key: 'delivered', label: 'סופק', icon: CheckCircle2 },
  ];

  // Map database status to our tracking steps
  const dbStatus = order.status;
  let activeStep = 0;
  if (dbStatus === 'pending') activeStep = 0;
  else if (dbStatus === 'preparing') activeStep = 1;
  else if (dbStatus === 'ready' || dbStatus === 'on_the_way') activeStep = 2;
  else if (dbStatus === 'delivered') activeStep = 3;

  const canEdit = dbStatus === 'pending';

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center font-sans" dir="rtl">
      {/* Branding Header */}
      <div className="w-full max-w-lg mb-6 flex items-center justify-between px-2">
         <div className="flex items-center gap-3">
            <div className="bg-sky-600 p-2 rounded-xl shadow-lg">
               <Truck className="text-white" size={20} />
            </div>
            <div>
               <h1 className="text-lg font-black italic tracking-tighter text-gray-900 leading-none">SabanOS</h1>
               <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Magic Tracking</p>
            </div>
         </div>
         <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-sky-100">
            <span className="text-[10px] font-black text-gray-400 block uppercase mb-0.5">מספר הזמנה</span>
            <span className="text-sm font-black text-gray-900 tracking-tight">#{order.orderNumber || order.trackingId?.slice(0, 8)}</span>
         </div>
      </div>

      <div className="w-full max-w-lg space-y-6">
        {/* Progress Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] shadow-xl shadow-sky-900/5 border border-sky-50 overflow-hidden"
        >
          <div className="bg-sky-900 p-8 text-white relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-400/10 rounded-full -ml-16 -mb-16 blur-3xl"></div>
            
            <div className="relative z-10 text-center">
              <h2 className="text-3xl font-black mb-1">
                {statusSteps[activeStep].label}
              </h2>
              <p className="text-sky-100/60 text-sm font-bold">אנחנו דואגים שהכל יגיע בזמן</p>
            </div>
          </div>

          <div className="p-8">
            {/* Visual Stepper */}
            <div className="relative flex justify-between items-center mb-10 px-2">
               <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0 rounded-full"></div>
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${(activeStep / 3) * 100}%` }}
                 transition={{ duration: 1, ease: "easeOut" }}
                 className="absolute top-1/2 right-0 h-1 bg-sky-600 -translate-y-1/2 z-0 rounded-full shadow-sm"
               ></motion.div>
               
               {statusSteps.map((step, index) => {
                 const Icon = step.icon;
                 const isActive = index <= activeStep;
                 const isCurrent = index === activeStep;
                 
                 return (
                   <div key={step.key} className="relative z-10 flex flex-col items-center">
                      <motion.div 
                        animate={isCurrent ? { scale: [1, 1.15, 1], shadow: ["0 0 0 0 rgba(2, 132, 199, 0)", "0 0 0 10px rgba(2, 132, 199, 0.1)", "0 0 0 0 rgba(2, 132, 199, 0)"] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-4 ${
                          isActive 
                            ? 'bg-sky-600 border-sky-100 text-white shadow-lg shadow-sky-600/20' 
                            : 'bg-white border-gray-100 text-gray-300'
                        }`}
                      >
                        <Icon size={20} />
                      </motion.div>
                      <span className={`text-[10px] font-black mt-3 transition-colors ${isActive ? 'text-sky-900' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                   </div>
                 );
               })}
            </div>

            {/* Dispatch Note / Real-time update */}
            <AnimatePresence>
              {order.dispatchNote && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl mb-6 flex gap-3"
                >
                  <Info className="text-emerald-500 shrink-0" size={20} />
                  <div className="text-right">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter mb-0.5">עדכון מהשטח</p>
                    <p className="text-sm font-bold text-gray-800 leading-relaxed">{order.dispatchNote}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Details Grid */}
            <div className="grid grid-cols-1 gap-4">
               <div className="bg-gray-50 p-5 rounded-3xl flex items-center gap-4 group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-sky-50">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-sky-600">
                     <User size={20} />
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black text-gray-400 uppercase">לקוח</p>
                     <p className="text-sm font-black text-gray-900">{order.customerName}</p>
                  </div>
               </div>

               <div className="bg-gray-50 p-5 rounded-3xl flex items-center gap-4 group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-sky-50">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-sky-600">
                     <MapPin size={20} />
                  </div>
                  <div className="text-right overflow-hidden">
                     <p className="text-[10px] font-black text-gray-400 uppercase">יעד אספקה</p>
                     <p className="text-sm font-black text-gray-900 truncate">{order.destination}</p>
                  </div>
               </div>

               {order.date && (
                 <div className="bg-gray-50 p-5 rounded-3xl flex items-center gap-4 group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-sky-50">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-sky-600">
                       <Calendar size={20} />
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-400 uppercase">מועד אספקה מתוכנן</p>
                       <p className="text-sm font-black text-gray-900">{order.date} בשעה {order.time || '--:--'}</p>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </motion.div>

        {/* Order Items Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2.5rem] shadow-xl shadow-sky-900/5 border border-sky-50 overflow-hidden"
        >
           <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-2">
                    <Package className="text-sky-600" size={20} />
                    <h3 className="text-lg font-black text-gray-900 italic">פירוט הזמנה</h3>
                 </div>
                 {canEdit && (
                    <button 
                      onClick={() => setIsEditing(!isEditing)}
                      className={`p-2 rounded-xl transition-all ${isEditing ? 'bg-red-50 text-red-500' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'}`}
                    >
                       {isEditing ? <X size={18} /> : <Pencil size={18} />}
                    </button>
                 )}
              </div>

              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div 
                    key="editing"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-4"
                  >
                     <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 mb-4">
                        <Info className="text-amber-500 shrink-0" size={18} />
                        <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                          המערכת טרם התחילה בטיפול בהזמנה. ניתן לערוך את הרשימה כעת. 
                          השינויים יופיעו מיידית במשרד.
                        </p>
                     </div>
                     <textarea 
                       value={editItems}
                       onChange={(e) => setEditItems(e.target.value)}
                       placeholder="מה להוסיף או להוריד? (למשל: 5 שקי מלט)"
                       rows={5}
                       className="w-full bg-gray-50 border-2 border-transparent rounded-[1.5rem] px-6 py-4 text-sm font-bold text-gray-800 outline-none focus:bg-white focus:border-sky-600 transition-all placeholder:text-gray-300"
                     />
                     <button
                       onClick={handleUpdateItems}
                       className="w-full py-4 bg-sky-900 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-sky-900/20 hover:bg-sky-950 transition-all"
                     >
                       עדכן הזמנה במשרד
                     </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="display"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                     {parseItems(order.items).map((p, i) => (
                       <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 group hover:border-sky-200 transition-all">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 text-gray-400 group-hover:text-sky-600 transition-colors">
                                <Plus size={16} />
                             </div>
                             <div>
                                <p className="text-sm font-black text-gray-900 leading-none mb-1">{p.name}</p>
                                {p.sku && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SKU: {p.sku}</p>}
                             </div>
                          </div>
                          <div className="bg-sky-600 px-3 py-1.5 rounded-xl">
                             <span className="text-xs font-black text-white">{p.quantity} יח'</span>
                          </div>
                       </div>
                     ))}
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
        </motion.div>

        {/* Footer Support */}
        <div className="text-center py-6">
           <div className="flex items-center justify-center gap-2 mb-2">
              <MessageSquare size={16} className="text-gray-400" />
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">זקוק לעזרה? פנה למשרדי סבן חומרי בניין</p>
           </div>
           <div className="flex justify-center gap-4">
              <a href="tel:091234567" className="text-xs font-black text-sky-600 hover:underline">חייג למשרד</a>
              <span className="text-gray-200">•</span>
              <a href="https://wa.me/972500000000" className="text-xs font-black text-emerald-600 hover:underline">שלח וואטסאפ</a>
           </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;
