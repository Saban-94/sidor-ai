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
  MapPin,
  User,
  MessageSquare,
  Send,
  PhoneCall
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseItems } from '../lib/utils';
import { Order } from '../types';

// הוספת ה-StatusBadge החסר כדי לפתור את שגיאת ה-ReferenceError
const StatusBadge = ({ status }: { status: string }) => {
  const configs: any = {
    pending: { color: 'bg-amber-500', label: 'התקבל' },
    preparing: { color: 'bg-blue-500', label: 'בהכנה' },
    ready: { color: 'bg-emerald-500', label: 'בדרך אליך' },
    on_the_way: { color: 'bg-emerald-500', label: 'בדרך אליך' },
    delivered: { color: 'bg-gray-500', label: 'סופק' },
  };
  const config = configs[status] || configs.pending;
  return (
    <span className={`${config.color} text-white px-4 py-1 rounded-full text-xs font-black shadow-sm uppercase`}>
      {config.label}
    </span>
  );
};

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // אתחול צליל התראה
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');

    if (!id) {
      setLoading(false);
      setError("מזהה מעקב חסר");
      return;
    }

    const q = query(collection(db, 'orders'), where('trackingId', '==', id), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const orderDoc = snapshot.docs[0];
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;
        setOrder(orderData);
        setEditItems(orderData.items);

        // האזנה להודעות צ'אט
        const chatQuery = query(collection(db, `orders/${orderDoc.id}/chat`), orderBy('createdAt', 'asc'));
        onSnapshot(chatQuery, (chatSnap) => {
          const newMsgs = chatSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          // אם הגיעה הודעה חדשה מהמנהל והצ'אט סגור - הפעל אפקטים
          if (newMsgs.length > messages.length && newMsgs[newMsgs.length-1].sender === 'admin' && !isChatOpen) {
            audioRef.current?.play().catch(() => {});
          }
          setMessages(newMsgs);
        });
      } else {
        setError("הזמנה לא נמצאה");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, isChatOpen]);

  // גלילה אוטומטית לסוף הצאט
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !order?.id) return;
    await addDoc(collection(db, `orders/${order.id}/chat`), {
      text: newMessage,
      sender: 'customer',
      createdAt: serverTimestamp()
    });
    setNewMessage("");
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-sky-600" size={48} /></div>;
  if (error || !order) return <div className="h-screen flex flex-col items-center justify-center p-6" dir="rtl"><AlertCircle className="text-red-500 mb-4" size={64} /><h1 className="text-xl font-black">הזמנה לא נמצאה</h1></div>;

  const statusSteps = [
    { key: 'pending', label: 'התקבל', icon: Clock },
    { key: 'preparing', label: 'בהכנה', icon: Package },
    { key: 'ready', label: 'בדרך אליך', icon: Truck },
    { key: 'delivered', label: 'סופק', icon: CheckCircle2 },
  ];
  const activeStep = order.status === 'pending' ? 0 : order.status === 'preparing' ? 1 : (order.status === 'ready' || order.status === 'on_the_way') ? 2 : 3;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center font-sans pb-24" dir="rtl">
      {/* Header */}
      <div className="w-full max-w-lg mb-6 flex items-center justify-between px-2">
         <div className="flex items-center gap-3">
            <div className="bg-sky-600 p-2 rounded-xl shadow-lg"><Truck className="text-white" size={20} /></div>
            <h1 className="text-lg font-black italic text-gray-900">SabanOS</h1>
         </div>
         <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-sky-100">
            <span className="text-sm font-black text-gray-900">#{order.orderNumber || order.trackingId?.slice(0, 8)}</span>
         </div>
      </div>

      <div className="w-full max-w-lg space-y-6">
        {/* Progress Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-xl border border-sky-50 overflow-hidden">
          <div className="bg-sky-900 p-8 text-white text-center">
            <h2 className="text-3xl font-black mb-1">{statusSteps[activeStep].label}</h2>
            <StatusBadge status={order.status} />
          </div>
          <div className="p-8">
             <div className="relative flex justify-between items-center mb-10 px-2">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0 rounded-full"></div>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(activeStep / 3) * 100}%` }} className="absolute top-1/2 right-0 h-1 bg-sky-600 -translate-y-1/2 z-0 rounded-full" />
                {statusSteps.map((step, index) => (
                  <div key={step.key} className="relative z-10 flex flex-col items-center">
                    <motion.div 
                      animate={index === activeStep ? { scale: [1, 1.15, 1], boxShadow: ["0 0 0 0px rgba(2,132,199,0)", "0 0 0 10px rgba(2,132,199,0.1)", "0 0 0 0px rgba(2,132,199,0)"] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border-4 ${index <= activeStep ? 'bg-sky-600 border-sky-100 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-300'}`}
                    >
                      <step.icon size={20} />
                    </motion.div>
                    <span className="text-[10px] font-black mt-3">{step.label}</span>
                  </div>
                ))}
             </div>
          </div>
        </motion.div>

        {/* Contact info */}
        <div className="bg-sky-50 rounded-[2rem] p-6 space-y-4">
            <h4 className="font-black text-gray-900 text-sm flex items-center gap-2"><PhoneCall size={16} /> צור קשר עם הסידור:</h4>
            <div className="grid grid-cols-2 gap-3">
                <a href="tel:0772374865" className="bg-white p-3 rounded-xl text-center font-black text-sky-600 shadow-sm">077-237-4865</a>
                <a href="tel:097602010" className="bg-white p-3 rounded-xl text-center font-black text-sky-600 shadow-sm">09-7602010</a>
            </div>
        </div>
      </div>

      {/* בועת צאט צפה עם נדנוד */}
      <motion.button 
        onClick={() => setIsChatOpen(true)}
        animate={!isChatOpen && messages.some(m => m.sender === 'admin') ? { 
          x: [0, -4, 4, -4, 4, 0],
          rotate: [0, -5, 5, -5, 5, 0]
        } : {}}
        transition={{ repeat: Infinity, duration: 0.5, repeatDelay: 3 }}
        className="fixed bottom-6 right-6 w-16 h-16 bg-sky-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40"
      >
        <MessageSquare size={28} />
        {!isChatOpen && messages.filter(m => m.sender === 'admin').length > 0 && (
            <div className="absolute -top-1 -left-1 w-5 h-5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </motion.button>

      {/* Chat Overlay */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsChatOpen(false)} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[50]" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed bottom-0 left-0 right-0 h-[80vh] bg-white rounded-t-[3rem] shadow-2xl z-[60] flex flex-col overflow-hidden">
              <div className="p-6 bg-sky-900 text-white flex justify-between items-center shrink-0">
                <p className="font-black">צ'אט תמיכה - סבן חומרי בניין</p>
                <button onClick={() => setIsChatOpen(false)} className="p-2 bg-white/10 rounded-xl"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-4 rounded-2xl max-w-[80%] font-bold text-sm ${msg.sender === 'customer' ? 'bg-sky-600 text-white' : 'bg-white text-gray-800 shadow-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-6 bg-white border-t flex gap-3">
                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="כתוב לנו..." className="flex-1 bg-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-sky-600/20" />
                <button type="submit" className="bg-sky-900 text-white p-4 rounded-2xl"><Send size={24} /></button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrackingPage;
