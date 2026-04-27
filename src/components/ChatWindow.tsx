import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TeamChatMessage, UserProfile } from '../types';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  messages: TeamChatMessage[];
  currentUserProfile: UserProfile;
  teamMembers: UserProfile[];
  scrollRef: React.RefObject<HTMLDivElement>;
  recipientId?: string;
  variant?: 'standard' | 'glass';
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  currentUserProfile,
  teamMembers,
  scrollRef,
  recipientId,
  variant = 'standard',
  onLoadMore,
  isLoadingMore,
  hasMore = false
}) => {
  const isGlass = variant === 'glass';
  const typingMembers = teamMembers.filter(m => 
    m.id !== currentUserProfile.id && 
    m.isTyping && 
    (recipientId ? m.typingTo === recipientId : m.typingTo === 'global')
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onLoadMore || isLoadingMore || !hasMore) return;
    
    // If scrolled nearly to the top
    if (e.currentTarget.scrollTop < 50) {
      onLoadMore();
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col relative">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 ${isGlass ? '' : 'bg-gradient-to-b from-transparent to-sky-50/20'}`}
      >
        {hasMore && (
          <div className="flex justify-center pb-4">
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs animate-pulse">
                <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span>טוען הודעות קודמות...</span>
              </div>
            ) : (
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">גלול למעלה לטעינת הודעות נוספות</span>
            )}
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <div className="flex justify-center pb-4">
            <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest opacity-50">תחילת היסטוריית ההודעות</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble 
            key={msg.id || i}
            message={msg}
            isMe={msg.senderId === currentUserProfile.id}
            variant={variant}
          />
        ))}
      </div>

      <AnimatePresence>
        {typingMembers.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`absolute bottom-4 right-6 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border flex items-center gap-3 z-10 ${isGlass ? 'bg-slate-800/80 border-slate-700/50' : 'bg-white/80 border-sky-100'}`}
          >
            <div className="flex gap-1">
              <motion.div 
                animate={{ scale: [1, 1.5, 1] }} 
                transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                className={`w-1.5 h-1.5 rounded-full ${isGlass ? 'bg-sky-400' : 'bg-sky-600'}`} 
              />
              <motion.div 
                animate={{ scale: [1, 1.5, 1] }} 
                transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                className={`w-1.5 h-1.5 rounded-full ${isGlass ? 'bg-sky-400' : 'bg-sky-600'}`} 
              />
              <motion.div 
                animate={{ scale: [1, 1.5, 1] }} 
                transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                className={`w-1.5 h-1.5 rounded-full ${isGlass ? 'bg-sky-400' : 'bg-sky-600'}`} 
              />
            </div>
            <span className={`text-xs font-black tracking-tight italic ${isGlass ? 'text-sky-300' : 'text-sky-900'}`}>
              {typingMembers.map(m => m.name).join(', ')} מקליד/ה...
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
