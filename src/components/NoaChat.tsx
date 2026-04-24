import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Send, ChevronRight, Volume2, VolumeX, 
  Zap, Sparkles, Terminal, Database, ShieldCheck 
} from 'lucide-react';
import { Order } from '../types';

interface NoaChatProps {
  chatHistory: any[];
  chatScrollRef: React.RefObject<HTMLDivElement>;
  onBack: () => void;
  onAction: (action: string) => void;
  orders: Order[];
  isLoading?: boolean;
}

// קומפוננטה לרינדור חכם של נתונים וטבלאות - כולל הגנה משגיאות
const SmartContent = ({ text }: { text: any }) => {
  // הגנה: אם הטקסט לא מחרוזת, נהפוך אותו לכזו או נחזיר ריק
  const content = typeof text === 'string' ? text : '';
  if (!content) return null;

  const isDataBlock = content.includes('|') || content.includes('sku:') || content.includes('---');
  
  if (isDataBlock) {
    return (
      <div className="my-4 rounded-2xl border border-sky-200/30 bg-slate-900/95 p-4 shadow-2xl overflow-x-auto ring-1 ring-white/10">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-sky-400" />
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black">SabanOS Engine Output</span>
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
          </div>
        </div>
        <div className="text-[11px] md:text-xs font-mono text-sky-300 whitespace-pre leading-relaxed tracking-tight">
          {content}
        </div>
      </div>
    );
  }
  return <p className="leading-relaxed whitespace-pre-wrap">{content}</p>;
};

export const NoaChat = ({ 
  chatHistory = [], 
  chatScrollRef, 
  onBack, 
  onAction,
  orders = [],
  isLoading = false
}: NoaChatProps) => {
  const [isAutoVoice, setIsAutoVoice] = useState(() => localStorage.getItem('noa_auto_voice') === 'true');
  const [currentlySpeaking, setCurrentlySpeaking] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

  useEffect(() => {
    localStorage.setItem('noa_auto_voice', String(isAutoVoice));
  }, [isAutoVoice]);

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setCurrentlySpeaking(null);
    }
  };

  const speak = (text: any, index: number) => {
    const content = typeof text === 'string' ? text : '';
    if (!synthRef.current || !content) return;
    if (currentlySpeaking === index) { stopSpeaking(); return; }
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(content.replace(/[*_#|]/g, ''));
    const voices = synthRef.current.getVoices();
    utterance.voice = voices.find(v => v.lang.includes('he')) || voices[0];
    utterance.lang = 'he-IL';
    utterance.rate = 1.0;

    utterance.onstart = () => setCurrentlySpeaking(index);
    utterance.onend = () => setCurrentlySpeaking(null);
    synthRef.current.speak(utterance);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onAction(inputValue);
    setInputValue('');
  };

  const suggestions = [
    { label: 'מצב מלאי 📦', action: 'מה מצב המלאי?' },
    { label: 'סידור נהגים 🚛', action: 'מי בדרכים עכשיו?' },
    { label: 'דוח בוקר 📋', action: 'תפיקי דוח בוקר' }
  ];

  return (
    <div className="fixed inset-0 h-screen w-screen bg-[#f1f5f9] flex flex-col md:flex-row overflow-hidden font-assistant" dir="rtl">
      
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex w-80 bg-white/40 backdrop-blur-3xl border-l border-white/20 flex-col p-8 shrink-0 z-50 shadow-2xl relative">
        <div className="flex items-center gap-4 mb-12 relative z-10">
          <button onClick={onBack} className="p-3 bg-white hover:bg-sky-50 rounded-2xl shadow-sm transition-all border border-sky-100 group">
            <ChevronRight size={20} className="text-sky-600 group-hover:-translate-x-1 transition-transform" />
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Noa <span className="text-sky-500 italic">Pro</span></h1>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="p-6 rounded-[2.5rem] bg-white shadow-xl shadow-sky-900/5 border border-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">מנוע קול</span>
              <button 
                onClick={() => setIsAutoVoice(!isAutoVoice)}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${isAutoVoice ? 'bg-sky-600 shadow-lg shadow-sky-600/30' : 'bg-slate-200'}`}
              >
                <motion.div animate={{ x: isAutoVoice ? 24 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-md" />
              </button>
            </div>
            <p className="text-xs text-slate-600 font-bold leading-relaxed italic">הקראה אוטומטית פעילה.</p>
          </div>

          <div className="p-6 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={14} className="text-sky-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">Direct SDK Link</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
              החיבור כעת ישיר ל-Google AI ללא פרוקסי.
            </p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative bg-white overflow-hidden">
        {/* Diamond Background Gloss */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-100/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-100/30 blur-[100px] rounded-full pointer-events-none" />

        {/* Mobile Header */}
        <header className="p-5 border-b border-slate-100 flex items-center justify-between md:hidden bg-white/80 backdrop-blur-xl z-50">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-sky-50 rounded-xl transition-colors">
              <ChevronRight size={22} className="text-sky-600" />
            </button>
            <h1 className="font-black text-xl italic tracking-tighter text-slate-900">Noa AI</h1>
          </div>
          <div className="px-3 py-1 bg-green-50 rounded-full flex items-center gap-2 border border-green-100">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-green-600 uppercase">Online</span>
          </div>
        </header>

        {/* Message Stream */}
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-12 space-y-10 z-10 scroll-smooth pb-44"
        >
          <AnimatePresence>
            {chatHistory.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-24 h-24 bg-slate-900 rounded-[3rem] flex items-center justify-center shadow-2xl mb-8 relative">
                   <Zap className="text-sky-400 fill-sky-400" size={40} />
                   <div className="absolute inset-0 bg-sky-400 blur-3xl opacity-20 scale-150 animate-pulse" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-6 italic tracking-tight">איך נתקדם היום?</h2>
                <div className="flex flex-wrap justify-center gap-3 max-w-lg">
                  {suggestions.map(s => (
                    <button 
                      key={s.label}
                      onClick={() => onAction(s.action)}
                      className="px-6 py-4 bg-white shadow-xl shadow-slate-200/50 rounded-[2rem] border border-slate-100 text-sm font-bold text-slate-700 hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {chatHistory.map((chat, idx) => {
              const chatText = chat.role === 'user' ? chat.content : (chat.parts?.[0]?.text || chat.content || '');
              return (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex w-full ${chat.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`relative max-w-[92%] md:max-w-2xl p-6 md:p-8 rounded-[2.8rem] shadow-2xl backdrop-blur-xl transition-all ${
                    chat.role === 'user' 
                      ? 'bg-slate-900 text-white rounded-tr-none' 
                      : 'bg-white/95 text-slate-800 rounded-tl-none border border-white ring-1 ring-slate-100'
                  }`}>
                    <div className="text-sm md:text-lg font-bold leading-relaxed tracking-tight">
                      <SmartContent text={chatText} />
                    </div>
                    
                    {chat.role !== 'user' && (
                      <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-100/50">
                        <button 
                          onClick={() => speak(chatText, idx)}
                          className={`p-3 rounded-full transition-all ${currentlySpeaking === idx ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30' : 'bg-sky-50 text-sky-500'}`}
                        >
                          {currentlySpeaking === idx ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end w-full">
                <div className="bg-white/95 p-6 rounded-[2.5rem] rounded-tl-none shadow-xl border border-sky-100 flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2.5 h-2.5 bg-sky-400 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-2.5 h-2.5 bg-sky-500 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-2.5 h-2.5 bg-sky-600 rounded-full" />
                  </div>
                  <span className="text-xs font-black text-sky-600 italic tracking-tighter uppercase">Noa Thinking...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Bar */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-white via-white to-transparent pt-12 pb-10 px-6 z-40">
          <div className="max-w-4xl mx-auto relative group">
             <div className="absolute -inset-1 bg-gradient-to-r from-sky-400 to-blue-600 rounded-[3rem] blur opacity-10 group-focus-within:opacity-30 transition duration-1000" />
             <form onSubmit={handleSubmit} className="relative flex items-center">
              <input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="כתוב לנועה... (מלאי, נהגים, דוחות)"
                className="w-full bg-white border-2 border-slate-100 rounded-[3rem] pl-24 pr-10 py-6 md:py-7 text-lg font-bold focus:border-sky-600 transition-all outline-none shadow-2xl placeholder:text-slate-300"
              />
              <button 
                type="submit"
                disabled={isLoading}
                className="absolute left-3 p-5 md:p-6 bg-slate-900 text-white rounded-full hover:bg-sky-600 transition-all shadow-xl active:scale-90 z-20 disabled:opacity-50"
              >
                <Send size={24} strokeWidth={3} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
