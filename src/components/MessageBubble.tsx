import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TeamChatMessage } from '../types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { 
  FileText, 
  Download, 
  Maximize2, 
  Loader2, 
  File as FileIcon,
  CheckCheck,
  Check,
  ExternalLink
} from 'lucide-react';

interface MessageBubbleProps {
  message: TeamChatMessage;
  isMe: boolean;
  onImageClick?: (url: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, onImageClick }) => {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  
  const isUrgent = message.priority === 'urgent';
  const hasMentions = message.mentionedUserIds && message.mentionedUserIds.length > 0;

  const isImage = (text: string) => {
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(text) || message.type === 'image' || !!message.imageUrl;
  };

  const isFile = (text: string) => {
    return /\.(pdf|doc|docx|xls|xlsx|txt)$/i.test(text) || message.type === 'file' || !!message.fileUrl;
  };

  const getMediaUrl = () => {
    if (message.imageUrl) return message.imageUrl;
    if (message.fileUrl) return message.fileUrl;
    if (message.text.startsWith('http')) return message.text;
    return null;
  };

  const mediaUrl = getMediaUrl();
  const showImage = isImage(message.text) && mediaUrl;
  const showFile = isFile(message.text) && mediaUrl && !showImage;

  const handleMediaClick = () => {
    if (showImage) {
      if (onImageClick) {
        onImageClick(mediaUrl!);
      } else {
        setShowLightbox(true);
      }
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`flex gap-2 sm:gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} mb-6 group/msg w-full md:w-auto overflow-hidden`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0 self-end mb-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl overflow-hidden border-2 border-white shadow-md transition-transform group-hover/msg:scale-110 duration-300">
            <img 
              src={message.senderAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(message.senderName)} 
              alt={message.senderName}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(message.senderName);
              }}
            />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
        </div>

        <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
          <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">
              {message.senderName}
            </span>
            <span className="text-[9px] text-gray-400 font-bold">
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
              isMe 
                ? 'bg-sky-600 text-white rounded-2xl rounded-tr-none shadow-lg shadow-sky-600/20' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-none shadow-md'
            } ${isUrgent ? 'ring-2 ring-red-500' : ''}`}
          >
            {/* Image Content */}
            {showImage && (
              <div 
                className="relative cursor-pointer overflow-hidden max-w-sm"
                onClick={handleMediaClick}
              >
                <AnimatePresence>
                  {isImageLoading && (
                    <motion.div 
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10"
                    >
                      <Loader2 className="animate-spin text-sky-600" size={24} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <img 
                  src={mediaUrl!} 
                  alt="Shared media"
                  loading="lazy"
                  onLoad={() => setIsImageLoading(false)}
                  className={`w-full h-auto aspect-video object-cover transition-transform duration-500 hover:scale-105 ${isImageLoading ? 'blur-lg' : 'blur-0'}`}
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                  <div className="bg-white/20 backdrop-blur-md p-3 rounded-full text-white">
                    <Maximize2 size={24} />
                  </div>
                </div>
              </div>
            )}

            {/* File Content */}
            {showFile && (
              <div className={`p-1 ${isMe ? 'bg-sky-700/30' : 'bg-gray-50'}`}>
                <a 
                  href={mediaUrl!} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex items-center gap-4 p-4 min-w-[240px] rounded-xl hover:bg-black/5 transition-colors ${isMe ? 'text-white' : 'text-gray-800'}`}
                >
                  <div className={`p-3 rounded-xl ${isMe ? 'bg-white/20' : 'bg-sky-50 text-sky-600'}`}>
                    <FileIcon size={24} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-black truncate">{message.fileName || 'Document.pdf'}</p>
                    <p className={`text-[10px] font-bold opacity-60 uppercase tracking-widest mt-0.5`}>
                      {mediaUrl!.split('.').pop()?.toUpperCase() || 'FILE'}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${isMe ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                    <Download size={16} />
                  </div>
                </a>
              </div>
            )}

            {/* Text Content */}
            {(message.text && (!showImage || (showImage && message.text !== mediaUrl))) && (
              <div className={`p-3.5 sm:p-5 ${showImage ? 'pt-2' : ''}`}>
                <p className="text-sm sm:text-[15px] font-bold leading-relaxed whitespace-pre-wrap">
                  {showImage && message.text === mediaUrl ? '' : message.text}
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

            {hasMentions && (
              <div className={`px-4 pb-4 flex flex-wrap gap-1.5 ${showImage || showFile ? 'pt-0' : 'pt-0'}`}>
                {message.mentionedUserIds?.map(uid => (
                  <span key={uid} className={`text-[9px] px-2 py-0.5 rounded-full font-black ${isMe ? 'bg-white/20 text-white' : 'bg-sky-50 text-sky-600'}`}>
                    @{uid}
                  </span>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence>
            {isHovered && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className={`flex items-center gap-2 mt-2 px-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <button className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-sky-600 transition-colors">השב</button>
                <span className="text-gray-200">|</span>
                <button className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-sky-600 transition-colors">העתק</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[999] flex flex-col p-4 sm:p-10"
            dir="rtl"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <img src={message.senderAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(message.senderName)} className="w-10 h-10 rounded-full border-2 border-white/20" alt="" />
                <div>
                   <p className="text-white font-black">{message.senderName}</p>
                   <p className="text-white/40 text-[10px] font-bold uppercase">{message.timestamp?.seconds ? format(new Date(message.timestamp.seconds * 1000), 'PPPp', { locale: he }) : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={mediaUrl!} download className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">
                  <Download />
                </a>
                <button onClick={() => setShowLightbox(false)} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">
                  <Maximize2 />
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center overflow-hidden">
               <motion.img 
                 layoutId={`image-${message.id}`}
                 src={mediaUrl!} 
                 className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
               />
            </div>
            
            <div className="mt-6 text-center">
               <p className="text-white/80 text-sm font-bold bg-white/5 py-3 px-6 rounded-2xl inline-block max-w-lg">
                 {message.text !== mediaUrl ? message.text : 'תמונה משותפת'}
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
