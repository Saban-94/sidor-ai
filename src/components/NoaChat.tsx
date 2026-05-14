import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  ChevronRight,
  Volume2,
  VolumeX,
  Speaker,
  Settings,
  Waves,
  Paperclip,
  Trash2,
  Database,
  TrendingUp,
  Activity,
  Cpu,
  Globe,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { Order } from '../types';
import { parseItems } from '../lib/utils';
import { MiniOrderCard } from './MiniOrderCard';

interface NoaChatProps {
  chatHistory: any[];
  chatScrollRef?: React.RefObject<HTMLDivElement>;
  onBack: () => void;
  onAction: (action: string, file?: File | string) => void;
  orders: Order[];
  onOrderView?: (order: Order) => void;
  onClearHistory?: () => void;
  isPopup?: boolean;
  currentContext?: string;
}

export const NoaChat = ({ 
  chatHistory, 
  chatScrollRef: externalRef, 
  onBack, 
  onAction,
  orders,
  onOrderView,
  onClearHistory,
  isPopup = false,
  currentContext = 'general'
}: NoaChatProps) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = externalRef || internalRef;
  const [isAutoVoice, setIsAutoVoice] = useState(() => localStorage.getItem('noa_auto_voice') === 'true');
  const [isUploading, setIsUploading] = useState(false);
  const [currentlySpeaking, setCurrentlySpeaking] = useState<number | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

  // Persistence of auto voice setting
  useEffect(() => {
    localStorage.setItem('noa_auto_voice', String(isAutoVoice));
  }, [isAutoVoice]);

  const cleanTextForSpeech = (text: string) => {
    // 1. Detect if it's an item list
    const items = parseItems(text);
    if (items.length > 0) {
      let speech = "הנה הפריטים שנמצאו: ";
      items.forEach((item, index) => {
        speech += `פריט ${index + 1}: ${item.name}, כמות: ${item.quantity}. `;
      });
      return speech;
    }

    // 2. Regular cleaning
    return text
      .replace(/[*_#]/g, '') // remove markdown
      .replace(/[^\u0590-\u05FF0-9\s,.?!]/g, ' ') // keep hebrew, numbers, basic punctuation
      .trim();
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setCurrentlySpeaking(null);
    }
  };

  const speak = (text: string, index: number) => {
    if (!synthRef.current) return;

    // If already speaking this message, stop
    if (currentlySpeaking === index) {
      stopSpeaking();
      return;
    }

    // Stop anything else
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
    const voices = synthRef.current.getVoices();
    const hebrewVoice = voices.find(v => v.lang.includes('he')) || voices[0];
    
    utterance.voice = hebrewVoice;
    utterance.lang = 'he-IL';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setCurrentlySpeaking(index);
    utterance.onend = () => setCurrentlySpeaking(null);
    utterance.onerror = () => setCurrentlySpeaking(null);

    synthRef.current.speak(utterance);
  };

  // Auto-voice effect
  useEffect(() => {
    if (isAutoVoice && chatHistory.length > 0) {
      const lastMessage = chatHistory[chatHistory.length - 1];
      if (lastMessage.role === 'model' || lastMessage.role === 'assistant') {
        speak(lastMessage.parts[0].text, chatHistory.length - 1);
      }
    }
  }, [chatHistory.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatHistory]);

  const contextSuggestions: Record<string, {label: string, action: string, icon?: React.ReactNode}[]> = {
    table: [
      { label: 'בדיקת חוסרים 📦', action: 'הצלבי מלאי קיים מול הזמנות פתוחות ודוחי לי חוסרים בברזל או בטון', icon: <Database size={14} /> },
      { label: 'תחזית הזמנות 📈', action: 'על בסיס המלאי הנוכחי, אילו מוצרים כדאי להזמין השבוע?', icon: <TrendingUp size={14} /> }
    ],
    kanban: [
      { label: 'סטטוס הפצה 🚚', action: 'תני לי תמונת מצב של כל המשאיות כרגע על המפה', icon: <Activity size={14} /> },
      { label: 'חריגות זמן ⏱️', action: 'האם יש הזמנות שמתעכבות מעבר לממוצע בפריקה?', icon: <Waves size={14} /> }
    ],
    reports: [
      { label: 'סיכום רווחיות 💰', action: 'נתחי את דוח הבוקר האחרון מבחינת חיסכון בדלק ומסלולים', icon: <Cpu size={14} /> },
      { label: 'ביצועי נהגים 👨‍✈️', action: 'השווי בין זמני הפריקה של עלי וחכמת בשבוע האחרון', icon: <Settings size={14} /> }
    ],
    general: [
      { label: 'סנכרון חכם 📂', action: 'סרוק את SabanOS, חלץ נתונים והצלבת כתובות מול מאגר המיקומים החכמים', icon: <Globe size={14} /> },
      { label: 'אופטימיזציה למחר 🏗️', action: 'תכנני מסלול אופטימלי לחכמת ועלי למחר על בסיס נתוני עבר', icon: <Zap size={14} /> }
    ]
  };

  const dynamicSuggestions: {label: string, action: string, icon?: React.ReactNode}[] = [
    ...(contextSuggestions[currentContext] || contextSuggestions.general),
    { 
      label: 'דוח בוקר HTML 📋', 
      action: 'תכיני דוח בוקר מעוצב בטבלה כולל צפי הגעה לכל נהג',
      icon: <Database size={14} />
    },
    { 
      label: 'אימות פריקה (PTO) ✅', 
      action: 'בדקי חריגות בין מיקומי GPS להפעלת מנוף בסידור האחרון',
      icon: <ShieldCheck size={14} />
    },
    // קישורים דינמיים לפי הזמנות בביצוע עם חיזוי חכם
    ...orders.filter(o => o.status === 'preparing').slice(0, 3).map(o => ({
      label: `ETA ל${o.customerName} ⏱️`,
      action: `חשבי ETA חכם ל${o.customerName} בהתבסס על היסטוריית פריקות בכתובת ${o.destination}`,
      icon: <Activity size={14} />
    }))
  ];

  return (
    <div className={`h-full w-full ${isPopup ? 'bg-white' : 'bg-[#FDFDFD]'} flex flex-col overflow-hidden relative`} dir="rtl">
      {/* Dynamic Viewport Fix */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --chat-height: 100vh; }
        @supports (height: 100svh) { :root { --chat-height: 100svh; } }
      `}} />
      
      {/* Unified Professional Header */}
      <header className="px-6 py-5 bg-white border-b-2 border-slate-100 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-5">
           <button onClick={onBack} className="w-14 h-14 flex items-center justify-center bg-navy text-white rounded-2xl active:scale-95 transition-all shadow-lg border-2 border-navy">
             <ChevronRight size={28} />
           </button>
           <div className="flex flex-col">
             <h1 className="font-black text-xl uppercase tracking-tight leading-none mb-1">גשר לוגיסטי • ח. סבן</h1>
             <div className="flex items-center gap-2">
               <div className="w-2.5 h-2.5 bg-[#22c55e] rounded-full animate-pulse shadow-sm shadow-emerald-400" />
               <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">נועה Operations Intelligence</span>
             </div>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <img 
             src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
             alt="Noa" 
             className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-50 shadow-xl"
           />
        </div>
      </header>

      {/* Message List - Massive Text Scaling & Leading */}
      <div 
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto px-6 py-10 space-y-12 w-full scroll-smooth custom-scrollbar bg-white"
        style={{ height: 'calc(var(--chat-height) - 180px)' }}
      >
        {chatHistory.length === 0 && (
          <div className="text-center py-20 px-6">
            <div className="w-32 h-32 rounded-[3rem] flex items-center justify-center mx-auto mb-10 shadow-3xl border-4 border-slate-50 bg-white p-1 overflow-hidden">
               <img 
                 src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                 alt="Noa" 
                 className="w-full h-full object-cover rounded-[2.5rem]"
                 referrerPolicy="no-referrer"
               />
            </div>
            <h2 className="text-4xl font-black mb-4 italic text-navy tracking-tight">ראמי אהובי, שלום ❤️</h2>
            <p className="text-xl font-bold text-slate-400 mb-12 max-w-sm mx-auto italic leading-relaxed">
               מערכת בינה מלאכותית לניהול לוגיסטי חכם <br/>
               <span className="text-gold font-black">SabanOS 7.0 Precision</span>
            </p>
            
            <div className="flex flex-col gap-5 max-w-2xl mx-auto">
               {dynamicSuggestions.slice(0, 4).map(suggestion => (
                 <button 
                   key={suggestion.label}
                   onClick={() => onAction(suggestion.action)}
                   className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 text-xl font-black text-navy hover:border-navy hover:bg-white transition-all text-right shadow-sm flex items-center justify-between group active:scale-95"
                 >
                   <span className="flex-1 ml-6">{suggestion.label}</span>
                   <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center group-hover:bg-navy group-hover:text-white group-hover:border-navy transition-all shrink-0 shadow-sm">
                     <ChevronRight size={24} />
                   </div>
                 </button>
               ))}
            </div>
          </div>
        )}
        
        {chatHistory.map((chat, idx) => (
          <motion.div 
            key={idx} 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex w-full gap-6 ${chat.role === 'user' ? 'justify-start' : 'justify-end flex-row-reverse'}`}
          >
            {chat.role !== 'user' && (
              <div className="shrink-0 mt-2">
                <img 
                  src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                  alt="Noa" 
                  className="w-12 h-12 rounded-2xl object-cover shadow-xl border-2 border-white"
                />
              </div>
            )}
            <div className={`w-full max-w-[95%] p-10 rounded-[3rem] text-xl md:text-2xl font-bold leading-relaxed shadow-xl transition-all border-2 ${
              chat.role === 'user' 
                ? 'bg-slate-50 text-navy border-slate-200 rounded-tr-none' 
                : 'bg-white text-slate-900 rounded-tl-none border-navy/10 shadow-navy/5'
            }`}>
              {(chat.parts[0]?.text || "").includes('<table') || (chat.parts[0]?.text || "").includes('<div') ? (
                <div 
                  className={`prose prose-xl max-w-none text-right ${chat.role === 'user' ? 'prose-slate' : 'prose-navy'}`}
                  dangerouslySetInnerHTML={{ __html: chat.parts[0]?.text || "" }}
                />
              ) : (
                <div className="whitespace-pre-wrap text-right break-words overflow-hidden">
                  {chat.parts[0]?.text || ""}
                  {(() => {
                    const textToScan = chat.parts[0]?.text || "";
                    const orderIdRegex = /#?(\d{4,8})/g;
                    const matches = [...textToScan.matchAll(orderIdRegex)];
                    const orderIds = [...new Set(matches.map(m => m[1]))];
                    
                    return orderIds.length > 0 && (
                      <div className="mt-10 grid grid-cols-1 gap-6">
                        {orderIds.map(id => (
                          <MiniOrderCard 
                            key={id} 
                            orderId={id} 
                            onOrderView={onOrderView}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {chat.role !== 'user' && (
                <div className={`flex items-center gap-5 mt-10 pt-10 border-t-2 border-slate-50`}>
                  <button 
                    onClick={() => speak(chat.parts[0].text, idx)}
                    className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all shadow-sm ${currentlySpeaking === idx ? 'bg-navy text-white' : 'bg-slate-50 text-slate-400 hover:text-navy hover:bg-white border-2 border-transparent hover:border-navy'}`}
                  >
                    {currentlySpeaking === idx ? <VolumeX size={24} /> : <Volume2 size={24} />}
                  </button>
                  
                  {currentlySpeaking === idx && (
                    <div className="flex items-center gap-2 h-6 px-4">
                      {[1, 2.5, 4, 3.5, 4.5, 2, 3].map((h, i) => (
                        <motion.div 
                          key={i}
                          animate={{ height: [6, h * 6, 6] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                          className="w-1.5 bg-navy/30 rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Massive Input Area - Mobile Focused */}
      <div className="bg-white border-t-2 border-slate-100 px-6 py-8 z-30 shrink-0 shadow-[0_-20px_50px_rgba(30,58,138,0.06)]">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Quick Actions - Large Horizontal Scroll */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
            {dynamicSuggestions.map((btn, i) => (
              <button 
                key={i}
                onClick={() => onAction(btn.action)}
                className={`whitespace-nowrap bg-white hover:bg-navy hover:text-white text-navy text-sm font-black uppercase px-8 py-4 rounded-[1.5rem] transition-all border-2 border-slate-100 shadow-sm active:scale-95 flex items-center gap-3 shrink-0`}
              >
                {btn.icon ? React.cloneElement(btn.icon as React.ReactElement, { size: 18 }) : <Waves size={18} />}
                {btn.label}
              </button>
            ))}
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const input = form.elements.namedItem('message') as HTMLInputElement;
              const val = input.value;
              if (!val) return;
              onAction(val);
              input.value = '';
            }}
            className="flex gap-5 items-center"
          >
            <input 
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setIsUploading(true);
                  try {
                    onAction(`מנתחת מסמך: ${file.name}...`, file);
                  } finally {
                    setIsUploading(false);
                  }
                }
              }}
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`w-16 h-16 rounded-3xl transition-all shadow-md active:scale-90 flex items-center justify-center shrink-0 border-2 ${
                isUploading ? 'bg-slate-50 text-slate-200 border-slate-100' : 'bg-white text-navy border-slate-100 hover:border-navy hover:shadow-xl'
              }`}
            >
              <Paperclip size={28} className={isUploading ? 'animate-pulse' : ''} />
            </button>
            <input 
              name="message"
              autoComplete="off"
              placeholder="הקלד פקודה לוגיסטית..."
              className={`flex-1 bg-slate-50 border-2 border-slate-100 text-navy rounded-3xl px-10 h-16 text-xl md:text-2xl focus:border-navy focus:bg-white transition-all outline-none font-bold placeholder:text-slate-300 shadow-inner`}
            />
            <button 
              type="submit"
              className={`bg-navy text-white h-16 w-16 rounded-3xl hover:bg-gold hover:text-navy transition-all shadow-2xl active:scale-95 flex items-center justify-center shrink-0 border-2 border-navy`}
            >
              <Send size={32} strokeWidth={4} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
