import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  ChevronRight,
  Volume2,
  VolumeX,
  Speaker,
  Settings,
  Waves,
  Sparkles,
  Zap,
  Terminal
} from 'lucide-react';
import { Order } from '../types';
import { parseItems } from '../lib/utils';

interface NoaChatProps {
  chatHistory: any[];
  chatScrollRef: React.RefObject<HTMLDivElement>;
  onBack: () => void;
  onAction: (action: string) => void;
  orders: Order[];
  isLoading?: boolean;
}

// קומפוננטה פנימית לרינדור נתונים חכם (טבלאות/רשימות) בתוך הודעה
const SmartContent = ({ text }: { text: string }) => {
  // בדיקה אם הטקסט מכיל מבנה של טבלה או רשימת מלאי
  if (text.includes('|') || text.includes('sku:')) {
    return (
      <div className="overflow-x-auto my-3 rounded-xl border border-sky-100/30 bg-white/5 backdrop-blur-md">
        <div className="p-3 text-xs font-mono whitespace-pre text-sky-900 leading-relaxed">
          {text}
        </div>
      </div>
    );
  }
  return <p className="leading-relaxed whitespace-pre-wrap">{text}</p>;
};

export const NoaChat = ({ 
  chatHistory, 
  chatScrollRef, 
  onBack, 
  onAction,
  orders,
  isLoading = false
}: NoaChatProps) => {
  const [isAutoVoice, setIsAutoVoice] = useState(() => localStorage.getItem('noa_auto_voice') === 'true');
  const [currentlySpeaking, setCurrentlySpeaking] = useState<number | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

  useEffect(() => {
    localStorage.setItem('noa_auto_voice', String(isAutoVoice));
  }, [isAutoVoice]);

  const cleanTextForSpeech = (text: string) => {
    const items = parseItems(text);
    if (items.length > 0) {
      let speech = "הנה הפריטים שנמצאו: ";
      items.forEach((item, index) => {
        speech += `פריט ${index + 1}: ${item.name}, כמות: ${item.quantity}. `;
      });
      return speech;
    }
    return text.replace(/[*_#|]/g, '').trim();
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setCurrentlySpeaking(null);
    }
  };

  const speak = (text: string, index: number) => {
    if (!synthRef.current) return;
    if (currentlySpeaking === index) { stopSpeaking(); return; }
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
    const voices = synthRef.current.getVoices();
    utterance.voice = voices.find(v => v.lang.includes('he')) || voices[0];
    utterance.lang = 'he-IL';
    utterance.rate = 1.1;

    utterance.onstart = () => setCurrentlySpeaking(index);
    utterance.onend = () => setCurrentlySpeaking(null);
    synthRef.current.speak(utterance);
  };

  const dynamicSuggestions = [
    { label: 'סנכרון מלאי 🔄', action: 'בצע סנכרון מלאי' },
    { label: 'דוח בוקר 📋', action: 'תכיני לי דוח בוקר' },
    { label: 'סטטוס נהגים 🚚', action: 'מה מצב הנהגים?' },
    { label: 'חריגות ⚠️', action: 'הצג חריגות בטון' },
    ...orders.filter(o => o.status === 'preparing').slice(0, 1).map(o => ({
      label: `ETA ל${o.customerName.split(' ')[0]}`,
      action: `מה הצפי הגעה ל${o.customerName}?`
    }))
  ];

  return (
    <div className="fixed inset-0 h-screen w-screen bg-[#f8fafc] flex flex-col md:flex-row overflow-hidden font-assistant" dir="rtl">
      
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex w-80 bg-white/70 backdrop-blur-2xl border-l border-white/20 flex-col p-8 shrink-0 z-50 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-100/20 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-4 mb-12 relative">
          <button onClick={onBack} className="p-3 bg-white hover:bg-sky-50 rounded-2xl shadow-sm transition-all border border-sky-100">
            <ChevronRight size={20} className="text-sky-600" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900">נועה <span className="text-sky-500">AI</span></h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SabanOS Engine</span>
            </div>
          </div>
        </div>

        <div className="space-y-8 relative">
          <div className="p-5 rounded-3xl bg-white/50 border border-white/40 shadow-inner">
            <p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">מצב נועה</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">הקראה אוטומטית</span>
              <button 
                onClick={() => setIsAutoVoice(!isAutoVoice)}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${isAutoVoice ? 'bg-sky-600' : 'bg-slate-300'}`}
              >
                <motion.div animate={{ x: isAutoVoice ? 24 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-lg" />
              </button>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-widest">טיפ חכם</span>
            </div>
            <p className="text-xs leading-relaxed opacity-80 font-medium">
              "ראמי, אתמול חכמת הגיע לברקאי באיחור. כדאי להוציא אותו מוקדם יותר היום."
            </p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-white">
        {/* Diamond Polishing Overlays */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-200/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-100/30 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Mobile Header */}
        <header className="p-5 border-b border-slate-100/50 flex items-center justify-between md:hidden bg-white/70 backdrop-blur-xl z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-sky-50 rounded-xl transition-colors">
              <ChevronRight size={22} className="text-sky-600" />
            </button>
            <h1 className="font-black text-xl text-slate-900 tracking-tighter italic">Noa AI</h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 bg-green-50 rounded-full flex items-center gap-2 border border-green-100">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-black text-green-600 uppercase">Live</span>
             </div>
          </div>
        </header>

        {/* Messages Container */}
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 max-w-5xl mx-auto w-full z-10 scroll-smooth pb-32"
        >
          <AnimatePresence>
            {chatHistory.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="relative mb-8">
                  <div className="w-24 h-24 bg-sky-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10">
                    <Zap className="text-white fill-white" size={40} />
                  </div>
                  <div className="absolute inset-0 bg-sky-400 rounded-[2.5rem] blur-2xl opacity-20 scale-125" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight italic">איך נתקדם, ראמי?</h2>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 w-full max-w-md">
                  {dynamicSuggestions.map(s => (
                    <button 
                      key={s.label}
                      onClick={() => onAction(s.action)}
                      className="p-5 glass rounded-[2rem] border border-sky-100 text-sm font-bold text-slate-700 hover:bg-sky-600 hover:text-white transition-all shadow-sm active:scale-95"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {chatHistory.map((chat, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, x: chat.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex w-full ${chat.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`relative max-w-[85%] md:max-w-2xl p-6 md:p-7 rounded-[2.5rem] text-sm md:text-lg font-bold shadow-2xl backdrop-blur-xl ${
                  chat.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-tr-none' 
                    : 'bg-white/80 text-slate-800 rounded-tl-none border border-white/50 ring-1 ring-sky-100/50'
                }`}>
                  <SmartContent text={chat.parts[0].text} />
                  
                  {chat.role !== 'user' && (
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100/30">
                      <button 
                        onClick={() => speak(chat.parts[0].text, idx)}
                        className={`p-2.5 rounded-full transition-all ${currentlySpeaking === idx ? 'bg-sky-600 text-white shadow-lg' : 'bg-sky-50 text-sky-400'}`}
                      >
                        {currentlySpeaking === idx ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                      {currentlySpeaking === idx && (
                        <div className="flex gap-1 h-5 items-end">
                          {[1,2,3,4,3,2,1].map((h, i) => (
                            <motion.div 
                              key={i}
                              animate={{ height: [4, h * 4, 4] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                              className="w-1 bg-sky-500 rounded-full"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end w-full">
                <div className="bg-white/80 p-6 rounded-[2.5rem] rounded-tl-none shadow-xl border border-sky-50 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-2 h-2 bg-sky-400 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-sky-500 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-sky-600 rounded-full" />
                  </div>
                  <span className="text-sm font-black text-sky-600 italic uppercase tracking-tighter">נועה חושבת...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Dock */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-white via-white/95 to-transparent pt-10 pb-8 px-6 z-40">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
              {dynamicSuggestions.map((s) => (
                <button 
                  key={s.label}
                  onClick={() => onAction(s.action)}
                  className="whitespace-nowrap bg-sky-50 text-sky-600 text-xs font-black px-5 py-2.5 rounded-full border border-sky-100 hover:bg-sky-600 hover:text-white transition-all shadow-sm"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const input = form.elements.namedItem('message') as HTMLInputElement;
                if (!input.value.trim()) return;
                onAction(input.value);
                input.value = '';
              }}
              className="relative flex items-center"
            >
              <input 
                name="message"
                autoComplete="off"
                placeholder="דבר עם נועה... (מלאי, נהגים, הזמנות)"
                className="w-full bg-white border-2 border-slate-100 rounded-[3rem] pl-20 pr-8 py-5 text-lg font-bold focus:border-sky-600 transition-all outline-none shadow-2xl placeholder:text-slate-300"
              />
              <button 
                type="submit"
                className="absolute left-3 p-4 bg-slate-900 text-white rounded-full hover:bg-sky-600 transition-all shadow-xl active:scale-90"
              >
                <Send size={24} strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
