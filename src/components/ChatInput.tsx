import React, { useState, useEffect, useRef } from 'react';
import { Send, AtSign, Paperclip, Bell, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Avatar } from './Avatar';

interface ChatInputProps {
  onSendMessage: (text: string, priority: 'normal' | 'urgent') => void;
  onFileUpload: (file: File) => void;
  currentUserProfile: UserProfile;
  teamMembers: UserProfile[];
  isUploading: boolean;
  uploadProgress: number;
  recipientId?: string;
  variant?: 'standard' | 'glass';
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onFileUpload,
  currentUserProfile,
  teamMembers,
  isUploading,
  uploadProgress,
  recipientId,
  variant = 'standard'
}) => {
  const isGlass = variant === 'glass';
  const [newMessage, setNewMessage] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [isPriorityUrgent, setIsPriorityUrgent] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastWriteTimeRef = useRef<number>(0);

  const updateTypingStatus = async (isTyping: boolean) => {
    if (!currentUserProfile?.id) return;
    
    const now = Date.now();
    // Throttle Firestore writes (3 seconds) unless we are turning it off
    if (!isTyping || now - lastWriteTimeRef.current > 3000) {
      try {
        await setDoc(doc(db, 'user_magic_pages', currentUserProfile.id), {
          isTyping,
          typingTo: isTyping ? (recipientId || 'global') : null,
          lastTyped: isTyping ? serverTimestamp() : null
        }, { merge: true });
        lastWriteTimeRef.current = now;
      } catch (err) {
        console.warn('Failed to update typing status', err);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    if (value.endsWith('@')) setShowMentions(true);
    else if (!value.includes('@')) setShowMentions(false);

    // Typing indicator logic
    updateTypingStatus(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 5000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !isUploading) return;
    
    onSendMessage(newMessage, isPriorityUrgent ? 'urgent' : 'normal');
    setNewMessage('');
    setIsPriorityUrgent(false);
    setShowMentions(false);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    updateTypingStatus(false);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      updateTypingStatus(false);
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className={`p-4 sm:p-6 border-t flex flex-col gap-3 sm:gap-4 sticky bottom-0 relative z-30 transition-all ${isGlass ? 'bg-slate-900/40 backdrop-blur-xl border-slate-700/50 rounded-3xl mt-4 shadow-2xl shadow-black/40' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input 
            value={newMessage}
            onChange={handleInputChange}
            placeholder={isGlass ? "כתוב הודעה מאובטחת..." : "כתוב הודעה לצוות..."}
            className={`w-full border rounded-2xl p-3 sm:p-4 pr-12 text-sm outline-none transition-all font-black ${isGlass ? 'bg-slate-800/50 border-slate-700/50 text-white focus:ring-4 focus:ring-sky-500/10 placeholder:text-slate-500' : 'bg-gray-50 border-gray-100 text-gray-900 focus:ring-2 focus:ring-sky-600/10'}`}
          />
          <button 
            type="button"
            onClick={() => setShowMentions(!showMentions)}
            className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isGlass ? 'text-slate-500 hover:text-sky-400' : 'text-gray-400 hover:text-sky-600'}`}
          >
            <AtSign size={18} />
          </button>
        </div>
        <button 
          type="submit"
          className="bg-sky-600 text-white p-3 sm:p-4 rounded-2xl hover:bg-sky-700 transition-all shadow-xl shadow-sky-600/20 active:scale-95"
        >
          <Send size={24} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer group shrink-0">
          <div className={`p-3 sm:p-2 rounded-xl sm:rounded-lg transition-all shadow-sm ${isGlass ? 'bg-slate-800 text-sky-400 group-hover:bg-slate-700' : 'bg-gray-100 text-gray-500 group-hover:bg-sky-100 group-hover:text-sky-600'}`}>
            <Paperclip size={20} className="sm:w-4 sm:h-4" />
          </div>
          <span className={`hidden sm:block text-[10px] font-black uppercase tracking-widest ${isGlass ? 'text-slate-500' : 'text-gray-400'}`}>צרף קובץ</span>
          <input 
            type="file" 
            className="hidden" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileUpload(file);
            }} 
            accept="image/*,.pdf,.xlsx,.xls,.csv" 
          />
        </label>

        <button 
          type="button"
          onClick={() => setIsPriorityUrgent(!isPriorityUrgent)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${isPriorityUrgent ? 'bg-red-500 text-white animate-pulse' : isGlass ? 'bg-slate-800 text-slate-500 hover:bg-red-500/20 hover:text-red-400' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600'}`}
        >
          <Bell size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">דחוף</span>
        </button>

        {isUploading && (
          <div className="flex flex-col gap-1 ml-auto min-w-[120px]">
            <div className={`flex items-center gap-2 font-bold text-[10px] animate-pulse ${isGlass ? 'text-sky-400' : 'text-sky-600'}`}>
              <Loader2 className="animate-spin" size={14} />
              מעלה קובץ... {Math.round(uploadProgress)}%
            </div>
            <div className={`h-1 w-full rounded-full overflow-hidden ${isGlass ? 'bg-slate-800' : 'bg-gray-100'}`}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-sky-600"
              />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showMentions && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`absolute bottom-32 right-6 w-64 rounded-2xl shadow-2xl border p-2 overflow-hidden z-20 ${isGlass ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-100'}`}
          >
            <div className={`p-2 border-b ${isGlass ? 'border-slate-800' : 'border-gray-50'}`}>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">תייג חבר צוות</p>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {teamMembers.map(m => (
                <button 
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setNewMessage(newMessage + m.name + ' ');
                    setShowMentions(false);
                  }}
                  className={`w-full text-right p-2 rounded-lg flex items-center gap-2 transition-all ${isGlass ? 'hover:bg-slate-800' : 'hover:bg-sky-50'}`}
                >
                  <Avatar src={m.avatarUrl} name={m.name} size="xs" />
                  <span className={`text-xs font-bold font-black ${isGlass ? 'text-slate-300' : 'text-gray-700'}`}>{m.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
};
