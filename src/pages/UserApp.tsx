import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, Paperclip, Camera, Mic, MoreVertical, 
  ChevronRight, Truck, User, CheckCheck, 
  Loader2, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import OneSignal from 'react-onesignal';
import { 
  getPrivateChatHistory, 
  saveMessage, 
  askNoaPersonalized, 
} from '../services/auraService';
import { uploadFileToDrive } from '../services/driveService';

const playNotificationSound = () => {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
  audio.play().catch(() => console.log("Audio play blocked"));
};

export const UserApp = () => {
  const { userKey } = useParams<{ userKey: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const profiles: Record<string, any> = {
    harel: { name: 'הראל אידלסון', avatar: 'https://i.postimg.cc/d3S0NJJZ/Screenshot-20250623-200646-Facebook.jpg', color: '#075e54', sub: 'בוס - מחובר' },
    vered: { name: 'ורד אידלסון', avatar: 'https://i.pravatar.cc/tCNbgXK3/Screenshot-20250623-200744-Tik-Tok.jpg', color: '#d63384', sub: 'שכר ותפעול - מחוברת' },
    oren: { name: 'אורן חצר', avatar: 'https://i.postimg.cc/tCNbgXK3/Screenshot-20250623-200744-Tik-Tok.jpg', color: '#128c7e', sub: 'מנהל חצר - מחובר' },
    netanel: { name: 'נתנאל צדיק', avatar: 'https://i.postimg.cc/d3S0NJJZ/Screenshot-20250623-200646-Facebook.jpg', color: '#34b7f1', sub: 'רכש - מחובר' },
    rami: { name: 'ראמי נשמה', avatar: 'https://i.postimg.cc/tCNbgXK3/Screenshot-20250623-200744-Tik-Tok.jpg', color: '#075e54', sub: 'סידור עבודה - מחובר' }
  };

  const currentProfile = profiles[userKey || 'rami'] || profiles.rami;

  // אתחול OneSignal עם ה-ID החדש שסיפקת
  useEffect(() => {
    OneSignal.init({
      appId: "546472ac-f9ab-4c6c-beb2-e41c72af9849",
      allowLocalhostAsSecureOrigin: true,
    }).then(() => {
      console.log("OneSignal Initialized");
    }).catch(err => {
      console.error("OneSignal Init Error:", err);
    });
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      if (!userKey) return;
      try {
        const history = await getPrivateChatHistory(userKey);
        setMessages(history.map(h => ({
          text: h.parts[0].text,
          sender: h.role === 'user' ? 'me' : 'noa',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })));
      } catch (err) {
        console.error("Load history error:", err);
      }
    };
    loadHistory();
  }, [userKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userText = inputText;
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setInputText('');
    setMessages(prev => [...prev, { text: userText, sender: 'me', time: currentTime }]);
    
    await saveMessage(userKey || 'rami', 'user', userText);
    setIsTyping(true);
    
    try {
      const response = await askNoaPersonalized(userText, userKey || 'rami', messages);
      setIsTyping(false);
      playNotificationSound();
      
      const noaText = typeof response === 'string' ? response : (response.text || "בוצע אחי.");
      setMessages(prev => [...prev, { text: noaText, sender: 'noa', time: currentTime }]);
      await saveMessage(userKey || 'rami', 'model', noaText);
    } catch (err) {
      setIsTyping(false);
      console.error("Chat error:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadFileToDrive(file);
      setInputText(`העליתי קובץ: ${file.name}, תסרקי ותעדכני אותי.`);
      setTimeout(() => handleSendMessage(), 500);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#e5ddd5] font-sans overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 text-white shadow-md z-20" style={{ backgroundColor: currentProfile.color }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-1 hover:bg-black/10 rounded-full">
            <ChevronRight size={24} />
          </button>
          <img src={currentProfile.avatar} alt="" className="w-10 h-10 rounded-full border border-white/20 object-cover" />
          <div className="flex flex-col">
            <span className="font-bold text-sm">{currentProfile.name}</span>
            <span className="text-[10px] opacity-80">{isTyping ? 'מקלידה...' : currentProfile.sub}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Camera size={20} className="opacity-80" />
          <MoreVertical size={20} className="opacity-80" />
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`flex ${msg.sender === 'me' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[85%] p-2 rounded-xl shadow-sm relative ${
                msg.sender === 'me' ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'
              }`}>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed pb-3">{msg.text}</p>
                <div className="absolute bottom-1 left-2 flex items-center gap-1">
                  <span className="text-[9px] text-gray-500">{msg.time}</span>
                  {msg.sender === 'me' && <CheckCheck size={12} className="text-blue-500" />}
                </div>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
              <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm flex gap-1 px-3 py-4">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Footer */}
      <footer className="p-2 bg-[#f0f2f5] flex items-center gap-2 z-20">
        <div className="flex-1 bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-sm">
          <Sparkles size={20} className="text-gray-400" />
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="הודעה..."
            className="flex-1 bg-transparent border-none outline-none text-sm py-1"
          />
          <label className="cursor-pointer text-gray-500 hover:text-sky-600 transition-colors">
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
        <button 
          onClick={() => handleSendMessage()}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md active:scale-90 transition-transform"
          style={{ backgroundColor: currentProfile.color }}
        >
          {inputText.trim() ? <Send size={20} /> : <Mic size={20} />}
        </button>
      </footer>
    </div>
  );
};
