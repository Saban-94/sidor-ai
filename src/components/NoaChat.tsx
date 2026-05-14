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
  Paperclip
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

const contextSuggestions: Record<string, {label: string, action: string}[]> = {
  table: [
    { label: 'בדיקת חוסרים 📦', action: 'הצלבי מלאי קיים מול הזמנות פתוחות ודוחי לי חוסרים בברזל או בטון' },
    { label: 'תחזית הזמנות 📈', action: 'על בסיס המלאי הנוכחי, אילו מוצרים כדאי להזמין השבוע?' }
  ],
  kanban: [
    { label: 'סטטוס הפצה 🚚', action: 'תני לי תמונת מצב של כל המשאיות כרגע על המפה' },
    { label: 'חריגות זמן ⏱️', action: 'האם יש הזמנות שמתעכבות מעבר לממוצע בפריקה?' }
  ],
  reports: [
    { label: 'סיכום רווחיות 💰', action: 'נתחי את דוח הבוקר האחרון מבחינת חיסכון בדלק ומסלולים' },
    { label: 'ביצועי נהגים 👨‍✈️', action: 'השווי בין זמני הפריקה של עלי וחכמת בשבוע האחרון' }
  ],
  general: [
    { label: 'סנכרון חכם 📂', action: 'סרוק את SabanOS, חלץ נתונים והצלבת כתובות מול מאגר המיקומים החכמים' },
    { label: 'אופטימיזציה למחר 🏗️', action: 'תכנני מסלול אופטימלי לחכמת ועלי למחר על בסיס נתוני עבר' }
  ]
};

const dynamicSuggestions = [
  ...(contextSuggestions[currentContext] || contextSuggestions.general),
  { 
    label: 'דוח בוקר HTML 📋', 
    action: 'תכיני דוח בוקר מעוצב בטבלה כולל צפי הגעה לכל נהג' 
  },
  { 
    label: 'אימות פריקה (PTO) ✅', 
    action: 'בדקי חריגות בין מיקומי GPS להפעלת מנוף בסידור האחרון' 
  },
  // קישורים דינמיים לפי הזמנות בביצוע עם חיזוי חכם
  ...orders.filter(o => o.status === 'preparing').slice(0, 3).map(o => ({
    label: `צפי ל${o.customerName.split(' ')[0]} ⏱️`,
    action: `חשבי ETA חכם ל${o.customerName} בהתבסס על היסטוריית פריקות בכתובת ${o.destination}`
  }))
];

  return (
    <div className={`h-full ${isPopup ? 'bg-white' : 'bg-[#F8FAFC]'} flex flex-col md:flex-row overflow-hidden`} dir="rtl">
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
                <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest text-right">System Diagnostics</p>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse shadow-sm"></div>
                  <span className="text-[10px] font-black text-slate-700">נועה | מחוברת ✅</span>
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest text-right">Voice Settings</p>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600">Auto-Voice Voice</span>
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
          <header className="p-4 bg-white border-b border-[#E2E8F0] shadow-sm text-slate-900 flex items-center justify-between z-30 shrink-0">
            <div className="flex items-center gap-3">
               <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100 md:hidden">
                 <ChevronRight size={18} />
               </button>
               <div className="flex flex-col">
                 <h1 className="font-black text-sm uppercase tracking-tight">Enterprise Logistics Bridge</h1>
                 <div className="flex items-center gap-1.5 pt-0.5">
                   <div className="w-2 h-2 bg-[#22c55e] rounded-full" />
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Noa Operations Node • Connected</span>
                 </div>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <img 
                 src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                 alt="Noa" 
                 className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm"
               />
               <div className="hidden sm:flex gap-1.5">
                  <button className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 border border-transparent hover:border-slate-100"><Settings size={18} /></button>
               </div>
            </div>
          </header>
        )}

        {/* Message List */}
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 w-full scroll-smooth custom-scrollbar"
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
            <div className="text-center py-16 px-4">
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-200 bg-white p-2">
                 <img 
                   src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                   alt="Noa" 
                   className="w-full h-full object-cover rounded-2xl"
                   referrerPolicy="no-referrer"
                 />
              </div>
              <h2 className="text-2xl font-black mb-2 italic text-slate-900 tracking-tight">ראמי אהובי, שלום ❤️</h2>
              <p className="text-xs font-bold text-slate-400 mb-10 max-w-[280px] mx-auto italic uppercase tracking-widest">מערכת סידור חכמה • BRIDGE v2.0</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
                 {dynamicSuggestions.slice(0, 6).map(suggestion => (
                   <button 
                     key={suggestion.label}
                     onClick={(e) => {
                       e.stopPropagation();
                       onAction(suggestion.action);
                     }}
                     className="p-5 bg-white rounded-2xl border border-slate-200 text-[10px] font-black text-slate-700 hover:border-slate-400 transition-all text-right shadow-sm flex items-center justify-between group"
                   >
                     <span>{suggestion.label}</span>
                     <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                       <ChevronRight size={14} />
                     </div>
                   </button>
                 ))}
              </div>
            </div>
          )}
          
          {chatHistory.map((chat, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex w-full gap-4 ${chat.role === 'user' ? 'justify-start' : 'justify-end flex-row-reverse'}`}
            >
              {chat.role !== 'user' && (
                <div className="shrink-0 mt-1">
                  <img 
                    src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                    alt="Noa" 
                    className="w-9 h-9 rounded-xl object-cover shadow-sm border border-slate-200"
                  />
                </div>
              )}
              <div className={`w-full max-w-full p-6 md:p-8 rounded-2xl text-[13px] md:text-sm font-bold leading-relaxed shadow-sm transition-all border ${
                chat.role === 'user' 
                  ? 'bg-slate-100 text-slate-800 border-slate-200 rounded-tr-none' 
                  : 'bg-white text-slate-900 rounded-tl-none border-slate-200'
              }`}>
                {(chat.parts[0]?.text || "").includes('<table') || (chat.parts[0]?.text || "").includes('<div') ? (
                  <div 
                    className={`prose prose-sm max-w-none text-right ${chat.role === 'user' ? 'prose-slate' : 'prose-invert'}`}
                    dangerouslySetInnerHTML={{ __html: chat.parts[0]?.text || "" }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap">
                    {chat.parts[0]?.text || ""}
                    {/* detection logic remains */}
                    {(() => {
                      const textToScan = chat.parts[0]?.text || "";
                      const orderIdRegex = /#?(\d{4,8})/g;
                      const matches = [...textToScan.matchAll(orderIdRegex)];
                      const orderIds = [...new Set(matches.map(m => m[1]))];
                      
                      return orderIds.length > 0 && (
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <div className={`flex items-center gap-2 mt-4 pt-4 border-t border-slate-100`}>
                    <button 
                      onClick={() => speak(chat.parts[0].text, idx)}
                      className={`p-2 rounded-lg transition-all ${currentlySpeaking === idx ? 'bg-navy text-white' : 'hover:bg-slate-50 text-slate-400'}`}
                    >
                      {currentlySpeaking === idx ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    
                    {currentlySpeaking === idx && (
                      <div className="flex items-center gap-0.5 h-3">
                        {[1, 2, 3, 4, 3, 2, 1].map((h, i) => (
                          <motion.div 
                            key={i}
                            animate={{ height: [3, h * 3, 3] }}
                            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                            className="w-0.5 bg-navy/20 rounded-full"
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

        {/* Input Area */}
        <div className={`bg-white border-t border-slate-200 pt-3 ${isPopup ? 'pb-3' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4'} px-4 md:px-6 z-20 shrink-0`}>
          <div className="max-w-4xl mx-auto space-y-3">
            {/* Quick Actions Scrollable */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {dynamicSuggestions.map((btn, i) => (
                <button 
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(btn.action);
                  }}
                  className={`whitespace-nowrap bg-slate-50 hover:bg-navy hover:text-white text-slate-500 text-[9px] font-black uppercase px-3.5 py-2 rounded-xl transition-all border border-slate-100 shadow-sm active:scale-95 flex items-center gap-2`}
                >
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
              className="flex gap-2 items-center"
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
                className={`p-3 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center shrink-0 border ${
                  isUploading ? 'bg-slate-50 text-slate-300' : 'bg-white text-slate-400 border-slate-200 hover:text-navy hover:border-navy'
                }`}
                title="צירוף מסמך (הזמנה / תעודת משלוח)"
              >
                <Paperclip size={18} className={isUploading ? 'animate-pulse' : ''} />
              </button>
              <input 
                name="message"
                autoComplete="off"
                placeholder="הקלד פקודה לוגיסטית..."
                className={`flex-1 bg-slate-50 border border-slate-200 text-slate-900 border rounded-xl px-5 py-3 text-sm md:text-base focus:border-gold/50 transition-all outline-none font-bold`}
              />
              <button 
                type="submit"
                className={`bg-navy text-white p-3 rounded-xl hover:bg-gold hover:text-navy transition-all shadow-sm active:scale-95 flex items-center justify-center shrink-0`}
              >
                <Send size={18} strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
