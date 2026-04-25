import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, TeamChatMessage } from '../types';
import { db } from '../lib/firebase';
import { 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  limit 
} from 'firebase/firestore';

export const TeamMessenger = ({ userProfile }: { userProfile: UserProfile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const beepRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    beepRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    
    if (!userProfile?.id) return;

    const q = query(
      collection(db, 'internal_team_chats'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamChatMessage));
      
      // Play sound for new message if not from self
      if (msgs.length > messages.length && messages.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== userProfile.id) {
          beepRef.current?.play().catch(e => console.log('Audio failed', e));
        }
      }
      
      setMessages(msgs);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [userProfile?.id, messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userProfile?.id) return;

    try {
      await addDoc(collection(db, 'internal_team_chats'), {
        senderId: userProfile.id,
        senderName: userProfile.name,
        text: newMessage,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-[200]" dir="rtl">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-[350px] sm:w-[400px] h-[500px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-sky-100 flex flex-col"
          >
            <div className="bg-sky-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="font-black italic">צ'אט צוות SabanOS</h3>
                  <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">מחובר כרגע: {userProfile?.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50"
            >
              {messages.map((msg, i) => {
                const isMe = msg.senderId === userProfile?.id;
                return (
                  <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}>
                    <span className="text-[9px] font-black text-gray-400 mb-1 px-2 uppercase">{msg.senderName}</span>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-bold shadow-sm ${
                      isMe 
                        ? 'bg-sky-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex gap-2">
              <input 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="הקלד הודעה לצוות..."
                className="flex-1 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-sky-600 transition-all outline-none"
              />
              <button 
                type="submit"
                className="bg-sky-600 text-white p-4 rounded-2xl hover:bg-sky-700 transition-all shadow-lg"
              >
                <Send size={20} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
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
               !
             </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};
