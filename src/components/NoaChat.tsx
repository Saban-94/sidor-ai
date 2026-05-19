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

  // Initial mount behavior: Focus and Scroll
  useEffect(() => {
    const scrollOnMount = () => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'auto' // Immediate on mount for established chats
        });
      }
    };
    
    // Delay slightly to ensure layout is settled
    const timer = setTimeout(scrollOnMount, 300);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to bottom - Ultra-Robust handling for SabanOS Precision
  useEffect(() => {
    const scrollToBottom = (force = false) => {
      if (chatScrollRef.current) {
        const { scrollHeight, clientHeight, scrollTop } = chatScrollRef.current;
        const isNearBottom = scrollHeight - clientHeight - scrollTop < 100;
        
        if (force || isNearBottom) {
          chatScrollRef.current.scrollTo({
            top: scrollHeight,
            behavior: force ? 'auto' : 'smooth'
          });
        }
      }
    };

    // Initial scroll (aggressive)
    setTimeout(() => scrollToBottom(true), 100);
    setTimeout(() => scrollToBottom(true), 500);

    // Use ResizeObserver to detect real-time rendering changes (images, cards)
    if (chatScrollRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        scrollToBottom();
      });
      resizeObserver.observe(chatScrollRef.current);
      return () => resizeObserver.disconnect();
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
      { label: 'אופטימיזציית מסלולים 🗺️', action: 'תכנני מסלול אופטימלי להפצות של מחר', icon: <Waves size={14} /> },
      { label: 'אימות פריקה (PTO) ✅', action: 'בדקי חריגות ב-PTO עבור כל הנהגים בהובלות האחרונות', icon: <ShieldCheck size={14} /> }
    ]
  };

  const dynamicSuggestions = contextSuggestions[currentContext] || contextSuggestions.general;

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] relative overflow-hidden" dir="rtl">
      {/* SabanOS Precision Scaling & Density Fix */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --chat-height: 100vh; }
        @supports (height: 100svh) { :root { --chat-height: 100svh; } }
        
        .noa-html-content table { 
          width: 100% !important; 
          border-collapse: collapse !important;
          border: 1px solid #e2e8f0 !important;
          font-size: 11px !important;
        }
        .noa-html-content th, .noa-html-content td {
          padding: 0.4rem !important;
          border-bottom: 1px solid #f1f5f9 !important;
        }
        .noa-html-content h2 { 
          font-size: 14px !important; 
          font-weight: 700 !important;
          margin-bottom: 0.5rem !important;
          color: #1e293b !important;
        }
        .noa-html-content p {
          font-size: 12px !important;
          margin-bottom: 0.5rem !important;
        }

        /* Message List Density */
        .chat-container {
          padding: 0.5rem !important;
          gap: 0.25rem !important;
        }
        .message-bubble {
          padding: 0.75rem 1rem !important;
          border-radius: 1rem !important;
          font-size: 13px !important;
          line-height: 1.4 !important;
          max-width: 90% !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
        }
        .message-bubble-user {
          background-color: #f8fafc !important;
          border-color: #e2e8f0 !important;
          color: #0F172A !important; /* High Contrast Navy */
          font-weight: 700 !important;
        }
        .message-bubble-ai {
          background-color: #0F172A !important; /* Pure Navy */
          border-color: #C5A059 / 30 !important; /* Gold border */
          color: #ffffff !important; /* Sharp White */
          font-weight: 400 !important;
        }
        
        .message-bubble-ai button {
           @apply bg-slate-800 border border-gold/40 text-white font-black hover:bg-slate-700 active:scale-95;
           padding: 4px 8px !important;
           border-radius: 6px !important;
           font-size: 11px !important;
           margin: 2px !important;
        }
        
        /* Input Area Density */
        .input-area-card {
          padding: 0.5rem 1rem !important;
          border-top: 1px solid #f1f5f9 !important;
        }
        .quick-actions-bar {
          padding: 0.25rem 0 !important;
          gap: 0.5rem !important;
        }
        .quick-action-btn {
          height: 28px !important;
          font-size: 11px !important;
          padding: 0 0.75rem !important;
          border-radius: 0.5rem !important;
        }
        .chat-form {
          height: 36px !important;
          gap: 0.5rem !important;
        }
        .chat-input {
          height: 32px !important;
          font-size: 13px !important;
          padding: 0 0.75rem !important;
          border-radius: 0.75rem !important;
        }
        .icon-btn {
          width: 32px !important;
          height: 32px !important;
          border-radius: 0.75rem !important;
        }
        .header-avatar {
           width: 32px !important;
           height: 32px !important;
        }
        .header-btn {
           width: 32px !important;
           height: 32px !important;
           border-radius: 0.5rem !important;
        }

        .noa-html-content tr:nth-child(3) td:nth-child(3) { color: #68707d !important; }
        .noa-html-content tr:nth-child(4) td:nth-child(3) { color: #5e6269 !important; }

        .noa-html-content {
          height: auto !important;
          min-height: 400px;
          margin-bottom: 2rem;
        }
      `}} />
      
      <header className="px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
           <button onClick={onBack} className="header-btn flex items-center justify-center bg-navy text-white active:scale-95 transition-all shadow-sm">
             <ChevronRight size={16} />
           </button>
           <div className="flex flex-col">
             <h1 className="font-bold text-xs uppercase tracking-tight leading-none mb-0.5">SabanOS Precision</h1>
             <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-pulse" />
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">נועה | מחוברת ✅</span>
             </div>
           </div>
        </div>
        <div className="flex items-center">
           <img 
             src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
             alt="Noa" 
             className="header-avatar rounded-lg object-cover border border-slate-100 shadow-sm"
           />
        </div>
      </header>

      {/* Message List - Dense & Small Text */}
      <div 
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto chat-container flex flex-col w-full scroll-smooth custom-scrollbar bg-white"
        style={{ height: 'calc(var(--chat-height) - 100px)' }}
      >
        {chatHistory.length === 0 && (
          <div className="text-center py-10 px-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md bg-white p-0.5 overflow-hidden">
               <img 
                 src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                 alt="Noa" 
                 className="w-full h-full object-cover rounded-xl"
                 referrerPolicy="no-referrer"
               />
            </div>
            <h2 className="text-xl font-bold mb-2 text-blue-950 tracking-tight">שלום ראמי ❤️</h2>
            <p className="text-xs font-medium text-slate-400 mb-8 italic">
               SabanOS 7.0 | תפעול ולוגיסטיקה חכמה
            </p>
            
            <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
               {dynamicSuggestions.slice(0, 4).map(suggestion => (
                 <button 
                   key={suggestion.label}
                   onClick={() => onAction(suggestion.action)}
                   className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-bold text-blue-900 hover:bg-white transition-all text-right flex items-center justify-between group active:scale-95"
                 >
                   <span className="flex-1 ml-2">{suggestion.label}</span>
                   <ChevronRight size={12} className="text-slate-300" />
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
            className={`flex w-full gap-2 ${chat.role === 'user' ? 'justify-start' : 'justify-end flex-row-reverse'}`}
          >
            {chat.role !== 'user' && (
              <div className="shrink-0 mt-1">
                <img 
                  src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                  alt="Noa" 
                  className="w-6 h-6 rounded-md object-cover shadow-sm border border-white"
                />
              </div>
            )}
            <div 
              className={`message-bubble border ${
              chat.role === 'user' 
                ? 'message-bubble-user rounded-tr-none' 
                : 'message-bubble-ai rounded-tl-none'
            }`}>
              {(chat.parts[0]?.text || "").includes('<table') || (chat.parts[0]?.text || "").includes('<div') ? (
                <div 
                  className={`w-full overflow-x-auto custom-scrollbar noa-html-content ${chat.role === 'user' ? 'prose-slate' : 'prose-blue'}`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const btn = target.closest('button');
                    if (btn && btn.dataset.intent) {
                      const intent = btn.dataset.intent;
                      const payload = btn.dataset.payload || '';
                      
                      if (intent === 'inventory') {
                        onAction(`בצע סריקת מלאי עבור: ${payload}`);
                      } else if (intent === 'customer_history') {
                        onAction(`הציגי היסטוריית הזמנות עבור הלקוח: ${payload}`);
                      } else if (intent === 'whatsapp') {
                        onAction(`שלח הודעת וואטסאפ לנהג: ${payload}`);
                      } else if (intent === 'siddur') {
                        onAction(`פתח סידור עבודה יומי`);
                      } else if (intent === 'galia_notes') {
                        onAction(`הציגי לי את משימת תעודות המשלוח של גליה`);
                      } else if (intent === 'confirm_galia') {
                        onAction(`אני מאשרת שסיימתי את בדיקת תעודות גליה`);
                      }
                    }
                  }}
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
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-50">
                  <button 
                    onClick={() => speak(chat.parts[0].text, idx)}
                    className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${currentlySpeaking === idx ? 'bg-blue-900 text-white' : 'text-slate-300 hover:text-blue-900'}`}
                  >
                    {currentlySpeaking === idx ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                  <div className="flex-1" />
                  <span className="text-[8px] font-bold text-slate-300 uppercase italic">SabanOS Intelligence</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Massive Input Area - Optimized for SabanOS Precision 6.0 */}
      <div className="bg-white border-t border-slate-100 px-4 py-3 z-30 shrink-0 shadow-xl noa-input-parent-audit">
        <div className="w-full space-y-3 noa-input-area-audit">
          {/* Quick Actions - Compact Horizontal Scroll */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 noa-quick-actions-audit">
            {dynamicSuggestions.map((btn, i) => (
              <button 
                key={i}
                onClick={() => onAction(btn.action)}
                className={`whitespace-nowrap bg-slate-50 border border-slate-100 text-blue-950 min-w-fit px-4 py-1.5 rounded-full flex items-center gap-2 shrink-0 transition-all hover:bg-white hover:border-blue-900 active:scale-95 noa-quick-btn-audit text-xs font-bold`}
              >
                {btn.icon ? React.cloneElement(btn.icon as React.ReactElement, { size: 14 }) : <Waves size={14} />}
                <span>{btn.label}</span>
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
            className="flex gap-2 items-center noa-form-audit"
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
              className={`w-10 h-10 rounded-xl transition-all shadow-sm active:scale-90 flex items-center justify-center shrink-0 border noa-paperclip-audit ${
                isUploading ? 'bg-slate-50 text-slate-200 border-slate-100' : 'bg-white text-blue-900 border-slate-100 hover:border-blue-900'
              }`}
            >
              <Paperclip size={20} className={isUploading ? 'animate-pulse' : ''} />
            </button>
            <input 
              name="message"
              autoComplete="off"
              autoFocus
              placeholder="הקלד פקודה לוגיסטית..."
              className={`flex-1 bg-slate-50 border border-slate-100 text-blue-950 rounded-xl px-4 h-10 text-sm focus:border-blue-900 focus:bg-white transition-all outline-none font-bold placeholder:text-slate-300 shadow-inner noa-input-audit`}
            />
            <button 
              type="submit"
              className={`bg-blue-900 text-white h-10 w-10 rounded-xl hover:bg-gold hover:text-blue-950 transition-all shadow-lg active:scale-95 flex items-center justify-center shrink-0 noa-send-audit`}
            >
              <Send size={24} strokeWidth={3} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
