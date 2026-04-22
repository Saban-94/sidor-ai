import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NoaChat } from '../components/NoaChat';
import { 
  getPrivateChatHistory, 
  saveMessage, 
  askNoaPersonalized 
} from '../services/auraService';
import { Truck, ChevronRight, User } from 'lucide-react';

export const UserApp = () => {
  const { userKey } = useParams<{ userKey: string }>();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // זיהוי שם התצוגה לפי ה-Key
  const displayNames: Record<string, string> = {
    harel: 'הראל אידלסון (בוס)',
    vered: 'ורד אידלסון',
    oren: 'אורן (חצר החרש)',
    netanel: 'נתנאל רבינוביץ',
    itzik: 'איציק זהבי'
  };

  const userName = displayNames[userKey || ''] || userKey;

  useEffect(() => {
    const initApp = async () => {
      if (!userKey) return;
      try {
        const chatHistory = await getPrivateChatHistory(userKey);
        setHistory(chatHistory);
      } catch (error) {
        console.error("Failed to load history:", error);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, [userKey]);

  const handleSend = async (text: string) => {
    if (!userKey) return;

    // 1. שמירה מקומית ועדכון UI מיידי
    const userMsg = { role: 'user', parts: [{ text }] };
    setHistory(prev => [...prev, userMsg]);
    
    try {
      // 2. שמירה ב-Database
      await saveMessage(userKey, 'user', text);
      
      // 3. קבלת תשובה מנועה (מוזרקת זהות)
      const responseText = await askNoaPersonalized(text, userKey, history);
      
      // 4. שמירת תשובת המודל ב-Database
      await saveMessage(userKey, 'model', responseText);
      
      // 5. עדכון UI עם תשובת המודל
      setHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
    } catch (error) {
      console.error("Chat error:", error);
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <Truck className="text-sky-600 animate-bounce mb-4" size={48} />
      <p className="font-bold text-gray-500">נועה מתחברת לזיכרון של {userName}...</p>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#efeae2] overflow-hidden" dir="rtl">
      {/* Header VIP */}
      <header className="bg-[#075e54] text-white p-4 shadow-lg flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
            <User size={24} />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-none">{userName}</h1>
            <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              מחובר לנועה AI
            </p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronRight size={24} />
        </button>
      </header>

      {/* חדר הצ'אט של נועה */}
      <div className="flex-1 relative overflow-hidden">
        <NoaChat 
          chatHistory={history} 
          onAction={handleSend} 
          userKey={userKey}
          chatScrollRef={chatScrollRef}
        />
      </div>

      {/* Footer מידע קטן */}
      <footer className="bg-white/80 backdrop-blur-sm p-1 text-center border-t border-gray-200">
        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
          SabanOS - Smart Logistics System
        </p>
      </footer>
    </div>
  );
};
