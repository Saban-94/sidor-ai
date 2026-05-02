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
  Waves
} from 'lucide-react';
import { Order } from '../types';
import { parseItems } from '../lib/utils';

interface NoaChatProps {
  chatHistory: any[];
  chatScrollRef: React.RefObject<HTMLDivElement>;
  onBack: () => void;
  onAction: (action: string) => void;
  orders: Order[];
}

export const NoaChat = ({ 
  chatHistory, 
  chatScrollRef, 
  onBack, 
  onAction,
  orders 
}: NoaChatProps) => {
  const [isAutoVoice, setIsAutoVoice] = useState(() => localStorage.getItem('noa_auto_voice') === 'true');
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

const dynamicSuggestions = [
  { 
    label: 'סנכרון חכם 📂', 
    action: 'סרוק את SabanOS, חלץ נתונים והצלבת כתובות מול מאגר המיקומים החכמים' 
  },
  { 
    label: 'אופטימיזציה למחר 🏗️', 
    action: 'תכנני מסלול אופטימלי לחכמת ועלי למחר על בסיס נתוני עבר' 
  },
  { 
    label: 'דוח בוקר HTML 📋', 
    action: 'תכיני דוח בוקר מעוצב בטבלה כולל צפי הגעה לכל נהג' 
  },
  { 
    label: 'אימות פריקה (PTO) ✅', 
    action: 'בדקי חריגות בין מיקומי GPS להפעלת מנוף בסידור האחרון' 
  },
  { 
    label: 'תובנות אתרים 🧠', 
    action: 'אילו אתרים מוכרים לנו מהסידור של היום ומה זמן הפריקה הממוצע בהם?' 
  },
  { 
    label: 'חריגות מלאי ⚠️', 
    action: 'האם יש חוסרים בבטון או ריצופית ביחס להזמנות הפתוחות?' 
  },
  { 
    label: 'סטטוס הפצה חי 📊', 
    action: 'מה סטטוס ההפצה כרגע? הצג בפורמט ציר זמן (Timeline)' 
  },
  // קישורים דינמיים לפי הזמנות בביצוע עם חיזוי חכם
  ...orders.filter(o => o.status === 'preparing').slice(0, 3).map(o => ({
    label: `צפי ל${o.customerName.split(' ')[0]} ⏱️`,
    action: `חשבי ETA חכם ל${o.customerName} בהתבסס על היסטוריית פריקות בכתובת ${o.destination}`
  }))
];

  return (
    <div className="h-[100dvh] bg-white flex flex-col md:flex-row overflow-hidden" dir="rtl">
      {/* Left Sidebar for Desktop (Quick Info) */}
      <div className="hidden md:flex w-72 bg-gray-50 border-l border-gray-100 flex-col p-6 overflow-y-auto shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <ChevronRight size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img 
              src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
              alt="Noa" 
              className="w-8 h-8 rounded-full object-cover"
            />
            <h1 className="text-xl font-black">סידור</h1>
          </div>
        </div>
        
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest text-right">סטטוס מוח</p>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                <span className="text-xs font-black">נועה - מנהלת סידור ❤️ | מחוברת ✅</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest text-right">הגדרות קול</p>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">נועה מדברת</span>
                  <button 
                    onClick={() => setIsAutoVoice(!isAutoVoice)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${isAutoVoice ? 'bg-sky-600' : 'bg-gray-200'}`}
                  >
                    <motion.div 
                      animate={{ x: isAutoVoice ? 20 : 2 }}
                      className="absolute top-1 left-0 w-3 h-3 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>
                <p className="text-[9px] text-gray-400 leading-tight">במצב פעיל, נועה תקריא כל תשובה חדשה באופן אוטומטי.</p>
              </div>
            </div>
          </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-[#f4f7f6] relative overflow-hidden">
        {/* Saban Chat Styled Header */}
        <header className="p-3 bg-[#e67e22] text-white flex items-center justify-between shadow-lg z-30 shrink-0">
          <div className="flex items-center gap-3">
             <button onClick={onBack} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
               <ChevronRight size={20} />
             </button>
             <div className="flex flex-col">
               <h1 className="font-black text-sm uppercase tracking-wider">צאט עם נועה</h1>
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_5px_rgba(74,222,128,0.8)]" />
                 <span className="text-[10px] font-bold">נועה - מנהלת סידור ❤️ | מחוברת ✅</span>
               </div>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <img 
               src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
               alt="Noa" 
               className="w-9 h-9 rounded-full object-cover border-2 border-white/50"
             />
             <div className="flex gap-2 text-white/80">
                <button className="hover:text-white"><Settings size={16} /></button>
                <button onClick={onBack} className="hover:text-white"><ChevronRight size={16} className="rotate-90" /></button>
             </div>
          </div>
        </header>

        {/* Message List */}
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-full md:max-w-4xl mx-auto w-full scroll-smooth"
        >
          {chatHistory.length === 0 && (
            <div className="text-center py-20 px-4">
              <div className="w-24 h-24 rounded-[3rem] flex items-center justify-center mx-auto mb-6 shadow-2xl relative overflow-hidden bg-sky-50">
                 <img 
                   src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                   alt="Noa" 
                   className="w-full h-full object-cover"
                   referrerPolicy="no-referrer"
                 />
                 <div className="absolute inset-0 border-4 border-white/20 rounded-[3rem]" />
              </div>
              <h2 className="text-2xl font-black mb-2 italic">שלום ראמי  ❤️</h2>
              <p className="text-sm font-bold text-gray-400 mb-8 max-w-[250px] mx-auto">איך אני יכולה לעזור לך ולאחי ושותפי היום? 🏗️</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                 {dynamicSuggestions.slice(0, 6).map(suggestion => (
                   <button 
                     key={suggestion.label}
                     onClick={() => onAction(suggestion.action)}
                     className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-bold text-gray-600 hover:bg-sky-50 hover:border-sky-100 transition-all text-right shadow-sm flex items-center justify-between group"
                   >
                     <span>{suggestion.label}</span>
                     <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                   </button>
                 ))}
              </div>
            </div>
          )}
          
          {chatHistory.map((chat, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`flex w-full gap-3 ${chat.role === 'user' ? 'justify-start' : 'justify-end flex-row-reverse'}`}
            >
              {chat.role !== 'user' && (
                <img 
                  src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                  alt="Noa" 
                  className="w-8 h-8 rounded-full object-cover shrink-0 mt-1 shadow-md"
                />
              )}
              <div className={`max-w-[85%] md:max-w-md p-4 rounded-2xl text-sm md:text-base font-bold leading-relaxed shadow-sm relative group/msg ${
                chat.role === 'user' 
                  ? 'bg-sky-500 text-white rounded-tr-none' 
                  : 'bg-[#e2e8e4] text-gray-800 rounded-tl-none border border-gray-200/50'
              }`}>
                {chat.parts[0].text.includes('<table') || chat.parts[0].text.includes('<div') ? (
                  <div 
                    className="prose prose-sm max-w-none text-right"
                    dangerouslySetInnerHTML={{ __html: chat.parts[0].text }}
                  />
                ) : (
                  chat.parts[0].text
                )}
                
                {chat.role !== 'user' && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-sky-50/50">
                    <button 
                      onClick={() => speak(chat.parts[0].text, idx)}
                      className={`p-2 rounded-xl transition-all ${currentlySpeaking === idx ? 'bg-sky-100 text-sky-600' : 'hover:bg-gray-100 text-gray-400'}`}
                    >
                      {currentlySpeaking === idx ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    
                    {currentlySpeaking === idx && (
                      <div className="flex items-center gap-0.5 h-4">
                        {[1, 2, 3, 4, 3, 2, 1].map((h, i) => (
                          <motion.div 
                            key={i}
                            animate={{ height: [4, h * 4, 4] }}
                            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                            className="w-0.5 bg-sky-400 rounded-full"
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
        <div className="bg-gradient-to-t from-white via-white to-transparent pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-6 px-4 md:px-6 z-20 shrink-0 border-t border-gray-50/50">
          <div className="max-w-full md:max-w-4xl mx-auto space-y-4">
            {/* Quick Actions Scrollable */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 scroll-smooth">
              {dynamicSuggestions.map((btn, i) => (
                <button 
                  key={i}
                  onClick={() => onAction(btn.action)}
                  className="whitespace-nowrap bg-white/95 backdrop-blur-md hover:bg-sky-600 hover:text-white text-sky-950 text-[11px] font-black px-4 py-3 rounded-full transition-all border border-sky-100 shadow-md hover:shadow-sky-200 active:scale-95 flex items-center gap-2"
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
              className="flex gap-3 items-center"
            >
              <input 
                name="message"
                autoComplete="off"
                placeholder="כיצד אוכל לעזור?"
                className="flex-1 bg-white/90 backdrop-blur-md border-[3px] border-sky-100 rounded-[2.5rem] px-5 md:px-8 py-3.5 md:py-4 text-sm md:text-base focus:border-sky-600 transition-all outline-none shadow-2xl font-bold"
              />
              <button 
                type="submit"
                className="bg-gray-900 text-white p-3.5 md:p-4 rounded-full hover:bg-sky-600 transition-all shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center shrink-0"
              >
                <Send size={20} className="md:w-6 md:h-6" strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
