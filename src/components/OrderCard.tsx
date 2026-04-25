import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, Info, Clock, CheckCircle2, CheckCircle, Sparkles, Send, User,
  Pencil, AlertCircle, Trash2, Share2, RotateCcw, Eye, FileUp, Loader2,
  Package, X, MessageSquare, Phone
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, Driver, InventoryItem } from '../types';
import { highlightText, parseItems, cn } from '../lib/utils';

// --- רכיב בועת התראה ופופ-אפ מענה ---
const QuickChatPopup = ({ order, onAddToast }: { order: Order, onAddToast: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    
    const chatRef = collection(db, `orders/${order.id}/chat`);
    const q = query(chatRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => d.data());
      setMessages(msgs);
      
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.sender === 'customer') {
        setHasUnread(true);
        if (!isOpen) audioRef.current?.play().catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [order.id, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      await addDoc(collection(db, `orders/${order.id}/chat`), {
        text: replyText,
        sender: 'admin',
        createdAt: serverTimestamp()
      });
      setReplyText("");
      setHasUnread(false);
      onAddToast("הודעה נשלחה", `שלחת הודעה ל-${order.customerName}`, "success");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      {/* בועת התראה רוטטת */}
      {hasUnread && !isOpen && (
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1, x: [0, -2, 2, -2, 2, 0] }}
          transition={{ x: { repeat: Infinity, duration: 0.5, repeatDelay: 2 } }}
          onClick={() => setIsOpen(true)}
          className="absolute -top-3 -right-3 z-30 cursor-pointer bg-rose-500 text-white p-2.5 rounded-2xl shadow-xl border-2 border-white"
        >
          <MessageSquare size={18} fill="currentColor" />
          <div className="absolute inset-0 rounded-2xl bg-rose-500 animate-ping opacity-25"></div>
        </motion.div>
      )}

      {/* פופ-אפ מענה מהיר */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute top-0 right-0 w-80 bg-white shadow-2xl rounded-[2rem] border border-sky-100 z-[40] overflow-hidden flex flex-col h-[400px]"
          >
            <div className="p-4 bg-sky-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-sky-600 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {order.customerName.charAt(0)}
                </div>
                <span className="text-xs font-black truncate max-w-[120px]">{order.customerName}</span>
              </div>
              <button onClick={() => { setIsOpen(false); setHasUnread(false); }} className="p-1.5 hover:bg-white/10 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === 'admin' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] font-bold shadow-sm ${
                    m.sender === 'admin' ? 'bg-sky-600 text-white' : 'bg-white text-gray-800 border border-gray-100'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2">
              <input 
                value={replyText} onChange={(e) => setReplyText(e.target.value)}
                placeholder="הקלד תשובה..."
                className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-sky-600/20"
              />
              <button type="submit" className="w-10 h-10 bg-sky-900 text-white rounded-xl flex items-center justify-center">
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export const OrderCard = (props: OrderCardProps) => {
  const { order, drivers, onEdit, onUpdateStatus, onDelete, onAddToast, searchQuery = '', isCompact = false } = props;
  const driver = drivers.find(d => d.id === order.driverId);

  return (
    <motion.div layout className={cn(
      "bg-white/95 backdrop-blur-sm rounded-[2rem] border border-sky-100 shadow-lg relative group transition-all",
      isCompact ? "p-4" : "p-5"
    )}>
      {/* פופ-אפ צ'אט לקוח משולב */}
      {order.id && <QuickChatPopup order={order} onAddToast={onAddToast} />}

      <div className="absolute top-4 left-4 bg-gray-900 text-white px-3 py-1 rounded-full text-[10px] font-black z-10">
        #{order.orderNumber || order.id?.slice(-4).toUpperCase()}
      </div>

      <div className="flex gap-4 pt-2 mb-6">
        <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl border border-blue-100 flex items-center justify-center">
          <Truck size={24} strokeWidth={2.5} />
        </div>
        <div className="flex-1 text-right">
          <h3 className="font-black text-gray-900 text-xl leading-tight mb-1">{highlightText(order.customerName, searchQuery)}</h3>
          <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
            <Info size={10} /> {highlightText(order.destination, searchQuery)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-sky-50/50 rounded-2xl p-4 mb-6">
        <div className="flex flex-col gap-1 text-right">
          <div className="flex items-center gap-2">
            <span className="font-black text-gray-900 text-sm">{driver?.name || 'ממתין'}</span>
            <span className="font-black text-sky-600 text-sm">| {order.time}</span>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button 
            onClick={() => {
              const nextMap: any = { pending: 'preparing', preparing: 'ready', ready: 'delivered' };
              onUpdateStatus(order.id!, nextMap[order.status] || order.status);
            }}
            className="flex-1 bg-sky-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all"
          >
            עדכן סטטוס
          </button>
          
          <button onClick={() => onEdit(order)} className="p-3 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-2xl transition-all"><Pencil size={18} /></button>
          <button onClick={() => onDelete(order.id!)} className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={18} /></button>
      </div>
    </motion.div>
  );
};
