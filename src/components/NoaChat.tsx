import React from 'react';
import { motion } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  ChevronRight 
} from 'lucide-react';
import { Order } from '../services/auraService';

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
  return (
    <div className="h-[100dvh] bg-white flex flex-col md:flex-row overflow-hidden" dir="rtl">
      {/* Left Sidebar for Desktop (Quick Info) */}
      <div className="hidden md:flex w-72 bg-gray-50 border-l border-gray-100 flex-col p-6 overflow-y-auto shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <ChevronRight size={20} />
          </button>
          <h1 className="text-xl font-bold">נועה מנהלת סידור ראמי</h1>
        </div>
        
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">סטטוס מערכת</p>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
              <span className="text-sm font-bold">זמינה לראמי</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        <header className="p-4 border-b border-gray-100 flex items-center justify-between md:hidden bg-white/80 backdrop-blur-md z-30 shrink-0">
          <div className="flex items-center gap-3">
             <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
               <ChevronRight size={20} />
             </button>
             <h1 className="font-black text-lg text-gray-900 italic font-sans">נועה AI</h1>
          </div>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-green-500 rounded-full" />
             <span className="text-[10px] font-black text-gray-400 uppercase">ONLINE</span>
          </div>
        </header>

        {/* Message List */}
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-full md:max-w-4xl mx-auto w-full scroll-smooth"
        >
          {chatHistory.length === 0 && (
            <div className="text-center py-20 px-4">
              <div className="bg-sky-50 w-24 h-24 rounded-[3rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                 <MessageSquare className="text-sky-600" size={48} />
              </div>
              <h2 className="text-2xl font-black mb-2 italic">הי זאת נועה מה אפשר לעשות היום?</h2>
              <p className="text-sm font-bold text-gray-400 mb-8 max-w-[250px] mx-auto">"תפתחי הזמנה חדשה לחכמת לשעה 9 ליעד ברקאי"</p>
              
              <div className="grid grid-cols-1 gap-3 max-w-xs mx-auto">
                 {['תכיני לי דוח בוקר 📋', 'צפי הגעה להזמנה ⏱️', 'מה המצב נהגים? 🏗️'].map(suggestion => (
                   <button 
                     key={suggestion}
                     onClick={() => onAction(suggestion)}
                     className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-bold text-gray-600 hover:bg-sky-50 hover:border-sky-100 transition-all text-right shadow-sm"
                   >
                     {suggestion}
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
              className={`flex w-full ${chat.role === 'user' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[90%] md:max-w-md p-5 rounded-[2.5rem] text-sm md:text-base font-bold leading-relaxed shadow-xl backdrop-blur-md ${
                chat.role === 'user' 
                  ? 'bg-sky-600 text-white rounded-tr-none shadow-sky-600/10' 
                  : 'bg-white/95 text-gray-800 rounded-tl-none border-2 border-sky-50'
              }`}>
                {chat.parts[0].text}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input Area */}
        <div className="bg-gradient-to-t from-white via-white to-transparent pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-6 px-4 md:px-6 z-20 shrink-0 border-t border-gray-50/50">
          <div className="max-w-full md:max-w-4xl mx-auto space-y-4">
            {/* Quick Actions Scrollable */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 scroll-smooth">
              {[
                { label: 'הזמנה חדשה ✍️', action: 'הזמנה חדשה אחי' },
                { label: 'עדכון סטטוס ✅', action: 'אני רוצה לעדכן סטטוס להזמנה' },
                { label: 'דוח בוקר 📋', action: 'תכיני לי דוח בוקר' },
                ...(orders.length > 0 ? [{ label: `צפי ל${orders[0].customerName.split(' ')[0]} ⏱️`, action: `מה צפי ההגעה של ההזמנה של ${orders[0].customerName}` }] : [])
              ].map((btn, i) => (
                <button 
                  key={i}
                  onClick={() => onAction(btn.action)}
                  className="whitespace-nowrap bg-white/90 backdrop-blur-md hover:bg-sky-600 hover:text-white text-sky-900 text-[11px] font-black px-4 py-2.5 rounded-2xl transition-all border border-sky-100 shadow-md hover:shadow-sky-200 active:scale-95"
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
                placeholder="דבר איתי אחי..."
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
