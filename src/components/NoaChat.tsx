import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  ChevronRight,
  Volume2,
  VolumeX,
  Zap,
  Sparkles,
  Terminal,
  Database
} from 'lucide-react';
import { Order } from '../types';
import { noaBrain } from '../services/newNoaBrain';

interface NoaChatProps {
  chatHistory: any[];
  chatScrollRef: React.RefObject<HTMLDivElement>;
  onBack: () => void;
  onAction: (action: string) => void;
  orders: Order[];
  isLoading?: boolean;
}

// רינדור תוכן חכם - מזהה טבלאות ומבני נתונים
const SmartContent = ({ text }: { text: string }) => {
  const isDataBlock = text.includes('|') || text.includes('sku:') || text.includes('---');
  
  if (isDataBlock) {
    return (
      <div className="my-4 rounded-2xl border border-sky-200/30 bg-slate-900/90 p-4 shadow-2xl overflow-x-auto">
        <div className="flex items-center gap-2 mb-2 border-b border-slate-700 pb-2">
          <Terminal size={14} className="text-sky-400" />
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">SabanOS Data Output</span>
        </div>
        <div className="text-xs font-mono text-sky-300 whitespace-pre leading-relaxed">
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

  const speak = (text: string, index: number) => {
    if (!synthRef.current) return;
    if (currentlySpeaking === index) { stopSpeaking(); return; }
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text.replace(/[*_#|]/g, ''));
    const voices = synthRef.current.getVoices();
    utterance.voice = voices.find(v => v.lang.includes('he')) || voices[0];
    utterance.lang = 'he-IL';
    utterance.rate = 1.1;

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

  const dynamicSuggestions = [
    { label: 'מצב מלאי 📦', action: 'מה מצב המלאי כרגע?' },
    { label: 'סטטוס נהגים 🚛', action: 'איפה הנהגים שלי?' },
    { label: 'דוח בוקר 📋', action: 'תכיני דוח בוקר' },
    { label: 'הזמנות פתוחות 📑', action: 'איזה הזמנות פתוחות יש?' }
  ];

  return (
    <div className="fixed inset-0 h-full w-full bg-[#f8fafc] flex flex-col md:flex-row overflow-hidden font-assistant" dir="rtl">
      
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex w-80 bg-white/40 backdrop-blur-3xl border-l border-white/20 flex-col p-8 shrink-0 z-50 shadow-2xl relative">
        <div className="flex items-center gap-4 mb-12">
          <button onClick={onBack} className="p-3 bg-white hover:bg-sky-50 rounded-2xl shadow-sm transition-all border border-sky-100 group">
            <ChevronRight size={20} className="text-sky-600 group-hover:-translate-x-1 transition-transform" />
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Noa <span className="text-sky-500 italic">Brain</span></h1>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-[2rem] bg-white shadow-xl shadow-sky-900/5 border border-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">הקראה</span>
              <button 
                onClick={() => setIsAutoVoice(!isAutoVoice)}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${isAutoVoice ? 'bg-sky-600 shadow-lg shadow-sky-600/30' : 'bg-slate-200'}`}
              >
                <motion.div animate={{ x: isAutoVoice ? 24 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-md" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 font-bold leading-relaxed">כשמצב הקראה פעיל, נועה תדבר איתך אוטומטית.</p>
          </div>

          <div className="p-6 rounded-[2rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-sky-500/20 transition-all" />
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <Database size={14} className="text-sky-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">SabanOS Context</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300 relative z-10">
              נועה מחוברת כעת למאגר ה-Firestore ולגיליון ה-Sheets שלך בטייבה.
            </p>
          </div>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col h-full relative bg-white overflow-hidden">
        {/* Diamond Polishing Background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-100/30 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-50/40 blur-[100px] rounded-full pointer-events-none" />

        {/* Mobile Header */}
        <header className="p-4 border-b border-slate-100 flex items-center justify-between md:hidden bg-white/70 backdrop-blur-xl z-50">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-sky-50 rounded-xl transition-colors">
              <ChevronRight size={22} className="text-sky-600" />
            </button>
            <h1 className="font-black text-xl italic tracking-tighter">Noa AI</h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-green-600 uppercase tracking-widest text-right">Connected</span>
          </div>
        </header>

        {/* Messages */}
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 z-10 scroll-smooth pb-40"
        >
          <AnimatePresence>
            {chatHistory.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center shadow-2xl mb-8 relative">
                   <div className="absolute inset-0 bg-sky-500 blur-2xl opacity-20 scale-150 animate-pulse" />
                   <Zap className="text-white fill-sky-400 text-sky-400" size={40} />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-4 italic tracking-tight">שלום ראמי, במה נתמקד?</h2>
                <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-4">
                  {dynamicSuggestions.map(s => (
                    <button 
                      key={s.label}
                      onClick={() => onAction(s.action)}
                      className="p-4 bg-white/50 backdrop-blur-md rounded-3xl border border-sky-100 text-xs font-bold text-slate-700 hover:bg-sky-600 hover:text-white transition-all shadow-sm"
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex w-full ${chat.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`relative max-w-[90%] md:max-w-2xl p-6 md:p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-xl ${
                  chat.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-tr-none' 
                    : 'bg-white/90 text-slate-800 rounded-tl-none border border-white ring-1 ring-sky-100/50'
                }`}>
                  <div className="text-sm md:text-lg font-bold leading-relaxed">
                    <SmartContent text={chat.role === 'user' ? chat.content : (chat.parts?.[0]?.text || chat.content)} />
                  </div>
                  
                  {chat.role !== 'user' && (
                    <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-100">
                      <button 
                        onClick={() => speak(chat.parts?.[0]?.text || chat.content, idx)}
                        className={`p-3 rounded-full transition-all ${currentlySpeaking === idx ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-400'}`}
                      >
                        {currentlySpeaking === idx ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end w-full">
                <div className="bg-white/90 p-6 rounded-[2.5rem] rounded-tl-none shadow-xl border border-sky-50 flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2.5 h-2.5 bg-sky-400 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-2.5 h-2.5 bg-sky-500 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-2.5 h-2.5 bg-sky-600 rounded-full" />
                  </div>
                  <span className="text-xs font-black text-sky-600 italic tracking-tighter uppercase">Noa is processing...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Dock */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-white via-white to-transparent pt-12 pb-8 px-6 z-40">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative flex items-center group">
              <div className="absolute inset-0 bg-sky-400/20 blur-3xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="דבר עם נועה... (מלאי, נהגים, דוחות)"
                className="w-full bg-white border-2 border-slate-100 rounded-[3rem] pl-24 pr-8 py-5 md:py-6 text-lg font-bold focus:border-sky-600 transition-all outline-none shadow-2xl relative z-10"
              />
              <button 
                type="submit"
                disabled={isLoading}
                className="absolute left-3 p-4 md:p-5 bg-slate-900 text-white rounded-full hover:bg-sky-600 transition-all shadow-xl active:scale-90 z-20 disabled:opacity-50"
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
