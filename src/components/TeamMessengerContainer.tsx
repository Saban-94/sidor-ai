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
  updateDoc
} from 'firebase/firestore';
import { MessageBubble } from './MessageBubble';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

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
  const [isOpen, setIsOpen] = useState(fullScreen);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPriorityUrgent, setIsPriorityUrgent] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const beepRef = useRef<HTMLAudioElement | null>(null);
  const dingRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (fullScreen) setIsOpen(true);
  }, [fullScreen]);

  useEffect(() => {
    beepRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    dingRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');

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
    const intervalLastSeen = setInterval(() => {
      if (currentUserProfile?.id && auth.currentUser) {
        updateDoc(doc(db, 'user_magic_pages', currentUserProfile.id), {
          lastSeen: serverTimestamp()
        }).catch(err => {
          if (err.code !== 'permission-denied') {
            handleFirestoreError(err, OperationType.UPDATE, `user_magic_pages/${currentUserProfile.id}`);
          }
        });
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
      
      if (msgs.length > messages.length && messages.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== currentUserProfile.id) {
          if (lastMsg.priority === 'urgent') {
            const urgentAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
            urgentAudio.loop = true;
            urgentAudio.play().catch(e => console.log('Audio failed', e));
            (window as any)._urgentAudio = urgentAudio;
          } else {
            dingRef.current?.play().catch(e => console.log('Audio failed', e));
          }
        }
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
    if (isOpen) {
      stopUrgentAudio();
    }
  }, [isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !isUploading) return;

    try {
      const mentionedUserIds = teamMembers
        .filter(m => newMessage.includes(`@${m.name}`) || newMessage.includes(`@${m.id}`))
        .map(m => m.id);

      await addDoc(collection(db, 'office_messages'), {
        senderId: currentUserProfile.id,
        senderName: currentUserProfile.name,
        senderAvatar: currentUserProfile.avatarUrl,
        text: newMessage,
        mentionedUserIds,
        type: 'text',
        priority: isPriorityUrgent ? 'urgent' : 'normal',
        timestamp: serverTimestamp()
      });
      setNewMessage('');
      setIsPriorityUrgent(false);
      setShowMentions(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'office_messages');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
        await new Promise(r => setTimeout(r, 1500));
        
        const isImg = file.type.startsWith('image/');
        const fakeUrl = isImg 
          ? "https://images.unsplash.com/photo-1586769852044-692d6e671c6e?w=800&auto=format&fit=crop&q=60"
          : "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
        
        await addDoc(collection(db, 'office_messages'), {
            senderId: currentUserProfile.id,
            senderName: currentUserProfile.name,
            senderAvatar: currentUserProfile.avatarUrl,
            text: isImg ? "שלח תמונה" : `קובץ: ${file.name}`,
            imageUrl: isImg ? fakeUrl : null,
            fileUrl: !isImg ? fakeUrl : null,
            fileName: file.name,
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
                        <img src={member.avatarUrl || 'https://via.placeholder.com/48'} className="w-12 h-12 rounded-xl object-cover border-2 border-white" alt="" />
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
                        <img src={selectedMember?.avatarUrl || currentUserProfile.avatarUrl || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-xl object-cover" alt="" />
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

                  <form onSubmit={handleSendMessage} className={`p-4 sm:p-6 bg-white border-t border-gray-100 flex flex-col gap-3 sm:gap-4 sticky bottom-0`}>
                    <div className="flex items-center gap-2">
                       <div className="relative flex-1">
                          <input 
                            value={newMessage}
                            onChange={e => {
                                setNewMessage(e.target.value);
                                if (e.target.value.endsWith('@')) setShowMentions(true);
                                else if (!e.target.value.includes('@')) setShowMentions(false);
                            }}
                            placeholder="כתוב הודעה לצוות..."
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 sm:p-4 pr-12 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-600/10 transition-all"
                          />
                          <button 
                            type="button"
                            onClick={() => setShowMentions(!showMentions)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-sky-600"
                          >
                             <AtSign size={18} />
                          </button>
                       </div>
                       <button 
                         type="submit"
                         className="bg-sky-600 text-white p-3 sm:p-4 rounded-2xl hover:bg-sky-700 transition-all shadow-xl shadow-sky-600/20"
                       >
                         <Send size={24} />
                       </button>
                    </div>

                    <div className="flex items-center gap-4">
                       <label className="flex items-center gap-2 cursor-pointer group">
                          <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-sky-100 transition-all text-gray-500 group-hover:text-sky-600">
                             <Paperclip size={16} />
                          </div>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">צרף קובץ</span>
                          <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                       </label>

                       <button 
                         type="button"
                         onClick={() => setIsPriorityUrgent(!isPriorityUrgent)}
                         className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${isPriorityUrgent ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600'}`}
                       >
                          <Bell size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">דחוף</span>
                       </button>

                       {isUploading && (
                          <div className="flex items-center gap-2 ml-auto text-sky-600 font-bold text-[10px] animate-pulse">
                             <Loader2 className="animate-spin" size={14} />
                             מעלה קובץ...
                          </div>
                       )}
                    </div>

                    <AnimatePresence>
                        {showMentions && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute bottom-32 right-6 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 overflow-hidden z-20"
                            >
                                <div className="p-2 border-b border-gray-50">
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
                                            className="w-full text-right p-2 hover:bg-sky-50 rounded-lg flex items-center gap-2 transition-all"
                                        >
                                            <img src={m.avatarUrl || 'https://via.placeholder.com/24'} className="w-6 h-6 rounded-lg object-cover" alt="" />
                                            <span className="text-xs font-bold text-gray-700">{m.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                  </form>
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
            {!isOpen && messages.length > 0 && (
               <motion.span 
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-4 border-white flex items-center justify-center text-[10px] font-black"
               >
                 {messages.length}
               </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      )}
    </div>
  );
};
