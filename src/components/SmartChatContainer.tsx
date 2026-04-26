import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  MoreVertical, 
  Search, 
  Smile, 
  CheckCheck, 
  Bell, 
  Truck, 
  Info, 
  ChevronRight, 
  Menu,
  Clock,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Plus,
  Users,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, TeamChatMessage, Order } from '../types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { notificationService } from '../services/notificationService';
import { Avatar } from './Avatar';
import { User } from 'firebase/auth';

interface SmartChatContainerProps {
  user: User;
  currentUserProfile: UserProfile;
  onNavigateToOrder?: (orderId: string) => void;
  onToggleSidebar?: () => void;
}

export const SmartChatContainer: React.FC<SmartChatContainerProps> = ({
  user,
  currentUserProfile,
  onNavigateToOrder,
  onToggleSidebar
}) => {
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [selectedThread, setSelectedThread] = useState<string>('global'); // 'global' or 'system'
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTypingTime = useRef<number>(0);

  // --- Real-time Messages ---
  useEffect(() => {
    const q = query(
      collection(db, 'office_messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamChatMessage));
      
      // Detection for incoming messages from others
      if (messages.length > 0 && msgs.length > messages.length) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== currentUserProfile.id) {
          notificationService.playIncomingSound();
          notificationService.showBrowserNotification(
            `הודעה חדשה מ-${lastMsg.senderName}`,
            lastMsg.text.length > 50 ? lastMsg.text.substring(0, 50) + '...' : lastMsg.text
          );
        }
      }
      
      setMessages(msgs);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [currentUserProfile.id, messages.length]);

  // --- Real-time Team Members ---
  useEffect(() => {
    const q = query(collection(db, 'user_magic_pages'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setTeamMembers(members);
    });
    return () => unsubscribe();
  }, []);

  // --- Order Change Detection (System Thread Generator) ---
  const [lastOrdersVersion, setLastOrdersVersion] = useState<Record<string, Order>>({});
  useEffect(() => {
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'modified') {
          const oldOrder = lastOrdersVersion[change.doc.id];
          const newOrder = { id: change.doc.id, ...change.doc.data() } as Order;
          
          if (oldOrder && (oldOrder.status !== newOrder.status || oldOrder.driverId !== newOrder.driverId)) {
            // Something significant changed! Post to system chat
            const statusLabels: Record<string, string> = {
              pending: 'ממתין',
              preparing: 'בהכנה',
              ready: 'מוכן',
              delivered: 'סופק',
              cancelled: 'בוטל'
            };
            
            const messageText = `📢 **עדכון מערכת: הזמנה #${newOrder.orderNumber || newOrder.id}**\n\n` +
              `הסטטוס השתנה מ-**${statusLabels[oldOrder.status] || oldOrder.status}** ל-**${statusLabels[newOrder.status] || newOrder.status}**.\n` +
              `לקוח: ${newOrder.customerName}\n` +
              `יעד: ${newOrder.destination}`;

            await addDoc(collection(db, 'office_messages'), {
              senderId: 'system_aura',
              senderName: 'Noaa AI',
              senderAvatar: 'https://cdn-icons-png.flaticon.com/512/4712/4712109.png',
              text: messageText,
              type: 'text',
              priority: 'normal',
              timestamp: serverTimestamp(),
              recipientId: 'system', // Specific system thread
              fileId: newOrder.id // Store orderId for "View Order" button link
            });
          }
          
          setLastOrdersVersion(prev => ({ ...prev, [change.doc.id]: newOrder }));
        } else if (change.type === 'added') {
          setLastOrdersVersion(prev => ({ ...prev, [change.doc.id]: { id: change.doc.id, ...change.doc.data() } as Order }));
        }
      });
    });
    return () => unsubscribe();
  }, [lastOrdersVersion]);

  // --- Zero-Unread System ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            markAsRead();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (scrollRef.current) observer.observe(scrollRef.current);
    
    const handleFocus = () => markAsRead();
    window.addEventListener('focus', handleFocus);

    return () => {
      observer.disconnect();
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedThread]);

  const markAsRead = async () => {
    if (currentUserProfile.id) {
      const userRef = doc(db, 'user_magic_pages', currentUserProfile.id);
      await updateDoc(userRef, {
        hasUnread: false,
        lastReadChat: serverTimestamp()
      });
      notificationService.updateTabBadge(0);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const tempMsg = newMessage;
    setNewMessage('');
    setShowEmojiPicker(false);

    try {
      await addDoc(collection(db, 'office_messages'), {
        senderId: currentUserProfile.id,
        senderName: currentUserProfile.name,
        senderAvatar: currentUserProfile.avatarUrl,
        text: tempMsg,
        type: 'text',
        priority: 'normal',
        timestamp: serverTimestamp(),
        recipientId: selectedThread === 'system' ? 'system' : 'global'
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      if (selectedThread === 'system') return m.recipientId === 'system';
      return m.recipientId !== 'system';
    });
  }, [messages, selectedThread]);

  const onEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const handleTyping = () => {
    const now = Date.now();
    if (now - lastTypingTime.current > 3000) {
      lastTypingTime.current = now;
      updateDoc(doc(db, 'user_magic_pages', currentUserProfile.id), {
        isTyping: true,
        lastTyped: serverTimestamp()
      });
      setTimeout(() => {
        updateDoc(doc(db, 'user_magic_pages', currentUserProfile.id), {
          isTyping: false
        });
      }, 5000);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-[#0a0a0a] text-slate-200 overflow-hidden font-sans" dir="rtl">
      {/* Sidebar - Contacts / Threads */}
      <div className="w-80 border-l border-slate-800/50 flex flex-col hidden md:flex bg-black/40 backdrop-blur-xl">
        <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
          <h2 className="text-xl font-black text-white italic tracking-tighter">Smart Chat</h2>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400">
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="relative mb-6">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="חיפוש בארכיון..." 
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 pr-10 text-xs font-bold outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          <div className="space-y-2">
            <p className="px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">ערוצים</p>
            <ContactItem 
              active={selectedThread === 'global'}
              onClick={() => setSelectedThread('global')}
              title="צוות סבן לוגיסטיקה"
              subtitle="הודעות כלליות לצוות"
              icon={<Users size={18} className="text-sky-400" />}
              unread={false}
            />
            <ContactItem 
              active={selectedThread === 'system'}
              onClick={() => setSelectedThread('system')}
              title="עדכוני מערכת (Aura)"
              subtitle="דיווחים אוטומטיים על הזמנות"
              icon={<Sparkles size={18} className="text-emerald-400" />}
              unread={false}
            />
          </div>

          <div className="space-y-1 mt-8">
            <p className="px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">חברי צוות מחוברים</p>
            {teamMembers.filter(m => m.id !== currentUserProfile.id).map(member => (
              <div 
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-900/60 transition-all group cursor-pointer border border-transparent hover:border-slate-800/50"
              >
                <div className="relative">
                  <Avatar src={member.avatarUrl} name={member.name} size="sm" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0a0a0a] shadow-sm" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{member.name}</p>
                  <p className="text-[10px] text-slate-500 font-bold truncate">מחובר כעת</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-gradient-to-br from-[#0a0a0a] to-[#121212]">
        
        {/* Chat Header */}
        <div className="h-[72px] bg-black/40 backdrop-blur-xl border-b border-slate-800/50 px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={onToggleSidebar} className="md:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-xl">
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center ring-2 ring-emerald-500/20">
                  {selectedThread === 'system' ? <Sparkles size={20} className="text-emerald-500" /> : <Truck size={20} className="text-sky-500" />}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0a0a] shadow-sm" />
              </div>
              <div>
                <h3 className="font-black text-white italic tracking-tight">
                  {selectedThread === 'system' ? 'עדכוני מערכת (Aura)' : 'צוות סבן לוגיסטיקה'}
                </h3>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">מחובר ומסינכרן</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 bg-slate-900 pr-3 pl-1 py-1 rounded-full border border-slate-800">
               <div className="flex -space-x-2 rtl:space-x-reverse">
                 {teamMembers.slice(0, 3).map(m => <Avatar key={m.id} src={m.avatarUrl} name={m.name} size="xs" className="ring-2 ring-slate-900" />)}
               </div>
               <span className="text-[10px] font-black text-slate-400 pr-2">+{teamMembers.length} צוות</span>
            </div>
            <button className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Message Container */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 scroll-smooth custom-scrollbar bg-[url('https://i.pinimg.com/originals/85/6e/f3/856ef382b6c16644482ec4564c7e63b6.jpg')] bg-repeat bg-[length:400px]"
          style={{ backgroundBlendMode: 'overlay', backgroundColor: 'rgba(10,10,10,0.95)' }}
        >
          {filteredMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-40">
              <div className="p-6 bg-slate-900/50 rounded-full mb-4">
                <MessageSquare size={48} className="text-slate-600" />
              </div>
              <p className="font-bold text-slate-500">הצא'ט נקי בינתיים...</p>
            </div>
          )}

          {filteredMessages.map((msg, idx) => {
            const isMe = msg.senderId === currentUserProfile.id;
            const isSystem = msg.senderId === 'system_aura';
            
            return (
              <motion.div 
                key={msg.id || idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex w-full mb-2 ${isMe ? 'justify-start ml-auto' : 'justify-end mr-auto'}`}
              >
                {!isMe && !isSystem && (
                  <div className="ml-3 self-end mb-1">
                    <Avatar src={msg.senderAvatar} name={msg.senderName} size="xs" />
                  </div>
                )}
                
                <div className={`relative max-w-[85%] sm:max-w-[70%] group`}>
                  {/* Sender Name (only for others in non-system threads) */}
                  {!isMe && !isSystem && (
                    <p className="text-[10px] font-black text-slate-500 mr-2 mb-1 uppercase tracking-widest">{msg.senderName}</p>
                  )}
                  
                  <div className={`
                    p-3.5 rounded-3xl shadow-xl border backdrop-blur-md transition-all
                    ${isMe 
                      ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-white/10 rounded-br-none' 
                      : isSystem
                        ? 'bg-slate-900/90 text-slate-200 border-sky-500/30 rounded-bl-none ring-1 ring-sky-500/20'
                        : 'bg-[#1e1e1e]/90 text-slate-200 border-slate-700/50 rounded-bl-none'
                    }
                  `}>
                    {/* System Icon */}
                    {isSystem && (
                      <div className="flex items-center gap-2 mb-2 text-sky-400 pb-2 border-b border-slate-800">
                        <AlertCircle size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">עדכון מ-Noaa</span>
                      </div>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed text-sm font-bold tracking-tight">
                      {msg.text}
                    </div>
                    
                    {/* System Action Button */}
                    {isSystem && msg.fileId && (
                      <button 
                        onClick={() => onNavigateToOrder?.(msg.fileId!)}
                        className="mt-4 w-full flex items-center justify-center gap-2 bg-sky-500/20 text-sky-400 py-2.5 rounded-xl border border-sky-500/30 hover:bg-sky-500 hover:text-white transition-all text-xs font-black shadow-lg"
                      >
                        <ExternalLink size={14} />
                        <span>לצפייה בהזמנה המלאה</span>
                      </button>
                    )}

                    <div className="flex items-center justify-end gap-1.5 mt-1.5 opacity-60">
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        {msg.timestamp ? (typeof msg.timestamp.toDate === 'function' ? format(msg.timestamp.toDate(), 'HH:mm') : format(new Date(), 'HH:mm')) : ''}
                      </span>
                      {isMe && <CheckCheck size={12} className="text-sky-300" />}
                    </div>
                  </div>

                  {/* Tails */}
                  <div className={`absolute bottom-0 w-4 h-4 overflow-hidden ${isMe ? '-left-2' : '-right-2'}`}>
                    <div className={`w-full h-full transform ${isMe ? 'bg-emerald-800 rotate-[-45deg]' : 'bg-[#1e1e1e] rotate-45deg'}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {/* Typing Indicator */}
          {teamMembers.some(m => m.isTyping) && (
            <div className="flex items-center gap-2 text-emerald-500 text-xs font-black animate-pulse bg-emerald-500/10 px-4 py-2 rounded-full w-fit">
              <Clock size={12} className="animate-spin" />
              <span>חבר צוות מקליד...</span>
            </div>
          )}
        </div>

        {/* Footer Input */}
        <div className="p-4 sm:p-6 bg-black/60 backdrop-blur-2xl border-t border-slate-800/50 sticky bottom-0">
          <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto flex items-end gap-3 sm:gap-4 relative">
            
            {/* Emoji Picker Anchor */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-3 rounded-2xl transition-all ${showEmojiPicker ? 'bg-emerald-500 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50'}`}
              >
                <Smile size={24} />
              </button>
              
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    className="absolute bottom-20 right-0 z-50 shadow-2xl"
                  >
                    <EmojiPicker 
                      onEmojiClick={onEmojiClick}
                      theme={Theme.DARK}
                      searchPlaceholder="חפש אימוג'י..."
                      width={320}
                      height={400}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button type="button" className="p-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-500 rounded-2xl transition-all hover:border-emerald-500/50">
              <Paperclip size={24} />
            </button>

            <div className="flex-1 relative">
              <textarea 
                rows={1}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="הקלד הודעה לצוות..."
                className="w-full bg-slate-900/60 border border-slate-800/50 rounded-3xl py-3.5 px-6 pt-4 text-sm font-bold text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all resize-none max-h-32 placeholder:text-slate-600 font-black h-[54px]"
              />
            </div>

            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className={`p-3.5 rounded-2xl shadow-xl transition-all transform active:scale-95 ${
                newMessage.trim() 
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20' 
                  : 'bg-slate-800 text-slate-600 border border-slate-700'
              }`}
            >
              <Send size={24} className={newMessage.trim() ? "translate-x-0.5" : ""} />
            </button>
          </form>
          
          <div className="mt-4 flex items-center justify-center gap-1.5 opacity-30">
            <Info size={10} className="text-slate-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">כל ההודעות מוצפנות ומסונכרנות ב-SabanOS Real-time Pipeline</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ContactItemProps {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  unread?: boolean;
}

const ContactItem: React.FC<ContactItemProps> = ({ 
  active, 
  onClick, 
  title, 
  subtitle, 
  icon,
  unread 
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative overflow-hidden group ${
      active 
        ? 'bg-slate-900 border border-emerald-500/30 text-white shadow-xl shadow-black/40' 
        : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200 border border-transparent'
    }`}
  >
    <div className={`p-2.5 rounded-xl transition-all ${active ? 'bg-emerald-500/10' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
      {icon}
    </div>
    <div className="flex-1 text-right overflow-hidden">
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <p className={`font-black text-xs truncate italic tracking-tighter ${active ? 'text-white' : 'text-slate-300'}`}>{title}</p>
        <span className="text-[9px] font-bold opacity-40">12:45</span>
      </div>
      <div className="flex items-center justify-between gap-1 overflow-hidden">
        <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">{subtitle}</p>
        {unread && (
          <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/40" />
        )}
      </div>
    </div>
    {active && (
      <div className="absolute right-0 top-1/4 bottom-1/4 w-1 bg-emerald-500 rounded-l-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
    )}
  </button>
);
