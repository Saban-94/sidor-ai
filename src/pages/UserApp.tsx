import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, ChevronRight, MessageSquare, LayoutList, MapPin, Package, Clock, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getPrivateChatHistory, 
  saveMessage, 
  askNoaPersonalized,
  fetchOrders 
} from '../services/auraService2'; // שימוש ב-Service החדש שבנינו
import { Order } from '../types';

export const UserApp = () => {
  const { userKey } = useParams<{ userKey: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'chat' | 'orders'>('chat');
  const [messages, setMessages] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const profiles: Record<string, any> = {
    harel: { name: 'הראל אידלסון', avatar: 'https://i.postimg.cc/d3S0NJJZ/Screenshot-20250623-200646-Facebook.jpg', color: '#075e54' },
    vered: { name: 'ורד אידלסון', avatar: 'https://i.pravatar.cc/150?u=vered', color: '#d63384' },
    oren: { name: 'אורן חצר', avatar: 'https://i.postimg.cc/tCNbgXK3/Screenshot-20250623-200744-Tik-Tok.jpg', color: '#128c7e' },
    netanel: { name: 'נתנאל רבינוביץ', avatar: 'https://i.pravatar.cc/150?u=netanel', color: '#2b5278' }
  };

  const currentProfile = profiles[userKey || 'harel'] || profiles.harel;

  // טעינת היסטוריית צ'אט והזמנות מה-Firebase
  useEffect(() => {
    const loadData = async () => {
      if (!userKey) return;
      
      // טעינת היסטוריה
      const history = await getPrivateChatHistory(userKey);
      setMessages(history.map(h => ({ 
        text: h.parts[0].text, 
        sender: h.role === 'model' ? 'noa' : 'me', 
        time: 'היום' 
      })));

      // טעינת הזמנות להיום
      setIsLoadingOrders(true);
      const today = new Date().toISOString().split('T')[0];
      const ordersData = await fetchOrders(today);
      setOrders(ordersData);
      setIsLoadingOrders(false);
    };

    loadData();
  }, [userKey]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    setMessages(prev => [...prev, { text, sender: 'me', time: 'עכשיו' }]);
    
    setIsTyping(true);
    // שמירה ל-Firestore
    await saveMessage(userKey || 'harel', 'user', text);
    
    // קבלת תשובה מנועה (Gemini 3)
    const response = await askNoaPersonalized(text, userKey || 'harel', messages);
    
    await saveMessage(userKey || 'harel', 'model', response.text);
    setMessages(prev => [...prev, { text: response.text, sender: 'noa', time: 'עכשיו' }]);
    setIsTyping(false);
  };

  return (
    <div className="h-screen flex flex-col bg-[#e5ddd5] font-sans overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="px-4 py-3 text-white shadow-md z-20 flex flex-col gap-3" style={{ backgroundColor: currentProfile.color }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="p-1 hover:bg-black/10 rounded-full"><ChevronRight /></button>
            <img src={currentProfile.avatar} className="w-10 h-10 rounded-full border border-white/20" alt="" />
            <div className="flex flex-col">
              <span className="font-bold text-sm">{currentProfile.name}</span>
              <span className="text-[10px] opacity-80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                מחובר לנועה AI
              </span>
            </div>
          </div>
        </div>

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

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative bg-[url('https://i.postimg.cc/mD83SmsG/wa-bg.png')] bg-repeat">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' ? (
            <motion.div 
              key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 space-y-3 pb-24"
            >
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'me' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-2 rounded-xl shadow-sm relative ${msg.sender === 'me' ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                    <p className="text-sm text-gray-800 leading-relaxed">{msg.text}</p>
                    <span className="text-[9px] text-gray-500 block text-left mt-1">{msg.time}</span>
                  </div>
                </div>
              ))}
              {isTyping && <div className="bg-white/80 p-2 rounded-lg w-fit text-[10px] text-gray-500 italic">נועה מעבדת נתונים...</div>}
            </motion.div>
          ) : (
            <motion.div 
              key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              <h2 className="text-md font-black text-gray-800 border-r-4 border-emerald-600 pr-3">לוח הזמנות פעיל</h2>
              {isLoadingOrders ? (
                <div className="text-center py-10 text-gray-500 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  סורקת בסיס נתונים...
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-white/60 p-8 rounded-2xl text-center text-gray-500 italic border border-dashed border-gray-300">
                  לא נמצאו הזמנות ליום זה ב-SabanOS.
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm border-r-4 border-emerald-500">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-gray-900">{order.customerName}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">{order.status || 'בתהליך'}</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-600"><MapPin size={12} className="text-gray-400"/> {order.destination}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-600"><Clock size={12} className="text-gray-400"/> {order.time || 'לא נקבע'}</div>
                      <div className="mt-2 bg-gray-50 p-2 rounded border border-gray-100 flex items-start gap-2">
                        <Package size={14} className="text-emerald-600 mt-0.5"/>
                        <span className="text-[11px] text-gray-700 font-medium">{order.items}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      {activeTab === 'chat' && (
        <footer className="p-2 bg-[#f0f2f5] flex items-center gap-2">
          <div className="flex-1 bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-inner">
            <input 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="כתוב הודעה..." 
              className="flex-1 bg-transparent border-none outline-none text-sm" 
            />
          </div>
          <button onClick={handleSendMessage} className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform" style={{ backgroundColor: currentProfile.color }}>
            <Send size={18} />
          </button>
        </footer>
      )}
    </div>
  );
};
