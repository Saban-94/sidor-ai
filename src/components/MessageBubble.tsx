import React from 'react';
import { motion } from 'motion/react';
import { TeamChatMessage } from '../types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { 
  CheckCheck,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { MediaRenderer } from './MediaRenderer';

interface MessageBubbleProps {
  message: TeamChatMessage;
  isMe: boolean;
  onImageClick?: (url: string) => void;
  variant?: 'standard' | 'glass';
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, onImageClick, variant = 'standard' }) => {
  const isUrgent = message.priority === 'urgent';
  const showMedia = message.fileId || message.imageUrl || message.fileUrl;
  const isGlass = variant === 'glass';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex gap-2 sm:gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} mb-6 group/msg w-full md:w-auto overflow-hidden transition-all`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0 self-end mb-1">
        <Avatar 
          src={message.senderAvatar} 
          name={message.senderName} 
          size="sm" 
          className="group-hover/msg:scale-110 transition-transform duration-300 rounded-xl"
        />
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 ${isGlass ? 'border-slate-900' : 'border-white'} shadow-sm`} />
      </div>

      <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className={`text-[10px] font-black uppercase tracking-widest italic ${isGlass ? 'text-slate-400' : 'text-gray-500'}`}>
            {message.senderName}
          </span>
          <span className={`text-[9px] font-bold ${isGlass ? 'text-slate-500' : 'text-gray-400'}`}>
            {message.timestamp?.seconds ? format(new Date(message.timestamp.seconds * 1000), 'HH:mm', { locale: he }) : ''}
          </span>
          {isUrgent && (
            <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter animate-pulse">
              דחוף
            </span>
          )}
        </div>

        <div 
          className={`relative overflow-hidden transition-all duration-300 ${
            isGlass
              ? isMe 
                ? 'bg-sky-600/40 backdrop-blur-md text-white rounded-3xl rounded-tr-none shadow-2xl shadow-sky-900/40 border border-sky-400/30' 
                : 'bg-slate-800/60 backdrop-blur-md text-slate-200 border border-slate-700/50 rounded-3xl rounded-tl-none shadow-xl'
              : isMe 
                ? 'bg-sky-600 text-white rounded-2xl rounded-tr-none shadow-lg shadow-sky-600/20' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-none shadow-md'
          } ${isUrgent ? 'ring-2 ring-red-500' : ''}`}
        >
          {/* Media Rendering */}
          {showMedia && (
            <div className="p-1">
              <MediaRenderer 
                fileId={message.fileId}
                fileUrl={message.fileUrl}
                imageUrl={message.imageUrl}
                fileName={message.fileName}
                mimeType={message.mimeType}
                isMe={isMe}
                onOpen={onImageClick}
              />
            </div>
          )}

          {/* Text Content */}
          {message.text && (
            <div className={`p-3.5 sm:p-5 ${showMedia ? 'pt-2' : ''}`}>
              <p className="text-sm sm:text-[15px] font-bold leading-relaxed whitespace-pre-wrap">
                {message.text}
              </p>
            </div>
          )}

          <div className={`px-2 pb-1 flex justify-end items-center gap-1 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
             <span className="text-[8px] font-bold">
               {message.timestamp?.seconds ? format(new Date(message.timestamp.seconds * 1000), 'HH:mm') : ''}
             </span>
             {isMe && (
               <CheckCheck size={12} className={message.priority === 'urgent' ? 'text-yellow-300' : 'text-white/80'} />
             )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

