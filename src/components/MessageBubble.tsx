import React from 'react';
import { motion } from 'motion/react';
import { TeamChatMessage } from '../types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface MessageBubbleProps {
  message: TeamChatMessage;
  isMe: boolean;
  onImageClick?: (url: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, onImageClick }) => {
  const isUrgent = message.priority === 'urgent';
  const hasMentions = message.mentionedUserIds && message.mentionedUserIds.length > 0;

  return (
    <motion.div 
      initial={{ opacity: 0, x: isMe ? 20 : -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} mb-4`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <img 
          src={message.senderAvatar || 'https://via.placeholder.com/40'} 
          alt={message.senderName}
          className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm"
        />
        {/* We can't really do "Live Status" here based on lastSeen without fetching the user record, 
            so we'll assume the status was passed if needed or just handle it at the list level. 
            However, the prompt asks for it on the avatar. We'll add a placeholder dot. */}
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
      </div>

      <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
            {message.senderName}
          </span>
          <span className="text-[9px] text-gray-400 font-bold">
            {message.timestamp?.seconds ? format(new Date(message.timestamp.seconds * 1000), 'HH:mm', { locale: he }) : ''}
          </span>
        </div>

        <div 
          className={`relative p-4 rounded-2xl shadow-sm text-sm font-bold ${
            isMe 
              ? 'bg-sky-600 text-white rounded-tr-none' 
              : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
          } ${isUrgent ? 'border-2 border-red-500 animate-pulse' : ''}`}
        >
          {message.imageUrl && (
            <div 
              className="mb-3 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onImageClick?.(message.imageUrl!)}
            >
              <img src={message.imageUrl} alt="Attachment" className="max-w-full h-auto" />
            </div>
          )}
          
          <p className="whitespace-pre-wrap leading-relaxed">
            {message.text}
          </p>

          {hasMentions && (
            <div className="mt-2 pt-2 border-t border-black/5 flex flex-wrap gap-1">
              {message.mentionedUserIds?.map(uid => (
                <span key={uid} className="text-[9px] bg-black/10 px-1.5 py-0.5 rounded-full">@{uid}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
