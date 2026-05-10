import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { NoaChat } from './NoaChat';
import { Order } from '../types';

interface NoaFloatingChatProps {
  chatHistory: any[];
  onAction: (action: string, file?: File | string) => void;
  orders: Order[];
  currentContext?: string;
}

export const NoaFloatingChat: React.FC<NoaFloatingChatProps> = ({
  chatHistory,
  onAction,
  orders,
  currentContext
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-[300] flex flex-col items-end gap-4" dir="rtl">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9, transformOrigin: 'bottom left' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="w-[90vw] md:w-[450px] h-[600px] max-h-[80vh] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden glassmorphism"
          >
            {/* Header */}
            <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                    alt="Noa" 
                    className="w-10 h-10 rounded-2xl object-cover shadow-sm border border-slate-200"
                  />
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse shadow-sm" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight leading-none uppercase">המוח של SabanOS</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">נועה מנהלת סידור • LIVE</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2.5 rounded-xl hover:bg-slate-50 text-slate-400 transition-colors border border-transparent hover:border-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 min-h-0">
               <NoaChat 
                 chatHistory={chatHistory} 
                 onBack={() => setIsOpen(false)} 
                 onAction={onAction} 
                 orders={orders}
                 isPopup={true}
                 chatScrollRef={{ current: null } as any} // Internal ref will be used
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-2xl transition-all relative group ${
          isOpen ? 'bg-slate-900 text-white rotate-90' : 'bg-white text-slate-900 border border-slate-200'
        }`}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={28} />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} className="relative">
               <Sparkles className="text-amber-500 absolute -top-4 -right-4 animate-bounce" size={20} />
               <MessageSquare size={28} fill="currentColor" className="opacity-10" />
               <img 
                src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                alt="Noa" 
                className="w-10 h-10 rounded-xl object-cover shadow-sm absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <style>{`
        .glassmorphism {
          background: rgba(255, 255, 255, 0.8) !important;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>
    </div>
  );
};
