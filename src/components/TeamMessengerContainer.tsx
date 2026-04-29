import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Paperclip, 
  AtSign, 
  ChevronLeft,
  Search,
  Bell,
  MoreVertical,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, TeamChatMessage } from '../types';
import { db, auth } from '../lib/firebase';
import { 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  limit, 
  where,
  getDocs,
  doc,
  setDoc
} from 'firebase/firestore';
import { MessageBubble } from './MessageBubble';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { uploadFileToDrive, getDirectDriveLink } from '../services/driveService';
import { Avatar } from './Avatar';
import { cleanupBadMediaUrls } from '../services/cleanupService';
import { useNotifications } from './NotificationProvider';
import { ChatInput } from './ChatInput';
import { ChatWindow } from './ChatWindow';
import { GasService } from '../services/gasService';

interface TeamMessengerContainerProps {
  currentUserProfile: UserProfile;
  fullScreen?: boolean;
  onClose?: () => void;
}

export const TeamMessengerContainer: React.FC<TeamMessengerContainerProps> = ({ 
  currentUserProfile, 
  fullScreen = false,
  onClose
}) => {
  const { playDing, playAlert } = useNotifications();
  const [isOpen, setIsOpen] = useState(fullScreen);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [lastSeenMsgTime, setLastSeenMsgTime] = useState<number>(() => {
    const saved = localStorage.getItem('lastSeenMsgTime');
    return saved ? parseInt(saved, 10) : Date.now();
  });
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Simulate progress for uploads
  useEffect(() => {
    let interval: any;
    if (isUploading) {
      setUploadProgress(10);
      interval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + (Math.random() * 8) : prev));
      }, 400);
    } else {
      if (uploadProgress > 0) {
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 1000);
      }
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isUploading]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fullScreen) setIsOpen(true);
  }, [fullScreen]);

  useEffect(() => {
    cleanupBadMediaUrls();
  }, []);

  useEffect(() => {
    // Fetch team members
    const unsubscribeMembers = onSnapshot(collection(db, 'user_magic_pages'), (snapshot) => {
      const members = snapshot.docs.map(doc => doc.data() as UserProfile);
      setTeamMembers(members);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, 'user_magic_pages');
      }
    });

    // Update last seen
    const intervalLastSeen = setInterval(async () => {
      if (currentUserProfile?.id && auth.currentUser) {
        try {
          await setDoc(doc(db, 'user_magic_pages', currentUserProfile.id), {
            lastSeen: serverTimestamp()
          }, { merge: true });
        } catch (err: any) {
          if (err.code !== 'permission-denied') {
            handleFirestoreError(err, OperationType.WRITE, `user_magic_pages/${currentUserProfile.id}`);
          }
        }
      }
    }, 60000);

    return () => {
      unsubscribeMembers();
      clearInterval(intervalLastSeen);
    };
  }, [currentUserProfile?.id]);

  useEffect(() => {
    const q = query(
      collection(db, 'office_messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamChatMessage));
      
      // Improved logic: Only play sound for messages added AFTER initial load
      if (messages.length > 0) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newMsg = change.doc.data() as TeamChatMessage;
            if (newMsg.senderId !== currentUserProfile.id) {
              if (newMsg.priority === 'urgent') {
                playAlert();
              } else {
                playDing();
              }
            }
          }
        });
      }
      
      setMessages(msgs);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, 'office_messages');
      }
    });

    return () => unsubscribe();
  }, [currentUserProfile?.id, messages.length]);

  const stopUrgentAudio = () => {
    if ((window as any)._urgentAudio) {
      (window as any)._urgentAudio.pause();
      delete (window as any)._urgentAudio;
    }
  };

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      stopUrgentAudio();
      // Use the timestamp of the latest message as the last seen mark
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.timestamp) {
        const mTime = lastMsg.timestamp.toDate ? lastMsg.timestamp.toDate().getTime() : new Date(lastMsg.timestamp).getTime();
        setLastSeenMsgTime(mTime);
        localStorage.setItem('lastSeenMsgTime', mTime.toString());
      } else {
        // Fallback to now if no timestamp yet
        const now = Date.now();
        setLastSeenMsgTime(now);
        localStorage.setItem('lastSeenMsgTime', now.toString());
      }
    }
  }, [isOpen, messages.length]);

  const handleSendMessage = async (text: string, priority: 'normal' | 'urgent') => {
    if (!text.trim() && !isUploading) return;

    try {
      const mentionedUserIds = teamMembers
        .filter(m => text.includes(`@${m.name}`) || text.includes(`@${m.id}`))
        .map(m => m.id);

      await addDoc(collection(db, 'office_messages'), {
        senderId: currentUserProfile.id,
        senderName: currentUserProfile.name,
        senderAvatar: currentUserProfile.avatarUrl,
        text,
        mentionedUserIds,
        type: 'text',
        priority,
        timestamp: serverTimestamp()
      });

      // Sync to BlackBox (Google Sheets)
      GasService.syncChat({
        senderId: currentUserProfile.id,
        senderName: currentUserProfile.name,
        text,
        priority,
        timestamp: new Date(),
        type: 'text'
      } as any);

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'office_messages');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
        const uploadResult = await uploadFileToDrive(file);
        
        if (!uploadResult?.fileId) {
          throw new Error("Upload failed: No fileId returned");
        }

        const isImg = file.type.startsWith('image/');
        
        await addDoc(collection(db, 'office_messages'), {
            senderId: currentUserProfile.id,
            senderName: currentUserProfile.name,
            senderAvatar: currentUserProfile.avatarUrl,
            text: isImg ? "שלח תמונה" : `קובץ: ${file.name}`,
            imageUrl: isImg ? getDirectDriveLink(uploadResult.fileId) : null,
            fileUrl: uploadResult.webViewLink || null,
            fileId: uploadResult.fileId,
            fileName: file.name,
            mimeType: file.type,
            type: isImg ? 'image' : 'file',
            priority: 'normal',
            timestamp: serverTimestamp()
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'office_messages');
    } finally {
        setIsUploading(false);
    }
  };

  const isOnline = (lastSeen: any) => {
    if (!lastSeen) return false;
    const now = new Date();
    const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    return (now.getTime() - lastSeenDate.getTime()) < 5 * 60 * 1000;
  };

  const unreadCount = messages.filter(m => {
    if (m.senderId === currentUserProfile.id) return false;
    if (!m.timestamp) return false;
    const mTime = m.timestamp.toDate ? m.timestamp.toDate().getTime() : new Date(m.timestamp).getTime();
    return mTime > lastSeenMsgTime;
  }).length;

  return (
    <div className={fullScreen ? "h-full w-full" : "fixed bottom-6 left-6 z-[200]"} dir="rtl">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={fullScreen ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={fullScreen ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
            className={`
              ${fullScreen 
                ? 'h-full w-full flex flex-col bg-white' 
                : 'mb-4 w-[350px] sm:w-[800px] h-[600px] bg-white/80 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 flex flex-col sm:flex-row'}
            `}
          >
            {/* Sidebar - Desktop Only Split View */}
            <div className={`
              ${fullScreen ? 'hidden' : 'w-full sm:w-1/3 bg-gray-50/50 border-l border-gray-200/50 flex flex-col'}
              ${selectedMember ? 'hidden sm:flex' : 'flex'}
            `}>
              <div className="p-6 border-b border-gray-200/50">
                <h3 className="font-black text-xl italic text-sky-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="text-sky-600" />
                  צ'אט צוות
                </h3>
                <div className="relative">
                   <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                   <input 
                     placeholder="חפש חבר צוות..."
                     className="w-full bg-white border border-gray-100 rounded-xl py-2 px-10 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-600/20 transition-all"
                   />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {teamMembers.map(member => (
                   <button 
                     key={member.id}
                     onClick={() => setSelectedMember(member)}
                     className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all ${selectedMember?.id === member.id ? 'bg-sky-600 text-white shadow-lg' : 'hover:bg-white'}`}
                   >
                     <div className="relative">
                        <Avatar src={member.avatarUrl} name={member.name} size="md" />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isOnline(member.lastSeen) ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                     </div>
                     <div className="text-right">
                        <p className="font-black text-sm">{member.name}</p>
                        <p className={`text-[10px] font-bold ${selectedMember?.id === member.id ? 'text-white/80' : 'text-gray-400'}`}>{member.role}</p>
                     </div>
                   </button>

                ))}
              </div>
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col bg-white/30 ${selectedMember || fullScreen ? 'flex' : 'hidden sm:flex'}`}>
              {(!selectedMember && !fullScreen) && (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center opacity-40">
                  <MessageSquare size={64} className="mb-4" />
                  <p className="font-black italic">בחר חבר צוות כדי להתחיל שיחה</p>
                </div>
              )}

              {(selectedMember || fullScreen) && (
                <>
                  <div className={`p-4 sm:p-6 bg-white/50 border-b border-gray-200/50 flex justify-between items-center backdrop-blur-md sticky top-0 z-10`}>
                    <div className="flex items-center gap-3">
                      {(onClose && fullScreen) ? (
                        <button 
                         onClick={onClose}
                         className="p-2 hover:bg-gray-100 rounded-xl ml-2"
                        >
                         <ChevronLeft />
                        </button>
                      ) : selectedMember && (
                        <button 
                         onClick={() => setSelectedMember(null)}
                         className="sm:hidden p-2 hover:bg-gray-100 rounded-xl ml-2"
                        >
                         <ChevronLeft />
                        </button>
                      )}
                      <div className="relative">
                        <Avatar 
                          src={selectedMember?.avatarUrl || currentUserProfile.avatarUrl} 
                          name={selectedMember?.name || currentUserProfile.name || 'Team'} 
                          size="md" 
                        />
                      </div>
                      <div>
                        <h4 className="font-black text-gray-900 leading-none">{selectedMember?.name || 'צ׳אט קבוצתי'}</h4>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                          {(selectedMember && isOnline(selectedMember.lastSeen)) ? 'פעיל כעת' : fullScreen ? 'הצוות מחובר' : 'لا מחובר'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-400"><Search size={18}/></button>
                       <button className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-400"><MoreVertical size={18}/></button>
                       {!fullScreen && <button onClick={() => setIsOpen(false)} className="p-2.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl sm:hidden"><X size={18}/></button>}
                    </div>
                  </div>

                  <ChatWindow 
                    messages={messages}
                    currentUserProfile={currentUserProfile}
                    teamMembers={teamMembers}
                    scrollRef={scrollRef}
                    recipientId={selectedMember?.id}
                  />

                  <ChatInput 
                    onSendMessage={handleSendMessage}
                    onFileUpload={handleFileUpload}
                    currentUserProfile={currentUserProfile}
                    teamMembers={teamMembers}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    recipientId={selectedMember?.id}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!fullScreen && (
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={messages.some(m => m.priority === 'urgent' && m.senderId !== currentUserProfile.id) ? { scale: [1, 1.1, 1] } : {}}
          transition={messages.some(m => m.priority === 'urgent' && m.senderId !== currentUserProfile.id) ? { repeat: Infinity, duration: 2 } : {}}
          onClick={() => setIsOpen(!isOpen)}
          className="bg-sky-600 text-white p-5 rounded-full shadow-2xl shadow-sky-600/30 flex items-center justify-center relative group"
        >
          <MessageSquare size={32} />
          <AnimatePresence>
            {!isOpen && unreadCount > 0 && (
               <motion.span 
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-4 border-white flex items-center justify-center text-[10px] font-black"
               >
                 {unreadCount}
               </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      )}
    </div>
  );
};
