import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc,
  addDoc,
  orderBy,
  serverTimestamp 
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
  Info,
  Loader2,
  Calendar,
  MapPin,
  User,
  MessageSquare,
  Send,
  PhoneCall
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
  
  // Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

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
        const orderDoc = snapshot.docs[0];
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;
        setOrder(orderData);
        setEditItems(orderData.items);
        setError(null);

        const chatQuery = query(
          collection(db, `orders/${orderDoc.id}/chat`),
          orderBy('createdAt', 'asc')
        );
        onSnapshot(chatQuery, (chatSnap) => {
          setMessages(chatSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

      } else {
        setOrder(null);
        setError("הזמנה לא נמצאה. וודא שהקישור תקין.");
      }
      setLoading(false);
    }, (err) => {
      setError("שגיאה בתקשורת עם השרת");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !order?.id) return;
    try {
      await addDoc(collection(db, `orders/${order.id}/chat`), {
        text: newMessage,
        sender: 'customer',
        createdAt: serverTimestamp()
      });
      setNewMessage("");
    } catch (err) {
      console.error("Chat error:", err);
    }
  };

  const handleUpdateItems = async () => {
    if (!order?.id) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), { 
        items: editItems,
        updatedAt: new Date().toISOString()
      });
      setIsEditing(false);
    } catch (err) {
      alert("שגיאה בעדכון ההזמנה");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6" dir="rtl">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
        <Loader2 size={48} className="text-sky-600 mb-4" />
      </motion.div>
      <p className="text-gray-500 font-bold animate-pulse">מתחבר למערכת SabanOS...</p>
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
      <div className="w-24 h-24 bg-red-100 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-lg shadow-red-500/20">
        <AlertCircle className="text-red-500" size={48} />
      </div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">אופס! משהו לא תקין</h1>
      <p className="text-gray-500 font-bold mb-8">{error || "הזמנה זו אינה קיימת"}</p>
      <a href="/" className="px-8 py-4 bg-sky-600 text-white rounded-[2rem] font-black shadow-xl">חזרה לדף הבית</a>
    </div>
  );

  // מערך סטטוסים מעודכן עם אימוג'ים
  const statusSteps = [
    { key: 'pending', label: 'ממתין לאישור', icon: Clock, emoji: '⏳' },
    { key: 'preparing', label: 'בהכנה', icon: Package, emoji: '🏗️' },
    { key: 'loading', label: 'מעמיס', icon: Package, emoji: '📦' },
    { key: 'on_the_way', label: 'בדרך אליך', icon: Truck, emoji: '🚚' },
    { key: 'delivered', label: 'סופק', icon: CheckCircle2, emoji: '✅' },
  ];

  const dbStatus = order.status;
  // לוגיקה למציאת השלב הנוכחי
  let activeStep = 0;
  if (dbStatus === 'pending') activeStep = 0;
  else if (dbStatus === 'preparing') activeStep = 1;
  else if (dbStatus === 'ready') activeStep = 2;
  else if (dbStatus === 'on_the_way') activeStep = 3;
  else if (dbStatus === 'delivered') activeStep = 4;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center font-sans pb-24" dir="rtl">
      {/* Header Branding */}
      <div className="w-full max-w-lg mb-6 flex items-center justify-between px-2">
         <div className="flex items-center gap-3">
            <div className="bg-sky-600 p-2 rounded-xl shadow-lg shadow-sky-600/20"><Truck className="text-white" size={20} /></div>
            <div>
               <h1 className="text-lg font-black italic text-gray-900 leading-none">SabanOS</h1>
               <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Magic Tracking</p>
            </div>
         </div>
         <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-sky-100">
            <span className="text-[10px] font-black text-gray-400 block uppercase">מספר הזמנה</span>
            <span className="text-sm font-black text-gray-900 tracking-tight">#{order.orderNumber || order.trackingId?.slice(0, 8)}</span>
         </div>
      </div>

      <div className="w-full max-w-lg space-y-6">
        {/* Progress Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-xl shadow-sky-900/5 border border-sky-50 overflow-hidden">
          <div className="bg-sky-900 p-8 text-white relative text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <motion.h2 
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-3xl font-black mb-1"
            >
              {statusSteps[activeStep].emoji} {statusSteps[activeStep].label}
            </motion.h2>
            <p className="text-sky-100/60 text-sm font-bold italic tracking-wide">חברת ח.סבן חומרי בניין בע"מ</p>
          </div>
          
          <div className="p-8">
            <div className="relative flex justify-between items-center mb-12 px-2">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0 rounded-full"></div>
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${(activeStep / (statusSteps.length - 1)) * 100}%` }} 
                className="absolute top-1/2 right-0 h-1 bg-sky-600 -translate-y-1/2 z-0 rounded-full shadow-sm"
              />
              {statusSteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index <= activeStep;
                const isCurrent = index === activeStep;
                return (
                  <div key={step.key + index} className="relative z-10 flex flex-col items-center">
                    <motion.div 
                      animate={isCurrent ? { 
                        scale: [1, 1.15, 1], 
                        boxShadow: ["0 0 0 0px rgba(2,132,199,0)", "0 0 0 10px rgba(2,132,199,0.15)", "0 0 0 0px rgba(2,132,199,0)"],
                        opacity: [1, 0.7, 1]
                      } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-4 ${isActive ? 'bg-sky-600 border-sky-100 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-300'}`}
                    >
                      <Icon size={18} />
                    </motion.div>
                    <span className={`text-[9px] font-black mt-3 transition-colors text-center max-w-[50px] leading-tight ${isActive ? 'text-sky-900' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
               <div className="bg-gray-50 p-5 rounded-3xl flex items-center gap-4 border border-transparent hover:bg-white hover:shadow-md transition-all">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-sky-600"><User size={20} /></div>
                  <div className="text-right">
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">לקוח</p>
                     <p className="text-sm font-black text-gray-900">{order.customerName}</p>
                  </div>
               </div>
               <div className="bg-gray-50 p-5 rounded-3xl flex items-center gap-4 border border-transparent hover:bg-white hover:shadow-md transition-all">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-sky-600"><MapPin size={20} /></div>
                  <div className="text-right flex-1 truncate">
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">יעד אספקה</p>
                     <p className="text-sm font-black text-gray-900 truncate">{order.destination}</p>
                  </div>
               </div>
            </div>
          </div>
        </motion.div>

        {/* Items Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-[2.5rem] shadow-xl border border-sky-50 p-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Package className="text-sky-600" size={20} />
                    <h3 className="text-lg font-black text-gray-900 italic">פירוט פריטים</h3>
                </div>
                {dbStatus === 'pending' && (
                    <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-100 transition-all">
                        {isEditing ? <X size={18} /> : <Pencil size={18} />}
                    </button>
                )}
            </div>
            
            {isEditing ? (
                <div className="space-y-4">
                    <textarea value={editItems} onChange={(e) => setEditItems(e.target.value)} rows={4} className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-sky-600 outline-none transition-all shadow-inner" />
                    <button onClick={handleUpdateItems} className="w-full py-4 bg-sky-900 text-white rounded-[1.5rem] font-black text-sm shadow-xl hover:bg-sky-950 transition-all">עדכן הזמנה במשרד</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {parseItems(order.items).map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 group hover:border-sky-200 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-100 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-all"><Plus size={14} /></div>
                                <span className="text-sm font-black text-gray-900">{p.name}</span>
                            </div>
                            <span className="bg-sky-600 text-white px-3 py-1 rounded-xl text-[10px] font-black shadow-sm">{p.quantity} יח'</span>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>

        {/* Contact info & Direct Calls */}
        <div className="bg-sky-50 rounded-[2.5rem] p-8 space-y-6 border border-sky-100">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-sky-600 rounded-lg text-white shadow-md"><PhoneCall size={18} /></div>
                <h4 className="font-black text-gray-900">יצירת קשר עם הסידור</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a href="tel:0772374865" className="flex items-center justify-center gap-2 bg-white border border-sky-100 py-4 rounded-2xl font-black text-sky-600 shadow-sm hover:shadow-md transition-all active:scale-95">
                    077-237-4865
                </a>
                <a href="tel:097602010" className="flex items-center justify-center gap-2 bg-white border border-sky-100 py-4 rounded-2xl font-black text-sky-600 shadow-sm hover:shadow-md transition-all active:scale-95">
                    09-7602010
                </a>
            </div>
            <a href="https://wa.me/972508860896" className="w-full py-5 bg-emerald-500 text-white rounded-[1.5rem] font-black shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 active:scale-95">
                <MessageSquare size={20} />
                שלח WhatsApp לסידור
            </a>
        </div>
      </div>

      {/* Floating Chat Button */}
      <button 
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-sky-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-40"
      >
        <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 rounded-full bg-white"></motion.div>
        <MessageSquare size={28} />
      </button>

      {/* Chat Interface Overlay */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsChatOpen(false)} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[50]" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed bottom-0 left-0 right-0 h-[85vh] bg-white rounded-t-[3rem] shadow-2xl z-[60] flex flex-col overflow-hidden">
              <div className="p-6 bg-sky-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><MessageSquare size={20} /></div>
                  <div>
                    <p className="font-black text-sm mb-0.5">צ'אט עם המשרד</p>
                    <p className="text-[10px] text-sky-300 font-bold uppercase tracking-widest italic">SabanOS LIVE Support</p>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                {messages.length === 0 ? (
                  <div className="text-center py-20 opacity-40">
                    <MessageSquare size={48} className="mx-auto text-sky-200 mb-4" />
                    <p className="font-black text-sm">היי {order.customerName.split(' ')[0]}, יש לך שאלה?</p>
                    <p className="text-xs font-bold">אנחנו זמינים כאן לכל דבר</p>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] p-4 rounded-[1.8rem] font-bold text-sm shadow-sm ${msg.sender === 'customer' ? 'bg-sky-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-gray-100 shrink-0 flex gap-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="הקלד הודעה לסידור..." className="flex-1 bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-600/10 transition-all shadow-inner" />
                <button type="submit" className="w-14 h-14 bg-sky-900 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-sky-950 transition-all active:scale-90"><Send size={24} /></button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrackingPage;
