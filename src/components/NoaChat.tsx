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

  useEffect(() => {
    localStorage.setItem('noa_auto_voice', String(isAutoVoice));
  }, [isAutoVoice]);

  const cleanTextForSpeech = (text: string) => {
    // הסרת תגיות HTML לצורך הקראה נקייה
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    const cleanText = tempDiv.textContent || tempDiv.innerText || "";

    return cleanText
      .replace(/[*_#`~]/g, '')
      .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
      .replace(/\s+/g, ' ')
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
    if (currentlySpeaking === index) {
      stopSpeaking();
      return;
    }
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
    const voices = synthRef.current.getVoices();
    const hebrewVoice = voices.find(v => v.lang.includes('he')) || voices[0];
    
    utterance.voice = hebrewVoice;
    utterance.lang = 'he-IL';
    utterance.onstart = () => setCurrentlySpeaking(index);
    utterance.onend = () => setCurrentlySpeaking(null);
    utterance.onerror = () => setCurrentlySpeaking(null);

    synthRef.current.speak(utterance);
  };

  useEffect(() => {
    if (isAutoVoice && chatHistory.length > 0) {
      const lastMessage = chatHistory[chatHistory.length - 1];
      if (lastMessage.role === 'model' || lastMessage.role === 'assistant') {
        speak(lastMessage.parts[0].text, chatHistory.length - 1);
      }
    }
  }, [chatHistory.length]);

const dynamicSuggestions = [
    { label: 'כניסת מנכ"ל (הראל) 👴', action: 'שלום, אני הראל.' },
    { label: 'כניסת רכש (נתנאל) 🧔', action: 'שלום נועה, זה נתנאל רבינוביץ.' },
    { label: 'זמני תפילה (נתנאל) 🕌', action: 'נועה, מתי מנחה וערבית היום בהוד השרון?' },
    { label: 'כניסת מחסן (אורן) 🏗️', action: 'זה אורן מהמחסן.' },
    { label: 'בקשת איסוף (איציק) 🚕', action: 'נועה, אני צריך איסוף מהבית לסניף מחר ב-06:10.'},
    { label: 'סריקת מסמך 📂', action: 'תסרקי את הקובץ האחרון בתיקייה.' },
    { label: 'דוח בוקר ☀️', action: 'נועה, תכיני להראל דוח בוקר בטבלה.' },
    { label: 'מוצרים שיצאו 📊', action: 'מה המוצרים שיצאו היום?' },
    { label: 'סטטוס נהגים 🚛', action: 'סטטוס נהגים חכמת ועלי.' },
    ...orders
      .filter(o => o.status === 'preparing')
      .slice(0, 2)
      .map(o => ({
        label: `צפי ל${o.customerName.split(' ')[0]} ⏱️`,
        action: `מה ה-ETA של ${o.customerName}?`
      }))
  ];

  return (
    <div className="h-[100dvh] bg-white flex flex-col md:flex-row overflow-hidden font-sans" dir="rtl">
      {/* Styles for HTML Tables injected by Noa */}
      <style>{`
        .noa-html-content table { width: 100%; border-collapse: collapse; margin: 12px 0; background: white; border-radius: 8px; overflow: hidden; }
        .noa-html-content th { background: #0369a1; color: white; padding: 8px; text-align: right; font-size: 12px; }
        .noa-html-content td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
        .noa-html-content tr:nth-child(even) { background: #f8fafc; }
      `}</style>

      {/* Sidebar Desktop */}
      <div className="hidden md:flex w-72 bg-gray-50 border-l border-gray-100 flex-col p-6 overflow-y-auto shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <ChevronRight size={20} />
          </button>
          <h1 className="text-xl font-bold">נועה (סידור ח.סבן)</h1>
        </div>
        <div className="space-y-6 text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">סטטוס מערכת</p>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-bold">זמינה לראמי</span>
          </div>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <header className="p-4 border-b border-gray-100 flex items-center justify-between md:hidden bg-white/80 backdrop-blur-md z-30 shrink-0">
          <div className="flex items-center gap-3">
             <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
               <ChevronRight size={20} />
             </button>
             <h1 className="font-black text-lg text-gray-900 italic">נועה AI</h1>
          </div>
          <button onClick={() => setIsAutoVoice(!isAutoVoice)} className={`p-2 rounded-xl ${isAutoVoice ? 'bg-sky-50 text-sky-600' : 'text-gray-400'}`}>
             <Speaker size={18} />
          </button>
        </header>

        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 w-full max-w-4xl mx-auto scroll-smooth">
          {chatHistory.length === 0 && (
            <div className="text-center py-20 px-4">
              <div className="bg-sky-50 w-24 h-24 rounded-[3rem] flex items-center justify-center mx-auto mb-6">
                 <MessageSquare className="text-sky-600" size={48} />
              </div>
              <h2 className="text-2xl font-black mb-2 italic">היי אני נועה! 👩🏼</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                 {dynamicSuggestions.slice(0, 6).map(suggestion => (
                   <button key={suggestion.label} onClick={() => onAction(suggestion.action)} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-bold text-right flex items-center justify-between group">
                     <span>{suggestion.label}</span>
                     <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                   </button>
                 ))}
              </div>
            </div>
          )}

          {chatHistory.map((chat, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${chat.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[90%] md:max-w-md p-5 rounded-[2rem] text-sm md:text-base font-bold shadow-sm ${
                chat.role === 'user' ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-sky-50'
              }`}>
                {/* דחיית ה-HTML למסך בצורה מאובטחת */}
                <div 
                  className="noa-html-content leading-relaxed" 
                  dangerouslySetInnerHTML={{ __html: chat.parts[0].text }} 
                />
                
                {chat.role !== 'user' && (
                  <button onClick={() => speak(chat.parts[0].text, idx)} className="mt-3 p-2 hover:bg-gray-100 rounded-lg text-gray-400 block transition-colors">
                    {currentlySpeaking === idx ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer Input */}
        <div className="p-4 border-t border-gray-50 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
              {dynamicSuggestions.map((btn, i) => (
                <button key={i} onClick={() => onAction(btn.action)} className="whitespace-nowrap bg-white border border-sky-100 px-4 py-2 rounded-full text-[11px] font-black shadow-sm">
                  {btn.label}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const input = (e.target as any).message;
              if (!input.value) return;
              onAction(input.value);
              input.value = '';
            }} className="flex gap-2">
              <input name="message" autoComplete="off" placeholder="דבר איתי אחי..." className="flex-1 bg-gray-50 border-none rounded-full px-6 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none font-bold" />
              <button type="submit" className="bg-gray-900 text-white p-3 rounded-full hover:bg-sky-600 transition-colors">
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
