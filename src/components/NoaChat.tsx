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
    label: `צפי ל${o.customerName.split(' ')[0]} ⏱️`,
    action: `חשבי ETA חכם ל${o.customerName} בהתבסס על היסטוריית פריקות בכתובת ${o.destination}`,
    icon: <Activity size={14} />
  }))
];

  return (
    <div className={`h-full md:h-screen ${isPopup ? 'bg-white' : 'bg-[#F8FAFC]'} flex flex-col md:flex-row overflow-hidden relative`} dir="rtl">
      {/* Mobile Height Overlay Fix */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --chat-height: 100vh; }
        @supports (height: 100svh) { :root { --chat-height: 100svh; } }
      `}} />
      {/* Left Sidebar for Desktop (Quick Info) */}
      {!isPopup && (
        <div className="hidden md:flex w-64 bg-white border-l border-[#E2E8F0] flex-col p-6 overflow-y-auto shrink-0 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100">
              <ChevronRight size={18} />
            </button>
            <div className="flex items-center gap-3">
              <img 
                src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                alt="Noa" 
                className="w-8 h-8 rounded-xl object-cover shadow-sm"
              />
              <h1 className="text-lg font-black text-slate-900 tracking-tight">SabanOS</h1>
            </div>
          </div>
          
            <div className="space-y-5">
              <div>
                <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest text-right">דיאגנוסטיקה מערכתית</p>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse shadow-sm"></div>
                  <span className="text-[10px] font-black text-slate-700">נועה | מחוברת ✅</span>
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest text-right">הגדרות קוליות</p>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600">הקראה אוטומטית</span>
                    <button 
                      onClick={() => setIsAutoVoice(!isAutoVoice)}
                      className={`relative w-8 h-4 rounded-full transition-colors ${isAutoVoice ? 'bg-slate-900' : 'bg-slate-200'}`}
                    >
                      <motion.div 
                        animate={{ x: isAutoVoice ? 16 : 2 }}
                        className="absolute top-0.5 left-0 w-3 h-3 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                  <p className="text-[8px] text-slate-400 leading-tight">נועה תקריא פקודות חדשות באופן אוטומטי.</p>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col h-full bg-white relative overflow-hidden`}>
        {/* Professional Styled Header */}
        {!isPopup && (
          <header className="px-5 py-4 bg-white border-b border-[#E2E8F0] shadow-sm text-slate-900 flex items-center justify-between z-30 shrink-0">
            <div className="flex items-center gap-4">
               <button onClick={onBack} className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-2xl text-slate-500 active:scale-95 transition-transform md:hidden">
                 <ChevronRight size={22} />
               </button>
               <div className="flex flex-col">
                 <h1 className="font-black text-lg md:text-sm uppercase tracking-tight leading-tight">גשר לוגיסטי • ח. סבן</h1>
                 <div className="flex items-center gap-1.5 pt-0.5">
                   <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse shadow-sm" />
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">נועה Operations Node</span>
                 </div>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <img 
                 src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                 alt="Noa" 
                 className="w-11 h-11 rounded-xl object-cover border-2 border-slate-50 shadow-md"
               />
               <div className="hidden sm:flex gap-2">
                  {onClearHistory && (
                    <button 
                      onClick={onClearHistory}
                      className="w-10 h-10 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 border border-transparent hover:border-red-100 transition-all flex items-center justify-center"
                      title="ניקוי היסטוריה"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-400 border border-transparent hover:border-slate-100 flex items-center justify-center"><Settings size={20} /></button>
               </div>
            </div>
          </header>
        )}

      {/* Message List - Occupies flexible space (aiming for 85% roughly in hub) */}
      <div 
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto px-5 md:px-12 py-8 md:py-10 space-y-10 w-full scroll-smooth custom-scrollbar bg-[#FDFDFD]"
        style={{ height: isPopup ? 'auto' : 'calc(var(--chat-height) - 200px)' }}
        onClick={(e) => {
            const target = e.target as HTMLElement;
            const suggestionBtn = target.closest('[data-suggestion]');
            if (suggestionBtn) {
              const action = suggestionBtn.getAttribute('data-suggestion');
              if (action) onAction(action);
            }
          }}
        >
          {chatHistory.length === 0 && (
            <div className="text-center py-20 px-4">
              <div className="w-28 h-28 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl border-4 border-white bg-white p-1 overflow-hidden">
                 <img 
                   src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                   alt="Noa" 
                   className="w-full h-full object-cover rounded-[2rem]"
                   referrerPolicy="no-referrer"
                 />
              </div>
              <h2 className="text-3xl font-black mb-3 italic text-navy tracking-tight">ראמי אהובי, שלום ❤️</h2>
              <p className="text-xs font-black text-slate-400 mb-12 max-w-[300px] mx-auto italic uppercase tracking-widest leading-relaxed">
                 מערכת בינה מלאכותית לניהול לוגיסטי <br/>
                 <span className="text-gold">SabanOS Precision Engine</span>
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                 {dynamicSuggestions.slice(0, 6).map(suggestion => (
                   <button 
                     key={suggestion.label}
                     onClick={(e) => {
                       e.stopPropagation();
                       onAction(suggestion.action);
                     }}
                     className="p-6 bg-white rounded-3xl border border-slate-100 text-sm font-black text-slate-700 hover:border-gold hover:shadow-xl hover:shadow-gold/5 transition-all text-right shadow-sm flex items-center justify-between group active:scale-95"
                   >
                     <span className="flex-1 ml-4">{suggestion.label}</span>
                     <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-navy group-hover:text-white transition-all shrink-0">
                       <ChevronRight size={18} />
                     </div>
                   </button>
                 ))}
              </div>
            </div>
          )}
          
          {chatHistory.map((chat, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex w-full gap-5 ${chat.role === 'user' ? 'justify-start' : 'justify-end flex-row-reverse'}`}
            >
              {chat.role !== 'user' && (
                <div className="shrink-0 mt-1">
                  <img 
                    src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                    alt="Noa" 
                    className="w-10 h-10 rounded-2xl object-cover shadow-md border-2 border-white"
                  />
                </div>
              )}
              <div className={`w-full max-w-[95%] md:max-w-[90%] p-8 md:p-10 rounded-[2.5rem] text-lg md:text-xl font-bold leading-relaxed shadow-md transition-all border-2 ${
                chat.role === 'user' 
                  ? 'bg-slate-50 text-navy border-slate-200 rounded-tr-none' 
                  : 'bg-white text-slate-900 rounded-tl-none border-navy/10 shadow-navy/5'
              }`}>
                {(chat.parts[0]?.text || "").includes('<table') || (chat.parts[0]?.text || "").includes('<div') ? (
                  <div 
                    className={`prose prose-lg max-w-none text-right ${chat.role === 'user' ? 'prose-slate' : 'prose-navy'}`}
                    dangerouslySetInnerHTML={{ __html: chat.parts[0]?.text || "" }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-right text-lg md:text-xl leading-relaxed break-words overflow-hidden">
                    {chat.parts[0]?.text || ""}
                    {(() => {
                      const textToScan = chat.parts[0]?.text || "";
                      const orderIdRegex = /#?(\d{4,8})/g;
                      const matches = [...textToScan.matchAll(orderIdRegex)];
                      const orderIds = [...new Set(matches.map(m => m[1]))];
                      
                      return orderIds.length > 0 && (
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className={`flex items-center gap-3 mt-6 pt-6 border-t border-slate-50`}>
                    <button 
                      onClick={() => speak(chat.parts[0].text, idx)}
                      className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all ${currentlySpeaking === idx ? 'bg-navy text-white' : 'hover:bg-slate-50 text-slate-400 bg-slate-50/50'}`}
                    >
                      {currentlySpeaking === idx ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    
                    {currentlySpeaking === idx && (
                      <div className="flex items-center gap-1.5 h-4 px-2">
                        {[1, 2.5, 4, 3.5, 4.5, 2, 3].map((h, i) => (
                          <motion.div 
                            key={i}
                            animate={{ height: [4, h * 4, 4] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                            className="w-1 bg-navy/20 rounded-full"
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

        {/* Input Area - Full Mobile Breadth */}
        <div className={`bg-white border-t border-slate-100 pt-5 ${isPopup ? 'pb-6' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-6'} px-5 md:px-8 z-30 shrink-0 shadow-[0_-15px_40px_rgba(30,58,138,0.04)]`}>
          <div className="max-w-4xl mx-auto space-y-5">
            {/* Quick Actions Scrollable - High Interaction */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 mask-linear-r">
              {dynamicSuggestions.map((btn, i) => (
                <button 
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(btn.action);
                  }}
                  className={`whitespace-nowrap bg-white hover:bg-navy hover:text-white text-slate-500 text-[11px] font-black uppercase px-6 py-3 rounded-2xl transition-all border border-slate-100 shadow-sm active:scale-95 flex items-center gap-2.5`}
                >
                  {btn.icon || <Waves size={14} />}
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
              className="flex gap-4 items-center"
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
                className={`w-14 h-14 rounded-2xl transition-all shadow-sm active:scale-90 flex items-center justify-center shrink-0 border-2 ${
                  isUploading ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-white text-slate-400 border-slate-50 hover:text-navy hover:border-navy hover:shadow-lg'
                }`}
                title="צירוף מסמך (הזמנה / תעודת משלוח)"
              >
                <Paperclip size={24} className={isUploading ? 'animate-pulse' : ''} />
              </button>
              <input 
                name="message"
                autoComplete="off"
                placeholder="הקלד פקודה לוגיסטית לאישור..."
                className={`flex-1 bg-white border-2 border-slate-200 text-slate-900 rounded-[1.5rem] px-8 h-14 text-xl focus:border-navy transition-all outline-none font-bold placeholder:text-slate-300 shadow-sm`}
              />
              <button 
                type="submit"
                className={`bg-navy text-white h-14 w-14 rounded-2xl hover:bg-gold hover:text-navy transition-all shadow-xl active:scale-95 flex items-center justify-center shrink-0 border-2 border-navy`}
              >
                <Send size={28} strokeWidth={3} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
