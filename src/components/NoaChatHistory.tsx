import React from 'react';
import { motion } from 'motion/react';
import { Clock, MessageSquare, Trash2, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: any;
}

interface NoaChatHistoryProps {
  sessions: ChatSession[];
  currentSessionId?: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
}

export const NoaChatHistory: React.FC<NoaChatHistoryProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onClose
}) => {
  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[100] flex flex-col border-r border-slate-100"
      dir="rtl"
    >
      <div className="p-6 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-sky-600 p-2 rounded-xl shadow-lg">
            <Clock className="text-white" size={18} />
          </div>
          <h2 className="text-xl font-black text-slate-900 italic">היסטוריית שיחות</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageSquare size={48} className="text-slate-100 mb-4" />
            <p className="text-slate-400 font-bold italic tracking-widest text-xs uppercase">אין שיחות קודמות</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div 
                key={session.id}
                className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${
                  currentSessionId === session.id 
                    ? 'bg-sky-50 border-sky-100 shadow-sm' 
                    : 'bg-white border-slate-50 hover:border-sky-100 hover:shadow-md'
                }`}
                onClick={() => onSelectSession(session.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm text-slate-800 line-clamp-1">{session.title || 'שיחה חדשה'}</h3>
                  <span className="text-[9px] font-black text-slate-300 uppercase">
                    {session.timestamp?.seconds ? format(new Date(session.timestamp.seconds * 1000), 'dd/MM HH:mm', { locale: he }) : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 italic leading-relaxed">
                  {session.lastMessage || 'אין תוכן בשיחה'}
                </p>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="absolute top-2 left-2 p-1.5 bg-white rounded-lg text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-slate-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-50/50 border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">
          SabanOS Precision 7.0 | נועה AI
        </p>
      </div>
    </motion.div>
  );
};
