import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronRight, Volume2, VolumeX, Zap, Terminal, Database } from 'lucide-react';
import { askNewNoa } from '../services/newNoaBrain';

interface NoaChatProps {
  onBack: () => void;
  inventory: any[];
  drivers: any[];
}

const SmartContent = ({ text }: { text: string }) => {
  const isData = text?.includes('|') || text?.includes('sku:');
  if (isData) {
    return (
      <div className="my-4 rounded-2xl bg-slate-900 p-4 font-mono text-[11px] text-sky-300 shadow-2xl border border-white/10">
        <div className="flex items-center gap-2 mb-2 opacity-50 border-b border-white/10 pb-1">
          <Terminal size={12} /> <span>SabanOS Data Output</span>
        </div>
        <div className="whitespace-pre overflow-x-auto">{text}</div>
      </div>
    );
  }
  return <p className="leading-relaxed whitespace-pre-wrap">{text}</p>;
};

export const NoaChat = ({ onBack, inventory, drivers }: NoaChatProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askNewNoa(input, messages, { inventory, drivers });
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', content: "ראמי אחי, יש לי תקלה בחיבור. תבדוק את ה-API KEY." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 h-screen w-screen bg-[#f8fafc] flex flex-col font-assistant z-[100]" dir="rtl">
      {/* Header */}
      <header className="p-5 border-b bg-white/70 backdrop-blur-xl flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronRight size={24} className="text-sky-600" />
          </button>
          <h1 className="text-2xl font-black italic">Noa <span className="text-sky-500">Pro</span></h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-100 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-green-600 uppercase">Live SDK</span>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 pb-40">
        <AnimatePresence>
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-20">
              <Zap size={48} className="mb-4 text-sky-600" />
              <h2 className="text-xl font-bold">איך עוזרים היום?</h2>
              <p className="text-sm">המלאי והנהגים מסונכרנים ומוכנים.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[90%] md:max-w-2xl p-6 rounded-[2.5rem] shadow-xl backdrop-blur-md ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                <SmartContent text={msg.content} />
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex justify-end">
              <div className="bg-white p-6 rounded-[2.5rem] rounded-tl-none shadow-lg border border-sky-50 flex items-center gap-3">
                <div className="flex gap-1">
                  <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-2 h-2 bg-sky-400 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-sky-500 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-sky-600 rounded-full" />
                </div>
                <span className="text-xs font-black text-sky-600 uppercase italic">Noa is thinking...</span>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center group">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="דבר עם נועה..."
            className="w-full bg-white border-2 border-slate-100 rounded-[3rem] px-8 py-5 md:py-6 text-lg font-bold focus:border-sky-600 transition-all outline-none shadow-2xl"
          />
          <button type="submit" disabled={isLoading} className="absolute left-3 p-4 bg-slate-900 text-white rounded-full hover:bg-sky-600 transition-all disabled:opacity-50 shadow-xl">
            <Send size={24} />
          </button>
        </form>
      </div>
    </div>
  );
};
