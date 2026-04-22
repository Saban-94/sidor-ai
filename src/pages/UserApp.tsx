// src/pages/UserApp.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { NoaChat } from '../components/NoaChat';
import { getPrivateChatHistory, saveMessage, askNoaPersonalized } from '../services/auraService';

export const UserApp = () => {
  const { userKey } = useParams(); // מקבל 'harel' או 'oren' מה-URL
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // טעינת זהות והיסטוריה בפתיחה
  useEffect(() => {
    const initApp = async () => {
      const chatHistory = await getPrivateChatHistory(userKey);
      setHistory(chatHistory);
      setLoading(false);
    };
    initApp();
  }, [userKey]);

  const handleSend = async (text: string) => {
    // 1. שמור ב-DB תחת המשתמש הספציפי
    await saveMessage(userKey, 'user', text);
    
    // 2. קבל תשובה מנועה האישית שלו
    const response = await askNoaPersonalized(text, userKey, history);
    
    // 3. שמור את תשובת נועה
    await saveMessage(userKey, 'model', response);
    
    // 4. עדכן UI
    setHistory(prev => [...prev, 
      { role: 'user', parts: [{ text }] },
      { role: 'model', parts: [{ text: response }] }
    ]);
  };

  if (loading) return <div className="p-10 text-center italic">נועה מתארגנת בשבילך...</div>;

  return (
    <div className="h-screen flex flex-col bg-[#efeae2]"> {/* צבע רקע וואטסאפ */}
      {/* Header מותאם אישית */}
      <header className="bg-[#075e54] text-white p-4 shadow-md flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          {userKey === 'harel' ? '👴' : '🏗️'}
        </div>
        <div>
          <h1 className="font-bold">נועה - {userKey}</h1>
          <p className="text-[10px] opacity-80">מחוברת | סידור ח.סבן</p>
        </div>
      </header>

      {/* חדר הצ'אט */}
      <div className="flex-1 overflow-hidden relative">
        <NoaChat 
          chatHistory={history} 
          onAction={handleSend} 
          userKey={userKey}
        />
      </div>
    </div>
  );
};
