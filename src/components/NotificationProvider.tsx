import React, { createContext, useContext, useCallback, useRef } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface NotificationContextType {
  playDing: () => void;
  playAlert: () => void;
  sendGlobalNotification: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'urgent') => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dingAudio = useRef<HTMLAudioElement | null>(null);
  const alertAudio = useRef<HTMLAudioElement | null>(null);

  // Initialize audio lazily on first user interaction or when calling play
  const initAudio = () => {
    if (!dingAudio.current) {
      dingAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'); // WhatsApp style ding
    }
    if (!alertAudio.current) {
      alertAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/950/950-preview.mp3'); // Urgent alert
    }
  };

  const playDing = useCallback(() => {
    initAudio();
    if (dingAudio.current) {
      dingAudio.current.currentTime = 0;
      dingAudio.current.play().catch(e => console.log('Audio play failed', e));
    }
  }, []);

  const playAlert = useCallback(() => {
    initAudio();
    if (alertAudio.current) {
      alertAudio.current.currentTime = 0;
      alertAudio.current.play().catch(e => console.log('Audio play failed', e));
    }
  }, []);

  const sendGlobalNotification = useCallback(async (title: string, message: string, type: 'info' | 'success' | 'warning' | 'urgent' = 'info') => {
    try {
      await addDoc(collection(db, 'system_notifications'), {
        title,
        message,
        type,
        timestamp: serverTimestamp(),
        read: false
      });
      
      if (type === 'urgent') {
        playAlert();
      } else {
        playDing();
      }
    } catch (error) {
      console.error('Failed to send global notification', error);
    }
  }, [playDing, playAlert]);

  return (
    <NotificationContext.Provider value={{ playDing, playAlert, sendGlobalNotification }}>
      <div onClick={() => initAudio()} className="contents">
        {children}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
