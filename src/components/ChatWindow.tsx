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
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  currentUserProfile,
  teamMembers,
  scrollRef,
  recipientId
}) => {
  const typingMembers = teamMembers.filter(m => 
    m.id !== currentUserProfile.id && 
    m.isTyping && 
    (recipientId ? m.typingTo === recipientId : m.typingTo === 'global')
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col relative">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 bg-gradient-to-b from-transparent to-sky-50/20"
      >
        {messages.map((msg, i) => (
          <MessageBubble 
            key={msg.id || i}
            message={msg}
            isMe={msg.senderId === currentUserProfile.id}
          />
        ))}
      </div>

      <AnimatePresence>
        {typingMembers.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 right-6 bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-sky-100 flex items-center gap-3 z-10"
          >
            <div className="flex gap-1">
              <motion.div 
                animate={{ scale: [1, 1.5, 1] }} 
                transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                className="w-1.5 h-1.5 bg-sky-600 rounded-full" 
              />
              <motion.div 
                animate={{ scale: [1, 1.5, 1] }} 
                transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                className="w-1.5 h-1.5 bg-sky-600 rounded-full" 
              />
              <motion.div 
                animate={{ scale: [1, 1.5, 1] }} 
                transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                className="w-1.5 h-1.5 bg-sky-600 rounded-full" 
              />
            </div>
            <span className="text-xs font-black text-sky-900 tracking-tight italic">
              {typingMembers.map(m => m.name).join(', ')} מקליד/ה...
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
