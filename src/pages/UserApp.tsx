import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, Paperclip, ChevronRight, Truck, User, CheckCheck, 
  Loader2, Sparkles, LayoutList, MessageSquare, MapPin, Package, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getPrivateChatHistory, 
  saveMessage, 
  askNoaPersonalized,
  fetchOrders // וודא שהפונקציה הזו קיימת ב-auraService
} from '../services/auraService2';
import { Order } from '../types';

export const UserApp = () => {
  const { userKey } = useParams<{ userKey: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'chat' | 'orders'>('chat');
  const [messages, setMessages] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const profiles: Record<string, any> = {
    harel: { name: 'הראל אידלסון', avatar: 'https://i.postimg.cc/d3S0NJJZ/Screenshot-20250623-200646-Facebook.jpg', color: '#075e54' },
    vered: { name: 'ורד אידלסון', avatar: 'https://i.pravatar.cc/150?u=vered', color: '#d63384' },
    oren: { name: 'אורן חצר', avatar: 'https://i.postimg.cc/tCNbgXK3/Screenshot-20250623-200744-Tik-Tok.jpg', color: '#128c7e' }
  };

  const currentProfile = profiles[userKey || 'harel'] || profiles.harel;

  // טעינת נתונים
  useEffect(() => {
    const init = async () => {
      if (!userKey) return;
      const [history, ordersData] = await Promise.all([
        getPrivateChatHistory(userKey),
        fetchOrders(new Date().toISOString().split('T')[0]) // טעינת הזמנות להיום
      ]);
      setMessages(history.map(h => ({ text: h.parts[0].text, sender: h.role === 'user' ? 'me' : 'noa', time: '01:09' })));
      setOrders(ordersData);
    };
    init();
  }, [userKey]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    setMessages(prev => [...prev, { text, sender: 'me', time: 'now' }]);
    setIsTyping(true);
    const response = await askNoaPersonalized(text, userKey || 'harel', messages);
    setMessages(prev => [...prev, { text: response.text, sender: 'noa', time: 'now' }]);
    setIsTyping(false);
  };

  return (
    <div className="h-screen flex flex-col bg-[#e5ddd5] font-sans overflow-hidden" dir="rtl">
      {/* Header מעוצב */}
      <header className="px-4 py-3 text-white shadow-md z-20 flex flex-col gap-3" style={{ backgroundColor: currentProfile.color }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="p-1 hover:bg-black/10 rounded-full"><ChevronRight /></button>
            <img src={currentProfile.avatar} className="w-10 h-10 rounded-full border border-white/20" alt="" />
            <div className="flex flex-col">
              <span className="font-bold text-sm">{currentProfile.name}</span>
              <span className="text-[10px] opacity-80">מחובר לנועה AI</span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-black/10 rounded-lg p-1">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-white/70'}`}
          >
            <MessageSquare size={14} /> צ'אט נועה
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-gray-900 shadow-sm' : 'text-white/70'}`}
          >
            <LayoutList size={14} /> הזמנות להיום
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' ? (
            <motion.div 
              key="chat" 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-3 pb-24"
            >
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'me' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-2 rounded-xl shadow-sm relative ${msg.sender === 'me' ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.text}</p>
                    <span className="text-[9px] text-gray-500 block text-left mt-1">{msg.time}</span>
                  </div>
                </div>
              ))}
              {isTyping && <div className="bg-white p-3 rounded-xl w-fit animate-pulse text-xs text-gray-400">נועה מקלידה...</div>}
            </motion.div>
          ) : (
            <motion.div 
              key="orders" 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-4"
            >
              <h2 className="text-lg font-black text-gray-800 border-r-4 border-emerald-600 pr-3 mb-4">סידור עבודה להיום</h2>
              {orders.length === 0 ? (
                <div className="bg-white/50 p-8 rounded-2xl text-center text-gray-500 italic">אין הזמנות רשומות כרגע...</div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm border-r-8 border-emerald-500 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-900">{order.customerName}</h3>
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">{order.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-600"><MapPin size={12}/> {order.destination}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-600"><Clock size={12}/> {order.time}</div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-900 font-medium col-span-2 mt-1 bg-gray-50 p-2 rounded-lg"><Package size={12} className="text-emerald-600"/> {order.items}</div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input - מוצג רק בצ'אט */}
      {activeTab === 'chat' && (
        <footer className="p-2 bg-[#f0f2f5] flex items-center gap-2 z-20">
          <div className="flex-1 bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-sm border border-gray-200">
            <Sparkles size={20} className="text-emerald-500" />
            <input 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="דבר עם נועה..." 
              className="flex-1 bg-transparent border-none outline-none text-sm py-1" 
            />
          </div>
          <button onClick={handleSendMessage} className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md active:scale-95" style={{ backgroundColor: currentProfile.color }}>
            <Send size={20} />
          </button>
        </footer>
      )}
    </div>
  );
};
