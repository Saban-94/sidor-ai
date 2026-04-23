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

  // פונקציה לניקוי HTML לפני הקראה (כדי שלא תקריא תגיות <table> וכו')
  const cleanTextForSpeech = (text: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    
    return plainText
      .replace(/[*_#]/g, '')
      .replace(/[^\u0590-\u05FF0-9\s,.?!]/g, ' ')
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
    { label: 'דוח בוקר ☀️', action: 'נועה, תכיני להראל דוח בוקר בטבלה.' },
    { label: 'בקשת איסוף (איציק) 🚕', action: 'נועה, אני צריך איסוף מהבית לסניף מחר ב-06:10.'},
    { label: 'סטטוס נהגים 🚛', action: 'סטטוס נהגים חכמת ועלי.' },
  ];

  return (
    <div className="h-[100dvh] bg-white flex flex-col md:flex-row overflow-hidden" dir="rtl">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex w-72 bg-gray-50 border-l border-gray-100 flex-col p-6 overflow-y-auto shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <ChevronRight size={20} />
          </button>
          <h1 className="text-xl font-bold">נועה (SabanOS)</h1>
        </div>
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
            <span className="text-sm font-bold text-sky-900">זמינה לראמי נשמה</span>
          </div>
        </div>
      </div>

      {/* Chat Content */}
      <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 w-full max-w-4xl mx-auto">
          {chatHistory.map((chat, idx) => {
            const messageText = chat.parts[0].text;
            const isHtml = /<\/?[a-z][\s\S]*>/i.test(messageText);

            return (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className={`flex w-full ${chat.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[95%] md:max-w-xl p-5 rounded-[2rem] text-sm md:text-base font-bold shadow-lg ${
                  chat.role === 'user' ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100'
                }`}>
                  {/* כאן התיקון הקריטי: רינדור HTML אם קיים */}
                  {isHtml ? (
                    <div 
                      className="prose prose-sm max-w-none overflow-x-auto"
                      dangerouslySetInnerHTML={{ __html: messageText }} 
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{messageText}</div>
                  )}
                  
                  {chat.role !== 'user' && (
                    <button onClick={() => speak(messageText, idx)} className="mt-3 p-2 rounded-lg bg-white/50 hover:bg-white transition-colors">
                      {currentlySpeaking === idx ? <VolumeX size={16} className="text-sky-600" /> : <Volume2 size={16} className="text-gray-400" />}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto space-y-4">
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {dynamicSuggestions.map((s, i) => (
                  <button key={i} onClick={() => onAction(s.action)} className="whitespace-nowrap bg-sky-50 text-sky-700 px-4 py-2 rounded-full text-xs font-black border border-sky-100 hover:bg-sky-600 hover:text-white transition-all shadow-sm">
                    {s.label}
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
               <input name="message" placeholder="נועה, תכיני להראל דוח בוקר..." className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus:border-sky-600 outline-none font-bold" autoComplete="off" />
               <button type="submit" className="bg-gray-900 text-white p-4 rounded-2xl hover:scale-105 active:scale-95 transition-all">
                 <Send size={20} />
               </button>
             </form>
          </div>
        </div>
      </div>
    </div>
  );
};
