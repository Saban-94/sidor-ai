import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Paperclip, 
  AtSign, 
  ChevronLeft,
  Search,
  MoreVertical,
  Circle,
  Clock,
  Check,
  CheckCheck,
  Bell,
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
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { ChatInput } from './ChatInput';
import { ChatWindow } from './ChatWindow';
import { useNotifications } from './NotificationProvider';
import { Avatar } from './Avatar';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

interface SocialChatRoomProps {
  currentUserProfile: UserProfile;
  onClose?: () => void;
}

/**
 * SocialChatRoom - A high-end Glassmorphism chat experience for SabanOS.
 * Rami, this is the premium chat room with bi-directional sync and real-time social indicators.
 */
export const SocialChatRoom: React.FC<SocialChatRoomProps> = ({ 
  currentUserProfile, 
  onClose 
}) => {
  const { playDing } = useNotifications();
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Mark as Read & Reset Notifications for Rami
  useEffect(() => {
    if (currentUserProfile?.id) {
      const markAsRead = async () => {
        try {
          await updateDoc(doc(db, 'user_magic_pages', currentUserProfile.id), {
            hasUnread: false,
            lastReadChat: serverTimestamp()
          });
        } catch (err) {
          console.warn('Failed to reset notification status', err);
        }
      };
      markAsRead();
    }
  }, [currentUserProfile?.id]);

  // 2. Real-time Members & Status
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'user_magic_pages'), (snapshot) => {
      const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setTeamMembers(members);
    });
    return () => unsubscribe();
  }, []);

  // 3. Real-time Messages & Audio Logic
  useEffect(() => {
    const q = query(
      collection(db, 'office_messages'),
      orderBy('timestamp', 'asc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamChatMessage));
      
      // Notification Logic: Only if new messages arrive after initial load
      if (msgs.length > messages.length && messages.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== currentUserProfile.id) {
          playDing();
          // Update hasUnread for recipient if private, or for Rami/others if global
          // (Handled partially by logic below or by global state)
        }
      }
      
      setMessages(msgs);
      
      // Auto-Scroll
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 150);
    });

    return () => unsubscribe();
  }, [messages.length, currentUserProfile.id, playDing]);

  const handleSendMessage = async (text: string, priority: 'normal' | 'urgent') => {
    if (!text.trim() && !isUploading) return;

    try {
      await addDoc(collection(db, 'office_messages'), {
        senderId: currentUserProfile.id,
        senderName: currentUserProfile.name,
        senderAvatar: currentUserProfile.avatarUrl,
        text,
        type: 'text',
        priority,
        timestamp: serverTimestamp(),
        recipientId: selectedMember?.id || 'global'
      });

      // Update unread status for recipient
      if (selectedMember?.id) {
        await updateDoc(doc(db, 'user_magic_pages', selectedMember.id), {
          hasUnread: true
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'office_messages');
    }
  };

  const isOnline = (lastSeen: any) => {
    if (!lastSeen) return false;
    const now = new Date();
    const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    return (now.getTime() - lastSeenDate.getTime()) < 5 * 60 * 1000;
  };

  const filteredMembers = teamMembers.filter(m => 
    m.id !== currentUserProfile.id && 
    (m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-screen w-full bg-[#0f172a] text-slate-200 flex overflow-hidden font-sans select-none" dir="rtl">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Sidebar: User List */}
      <div className="w-80 md:w-96 border-l border-slate-800 bg-slate-900/60 backdrop-blur-2xl flex flex-col z-10">
        <div className="p-8 pb-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white mb-1">הצ'אט של Rami</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Circle size={8} className="fill-emerald-500 text-emerald-500 animate-pulse" />
                מערכת בשידור חי
              </p>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-400 transition-colors" size={20} />
            <input 
              type="text"
              placeholder="חפש חברים או תפקידים..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl py-4 pr-12 pl-4 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500/50 transition-all placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
          {/* Global Channel */}
          <button 
            onClick={() => setSelectedMember(null)}
            className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${!selectedMember ? 'bg-sky-600/20 border border-sky-400/30' : 'hover:bg-slate-800/40 border border-transparent'}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-600/20">
              <MessageSquare className="text-white" size={24} />
            </div>
            <div className="text-right">
              <p className={`font-black text-sm ${!selectedMember ? 'text-sky-300' : 'text-slate-200'}`}>הצ'אט הכללי</p>
              <p className="text-slate-500 text-[10px] font-bold">כל חברי הצוות</p>
            </div>
          </button>

          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">חברי צוות</p>
          </div>

          {filteredMembers.map(member => (
            <button 
              key={member.id}
              onClick={() => setSelectedMember(member)}
              className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all relative group ${selectedMember?.id === member.id ? 'bg-indigo-600/20 border border-indigo-400/30' : 'hover:bg-slate-800/40 border border-transparent'}`}
            >
              <div className="relative">
                <Avatar src={member.avatarUrl} name={member.name} size="md" className="rounded-2xl border-2 border-slate-700/50" />
                <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0f172a] ${isOnline(member.lastSeen) ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              </div>
              <div className="flex-1 text-right overflow-hidden">
                <div className="flex justify-between items-center mb-0.5">
                  <p className={`font-black text-sm truncate ${selectedMember?.id === member.id ? 'text-indigo-300' : 'text-slate-200'}`}>{member.name}</p>
                  {member.hasUnread && (
                    <div className="w-2.5 h-2.5 bg-sky-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.5)]" />
                  )}
                </div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider truncate">{member.role}</p>
              </div>
            </button>
          ))}
        </div>

        {/* User Profile Hook */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-4">
            <Avatar src={currentUserProfile.avatarUrl} name={currentUserProfile.name} size="md" className="rounded-2xl ring-2 ring-sky-500/20" />
            <div className="flex-1">
              <p className="font-black text-sm text-white">{currentUserProfile.name}</p>
              <p className="text-slate-500 text-[10px] font-bold">מחובר כעת</p>
            </div>
            {onClose && (
              <button onClick={onClose} className="p-2.5 hover:bg-slate-800 rounded-xl text-slate-400">
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900/20 relative">
        {/* Chat Header */}
        <div className="h-24 px-10 border-b border-slate-800/50 flex items-center justify-between backdrop-blur-xl bg-slate-900/40 sticky top-0 z-20">
          <div className="flex items-center gap-6">
            <div className="relative">
              {!selectedMember ? (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-sky-600/30">
                  <MessageSquare className="text-white" size={28} />
                </div>
              ) : (
                <Avatar src={selectedMember.avatarUrl} name={selectedMember.name} size="lg" className="rounded-2xl border-2 border-slate-700/50" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight leading-none mb-1.5">
                {selectedMember ? selectedMember.name : "הצ'אט הכללי"}
              </h2>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                  {selectedMember && isOnline(selectedMember.lastSeen) ? "מחובר כעת" : "פעיל בשידור חי"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button className="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-2xl text-slate-400 transition-all"><Bell size={20} /></button>
             <button className="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-2xl text-slate-400 transition-all"><MoreVertical size={20} /></button>
          </div>
        </div>

        {/* Messages Window */}
        <div className="flex-1 flex flex-col relative overflow-hidden group/window">
           <ChatWindow 
              messages={messages.filter(m => selectedMember ? (m.recipientId === selectedMember.id || (m.senderId === selectedMember.id && m.recipientId === currentUserProfile.id)) : (m.recipientId === 'global' || !m.recipientId))}
              currentUserProfile={currentUserProfile}
              teamMembers={teamMembers}
              scrollRef={scrollRef}
              recipientId={selectedMember?.id}
              variant="glass"
           />
        </div>

        {/* Input Area */}
        <div className="p-6 pb-10 bg-gradient-to-t from-slate-900 to-transparent">
          <div className="max-w-5xl mx-auto w-full">
            <ChatInput 
              onSendMessage={handleSendMessage}
              onFileUpload={handleFileUpload}
              currentUserProfile={currentUserProfile}
              teamMembers={teamMembers}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              recipientId={selectedMember?.id}
              variant="glass"
            />
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.1); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); }
      `}</style>
    </div>
  );
};
