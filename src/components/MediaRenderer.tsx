import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  File as FileIcon, 
  ExternalLink, 
  Eye, 
  Download,
  AlertCircle,
  FileSearch
} from 'lucide-react';
import { formatDriveThumbnailUrl, getDirectDriveLink } from '../services/driveService';

interface MediaRendererProps {
  fileId?: string;
  fileUrl?: string;
  imageUrl?: string;
  fileName?: string;
  mimeType?: string;
  isMe?: boolean;
  onOpen?: (url: string) => void;
}

export const MediaRenderer: React.FC<MediaRendererProps> = ({
  fileId,
  fileUrl,
  imageUrl,
  fileName = 'Document',
  mimeType,
  isMe = false,
  onOpen
}) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = mimeType?.startsWith('image/') || (!mimeType && imageUrl);

  const getMediaUrl = () => {
    if (fileId) {
      if (isImage) return formatDriveThumbnailUrl(fileId);
      return getDirectDriveLink(fileId);
    }
    return imageUrl || fileUrl || '';
  };

  const mediaUrl = getMediaUrl();
  const driveViewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : mediaUrl;

  const handleOpen = () => {
    if (onOpen) {
      onOpen(driveViewUrl);
    } else {
      window.open(driveViewUrl, '_blank');
    }
  };

  if (error) {
    return (
      <div className={`p-4 rounded-xl flex items-center gap-3 border ${
        isMe ? 'bg-white/10 border-white/20' : 'bg-red-50 border-red-100 text-red-600'
      }`}>
        <AlertCircle size={20} />
        <span className="text-xs font-bold">לא ניתן לטעון את המדיה</span>
      </div>
    );
  }

  // --- PDF Render ---
  if (isPdf) {
    return (
      <div className={`group relative p-4 rounded-2xl border transition-all ${
        isMe ? 'bg-sky-800/40 border-sky-700' : 'bg-white border-gray-100 shadow-sm'
      }`}>
        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3 rounded-xl ${isMe ? 'bg-white/20' : 'bg-sky-50 text-sky-600'}`}>
            <FileText size={24} />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className={`text-sm font-black truncate ${isMe ? 'text-white' : 'text-gray-900'}`}>{fileName}</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
              SabanOS Document • PDF
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleOpen}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
              isMe ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
            }`}
          >
            <Eye size={14} />
            צפייה במסמך
          </button>
          <button 
            onClick={handleOpen}
            className={`p-2.5 rounded-xl transition-all ${
              isMe ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>
    );
  }

  // --- Image Render ---
  if (isImage || (mediaUrl && !isPdf)) {
    return (
      <div className="relative group overflow-hidden rounded-2xl bg-gray-100 min-h-[100px] min-w-[200px]">
        <AnimatePresence>
          {loading && (
            <motion.div 
              key="loader"
              className="absolute inset-0 flex items-center justify-center bg-gray-50"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.img 
          src={mediaUrl}
          alt={fileName}
          onLoad={() => setLoading(false)}
          onError={() => setError(true)}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: loading ? 0 : 1, scale: loading ? 0.95 : 1 }}
          className="w-full h-auto cursor-pointer object-cover max-h-96"
          onClick={handleOpen}
        />

        {!loading && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 pointer-events-none">
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl text-white">
              <Eye size={24} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Generic File Render ---
  return (
    <div className={`p-4 rounded-xl flex items-center justify-between border ${
      isMe ? 'bg-sky-800/40 border-sky-700' : 'bg-gray-50 border-gray-100'
    }`}>
      <div className="flex items-center gap-3">
        <FileIcon size={20} className={isMe ? 'text-white' : 'text-gray-400'} />
        <span className={`text-xs font-bold truncate max-w-[150px] ${isMe ? 'text-white' : 'text-gray-700'}`}>{fileName}</span>
      </div>
      <button onClick={handleOpen} className={isMe ? 'text-white' : 'text-sky-600'}>
        <Download size={18} />
      </button>
    </div>
  );
};
