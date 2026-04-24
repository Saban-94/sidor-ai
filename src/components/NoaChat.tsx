import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, ChevronRight, Volume2, VolumeX, 
  Zap, Terminal, LayoutPanelLeft, Sparkles
} from 'lucide-react';

interface NoaChatProps {
  chatHistory: any[];
  chatScrollRef: React.RefObject<HTMLDivElement>;
  onBack: () => void;
  onAction: (action: string) => void;
  isLoading?: boolean;
}

/**
 * רכיב הקנבס - עם הגנה מוגברת מפני טקסט חסר
 */
const DataCanvas = ({ htmlContent }: { htmlContent: string }) => {
  if (!htmlContent || typeof htmlContent !== 'string' || !htmlContent.includes('<table')) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="my-6 relative group"
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-blue-600 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
      <div className="relative bg-white/90 backdrop-blur-xl border border-sky-100 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="bg-slate-900 px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <LayoutPanelLeft size={16} className="text-sky-400" />
            <span className="text-[11px] font-black text-sky-100 uppercase tracking-widest">SabanOS Data Canvas</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
          </div>
        </div>
        <div className="p-1 overflow-x-auto custom-scrollbar">
          <div 
            className="prose prose-slate max-w-none noa-html-content"
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
          />
        </div>
      </div>
    </motion.div>
  );
};

export const NoaChat = ({ 
  chatHistory = [], 
  chatScrollRef, 
  onBack, 
  onAction,
  isLoading = false
}: NoaChatProps) => {
  const [inputValue, setInputValue] = useState('');
  
  useEffect(() => {
    if (chatScrollRef?.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onAction(inputValue);
    setInputValue('');
  };

  return (
    <div className="fixed inset-0 h-screen w-screen bg-[#f1f5f9] flex flex-col overflow-hidden font-assistant" dir="rtl">
      
      <header className="p-5 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-sky-50 rounded-xl transition-all">
            <ChevronRight size={24} className="text-sky-600" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-black text-xl italic text-slate-900 leading-none">Noa AI</h1>
            <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest mt-1">Canvas Mode Active</span>
          </div>
        </div>
        <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
          <Zap size={20} className="text-sky-400 fill-sky-400" />
        </div>
      </header>

      <div 
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 z-10 scroll-smooth pb-44"
      >
        <AnimatePresence>
          {chatHistory && chatHistory.map((chat, idx) => {
            if (!chat) return null;

            // חילוץ טקסט בטוח - מונע את שגיאת ה-includes
            const rawContent = chat.content || (chat.parts && chat.parts[0]?.text) || "";
            const text = typeof rawContent === 'string' ? rawContent : "";
            
            const hasTable = text.includes('<table');

            return (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col w-full ${chat.role === 'user' ? 'items-start' : 'items-end'}`}
              >
                <div className={`relative max-w-[90%] md:max-w-2xl p-5 md:p-7 rounded-[2.5rem] shadow-xl backdrop-blur-md ${
                  chat.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-tr-none' 
                    : 'bg-white/95 text-slate-800 rounded-tl-none border border-white'
                }`}>
                  <div className="text-sm md:text-lg font-bold leading-relaxed">
                    <p className="whitespace-pre-wrap">
                      {hasTable 
                        ? text.replace(/<table[\s\S]*?<\/table>/g, '[צפייה בנתונים בקנבס למטה 👇]') 
                        : text}
                    </p>
                  </div>
                </div>

                {chat.role !== 'user' && hasTable && (
                  <div className="w-full max-w-4xl mt-4">
                    <DataCanvas htmlContent={text.match(/<table[\s\S]*?<\/table>/)?.[0] || ''} />
                  </div>
                )}
              </motion.div>
            );
          })}

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end w-full">
              <div className="bg-white/90 p-6 rounded-[2.5rem] rounded-tl-none shadow-xl border border-sky-100 flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-sky-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Processing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-white via-white to-transparent pt-12 pb-10 px-6 z-40">
        <div className="max-w-4xl mx-auto relative group">
           <form onSubmit={handleSubmit} className="relative flex items-center">
            <input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="כתוב לנועה... (מלאי, נהגים, דוחות)"
              className="w-full bg-white border-2 border-slate-200 rounded-[3rem] pl-24 pr-10 py-6 text-lg font-bold focus:border-sky-600 transition-all outline-none shadow-2xl"
            />
            <button 
              type="submit"
              disabled={isLoading}
              className="absolute left-3 p-5 bg-slate-900 text-white rounded-full hover:bg-sky-600 transition-all shadow-xl disabled:opacity-50"
            >
              <Send size={24} strokeWidth={3} />
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .noa-html-content table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
        .noa-html-content th { background-color: #f8fafc; color: #1e293b; font-weight: 900; padding: 16px; border-bottom: 2px solid #e2e8f0; text-align: right; }
        .noa-html-content td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #334155; }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};
