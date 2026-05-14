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
      {/* Dynamic Viewport & Scaling Fix */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --chat-height: 100vh; }
        @supports (height: 100svh) { :root { --chat-height: 100svh; } }
        
        /* SabanOS Precision HTML Scaling */
        .noa-html-content table { 
          width: 879.858px !important; 
          min-width: 879.858px !important;
          border-collapse: collapse !important;
          border: 1px solid #e2e8f0 !important;
        }
        .noa-html-content h2 { 
          font-size: 20px !important; 
          width: 642.045px !important; 
          font-weight: 900 !important;
          margin-bottom: 2rem !important;
          color: #1e293b !important;
        }

        /* Specific Audit Selectors */
        .noa-bubble-52 {
          width: 1299.858px !important;
          max-width: 1299.858px !important;
        }
        .noa-inner-52 {
          width: 770.227px !important;
        }
        .noa-title-52 {
           font-size: 40.25px !important;
           width: 692.614px !important;
           font-weight: 900 !important;
        }
        .noa-span-52 {
           font-size: 30px !important;
        }
        .noa-p-52 {
          font-size: 22px !important;
          line-height: 1.6 !important;
        }
        .noa-chat-list-audit {
          width: 1211.45px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .noa-bubble-50 {
          height: 122.543px !important;
          width: 1021.45px !important;
          font-size: 30.75px !important;
        }
        .noa-input-area-audit {
          height: 286.866px !important;
          width: 1204.47px !important;
          padding-left: 25px !important;
          padding-right: 0px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .noa-quick-actions-audit {
          height: 90.5994px !important;
          width: 1203.47px !important;
        }
        .noa-quick-btn-audit {
          height: 35.9943px !important;
          font-size: 14px !important;
          padding: 0 !important;
        }
        .noa-quick-btn-audit:nth-child(1) { width: 107.869px !important; }
        .noa-quick-btn-audit:nth-child(2) { width: 132.088px !important; }
        .noa-quick-btn-audit:nth-child(3) { font-size: 10px !important; }
        .noa-quick-btn-audit:nth-child(3) span { font-size: 15.25px !important; }
        .noa-quick-btn-audit:nth-child(4) { height: 35.9943px !important; }
        .noa-quick-btn-audit:nth-child(4) span { font-size: 15.25px !important; }
        .noa-quick-btn-audit:nth-child(5) { width: 97.855px !important; }
        .noa-quick-btn-audit:nth-child(5) span { width: 101.122px !important; font-size: 15.25px !important; }
        
        .noa-form-audit {
          width: 1203.47px !important;
        }
        .noa-paperclip-audit {
          width: 22.9972px !important;
          height: 22.9972px !important;
        }
        .noa-send-audit {
          width: 20.9972px !important;
          height: 20.9972px !important;
        }
        .noa-input-audit {
          font-size: 20px !important;
          line-height: 20px !important;
        }
        .noa-html-content p {
          font-size: 22px !important;
        }
        .noa-report-active span {
          font-size: 30px !important;
        }
        .noa-report-active div:first-child {
           font-size: 40.25px !important;
           width: 692.614px !important;
        }
        .noa-html-content th { 
          font-size: 20px !important; 
          padding: 1rem !important;
          text-align: right !important;
          background: #f8fafc !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
        .noa-html-content th:nth-child(1) { color: #12174e !important; }
        .noa-html-content th:nth-child(2) { color: #141256 !important; }
        .noa-html-content th:nth-child(3) { color: #292165 !important; }

        .noa-html-content td { 
          font-size: 15px !important; 
          padding: 1rem !important;
          border-bottom: 1px solid #f1f5f9 !important;
          color: #1e293b !important;
        }
        /* Audit Colors for rows */
        .noa-html-content tr:nth-child(3) td:nth-child(3) { color: #68707d !important; }
        .noa-html-content tr:nth-child(4) td:nth-child(3) { color: #5e6269 !important; }

        .noa-html-content {
          height: auto !important;
          min-height: 400px;
          margin-bottom: 2rem;
        }
        /* Specific height override from audit if requested via selector context */
        .noa-report-active {
          height: 5697.34px !important;
          width: 879.858px !important;
        }
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
        className="flex-1 overflow-y-auto px-4 md:px-10 py-12 space-y-16 w-full noa-chat-list-audit scroll-smooth custom-scrollbar bg-white"
        style={{ height: 'calc(var(--chat-height) - 180px)' }}
      >
        {chatHistory.length === 0 && (
          <div className="text-center py-20 px-8">
            <div className="w-40 h-40 rounded-[3.5rem] flex items-center justify-center mx-auto mb-10 shadow-3xl border-4 border-slate-50 bg-white p-1 overflow-hidden animate-pulse-soft">
               <img 
                 src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                 alt="Noa" 
                 className="w-full h-full object-cover rounded-[3rem]"
                 referrerPolicy="no-referrer"
               />
            </div>
            <h2 className="text-5xl font-black mb-6 italic text-blue-950 tracking-tight">ראמי אהובי, שלום ❤️</h2>
            <p className="text-2xl font-bold text-slate-400 mb-16 w-full italic leading-relaxed">
               מערכת בינה מלאכותית לניהול לוגיסטי חכם <br/>
               <span className="text-gold font-black opacity-80">SabanOS 7.0 Precision Analytics</span>
            </p>
            
            <div className="action-grid w-full">
               {dynamicSuggestions.slice(0, 6).map(suggestion => (
                 <button 
                   key={suggestion.label}
                   onClick={() => onAction(suggestion.action)}
                   className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 text-xl font-black text-blue-900 hover:border-blue-900 hover:bg-white transition-all text-right shadow-sm flex items-center justify-between group active:scale-95 min-h-[90px]"
                 >
                   <span className="flex-1 ml-6">{suggestion.label}</span>
                   <div className="w-[60px] h-[60px] rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center group-hover:bg-blue-900 group-hover:text-white group-hover:border-blue-900 transition-all shrink-0 shadow-sm">
                     <ChevronRight size={28} />
                   </div>
                 </button>
               ))}
            </div>
          </div>
        )}
        
        {chatHistory.map((chat, idx) => (
          <motion.div 
            key={idx} 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            style={idx === 1 ? { width: '502.017px' } : {}}
            className={`flex w-full gap-8 ${chat.role === 'user' ? 'justify-start' : 'justify-end flex-row-reverse'}`}
          >
            {chat.role !== 'user' && (
              <div className="shrink-0 mt-4 h-full flex flex-col items-center">
                <img 
                  src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                  alt="Noa" 
                  className="w-16 h-16 rounded-2xl object-cover shadow-2xl border-2 border-white"
                />
              </div>
            )}
            <div 
              style={idx === 51 ? { height: '5697.34px', width: '879.858px' } : {}}
              className={`w-full max-w-none p-10 md:p-14 rounded-[3.5rem] text-2xl md:text-3xl font-black leading-[1.4] shadow-2xl transition-all border-2 ${
                idx === 51 ? 'noa-bubble-52' : idx === 49 ? 'noa-bubble-50' : ''
              } ${
              chat.role === 'user' 
                ? 'bg-slate-50 text-blue-900 border-slate-200 rounded-tr-none' 
                : 'bg-white text-slate-900 rounded-tl-none border-blue-900/10 shadow-blue-900/5'
            }`}>
              {(chat.parts[0]?.text || "").includes('<table') || (chat.parts[0]?.text || "").includes('<div') ? (
                <div 
                  className={`w-full overflow-x-auto custom-scrollbar prose prose-2xl max-w-none text-right noa-html-content ${
                    idx === 51 ? 'noa-report-active' : ''
                  } ${chat.role === 'user' ? 'prose-slate' : 'prose-blue'}`}
                  dangerouslySetInnerHTML={{ __html: chat.parts[0]?.text || "" }}
                />
              ) : (
                <div 
                  className={`whitespace-pre-wrap text-right break-words overflow-hidden ${idx === 51 ? 'noa-inner-52' : ''}`}
                >
                  {chat.parts[0]?.text || ""}
                  {(() => {
                    const textToScan = chat.parts[0]?.text || "";
                    const orderIdRegex = /#?(\d{4,8})/g;
                    const matches = [...textToScan.matchAll(orderIdRegex)];
                    const orderIds = [...new Set(matches.map(m => m[1]))];
                    
                    return orderIds.length > 0 && (
                      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
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
                <div className={`flex items-center gap-6 mt-12 pt-12 border-t-2 border-slate-50`}>
                  <button 
                    onClick={() => speak(chat.parts[0].text, idx)}
                    className={`w-[60px] h-[60px] flex items-center justify-center rounded-2xl transition-all shadow-md ${currentlySpeaking === idx ? 'bg-blue-900 text-white' : 'bg-slate-50 text-slate-400 hover:text-blue-900 hover:bg-white border-2 border-transparent hover:border-blue-900'}`}
                  >
                    {currentlySpeaking === idx ? <VolumeX size={32} /> : <Volume2 size={32} />}
                  </button>
                  
                  {currentlySpeaking === idx && (
                    <div className="flex items-center gap-3 h-8 px-6">
                      {[1, 2.5, 4, 3.5, 4.5, 2, 3].map((h, i) => (
                        <motion.div 
                          key={i}
                          animate={{ height: [8, h * 8, 8] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                          className="w-2 bg-blue-900/30 rounded-full"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex-1" />
                  <span className="text-sm font-black text-slate-300 uppercase italic">Noa Intelligence Protocol v7.0</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Massive Input Area - Mobile Focused */}
      <div className="bg-white border-t-4 border-slate-100 px-6 py-10 z-30 shrink-0 shadow-[0_-25px_60px_rgba(30,58,138,0.08)]">
        <div className="w-full space-y-10 noa-input-area-audit">
          {/* Quick Actions - Large Horizontal Scroll */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 noa-quick-actions-audit">
            {dynamicSuggestions.map((btn, i) => (
              <button 
                key={i}
                onClick={() => onAction(btn.action)}
                className={`whitespace-nowrap btn-primary min-w-fit px-10 rounded-[1.8rem] flex items-center gap-4 shrink-0 transition-all hover:bg-blue-800 hover:scale-105 active:scale-95 noa-quick-btn-audit`}
              >
                {btn.icon ? React.cloneElement(btn.icon as React.ReactElement, { size: 24 }) : <Waves size={24} />}
                <span className="text-lg">{btn.label}</span>
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
            className="flex gap-6 items-center noa-form-audit"
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
              className={`w-[68px] h-[68px] rounded-3xl transition-all shadow-xl active:scale-90 flex items-center justify-center shrink-0 border-2 noa-paperclip-audit ${
                isUploading ? 'bg-slate-50 text-slate-200 border-slate-100' : 'bg-white text-blue-900 border-slate-100 hover:border-blue-900 hover:shadow-2xl'
              }`}
            >
              <Paperclip size={32} className={isUploading ? 'animate-pulse' : ''} />
            </button>
            <input 
              name="message"
              autoComplete="off"
              placeholder="הקלד פקודה לוגיסטית..."
              className={`flex-1 bg-slate-50 border-2 border-slate-100 text-blue-950 rounded-[2rem] px-12 h-[68px] text-2xl focus:border-blue-900 focus:bg-white transition-all outline-none font-black placeholder:text-slate-300 shadow-inner noa-input-audit`}
            />
            <button 
              type="submit"
              className={`bg-blue-900 text-white h-[68px] w-[68px] rounded-[2rem] hover:bg-gold hover:text-blue-950 transition-all shadow-3xl active:scale-95 flex items-center justify-center shrink-0 border-2 border-blue-800 noa-send-audit`}
            >
              <Send size={40} strokeWidth={4} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
