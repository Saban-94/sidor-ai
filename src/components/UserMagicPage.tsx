import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, 
  Phone, 
  Mail, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Clock,
  Navigation,
  ExternalLink,
  ChevronLeft,
  X,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, TeamChatMessage } from '../types';
import { MobileWrapper } from './MobileWrapper';
import { Avatar } from './Avatar';
import { TeamMessenger } from './TeamMessenger';
import { db } from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  setDoc,
  limit 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { GasService } from '../services/gasService';

// --- Main Page ---
export const UserMagicPage = () => {
  const { id } = useParams();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'user_magic_pages', id), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id, ...docSnap.data() } as UserProfile;
        setUserProfile(data);
        // Log access to BlackBox via GAS
        GasService.push('logMagicAccess', { userId: id, userName: data.name, magicAction: 'ACCESS' });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `user_magic_pages/${id}`);
    });

    // Heartbeat to stabilize real-time status
    const updateStatus = async () => {
      if (!id) return;
      try {
        const userRef = doc(db, 'user_magic_pages', id);
        // Use setDoc with merge:true to avoid "No document to update" errors
        await setDoc(userRef, {
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.warn("Status update skipped (document might not exist yet or permission denied):", id);
      }
    };

    // Run once on load and then every minute
    updateStatus();
    const interval = setInterval(updateStatus, 60000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-sky-600 mb-4" size={40} />
      <p className="text-gray-400 font-bold italic tracking-widest uppercase text-xs">טוען פרופיל קסם...</p>
    </div>
  );

  if (!userProfile) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
      <AlertCircle size={80} className="text-red-500 mb-6" />
      <h1 className="text-3xl font-black text-gray-900 mb-2">משתמש לא נמצא</h1>
      <p className="text-gray-500 font-bold mb-8">ודא שהקישור תקין או פנה למנהל המערכת</p>
      <button 
        onClick={() => window.location.href = '/'}
        className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold shadow-xl"
      >
        חזרה לדף הבית
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans" dir="rtl">
      <div className="w-full max-w-2xl mx-auto p-4 md:p-10 pb-32">
        {/* Header/Hero Section */}
        <div className="relative bg-white rounded-[3rem] shadow-xl overflow-hidden border border-sky-100 p-8 pt-16 mb-8 text-center">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-sky-600 to-blue-700" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-6">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-32 h-32 relative"
              >
                <Avatar 
                  src={userProfile.avatarUrl} 
                  name={userProfile.name} 
                  size="xl" 
                  className="w-32 h-32"
                />
              </motion.div>
              <div className="absolute bottom-1 right-1 w-8 h-8 bg-emerald-500 rounded-2xl border-4 border-white flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
              </div>
            </div>


            <h1 className="text-4xl font-black text-gray-900 tracking-tight italic mb-1">{userProfile.name}</h1>
            <div className="bg-sky-50 text-sky-600 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-6">
              {userProfile.role}
            </div>

            <div className="w-full grid grid-cols-2 gap-4">
              <a 
                href={`tel:${userProfile.phone}`}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-3xl border border-gray-100 hover:border-sky-600 transition-all group"
              >
                <div className="bg-white p-3 rounded-2xl shadow-sm mb-2 group-hover:bg-sky-600 group-hover:text-white transition-all">
                  <Phone size={24} />
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase">התקשר</span>
                <span className="text-sm font-bold text-gray-800">{userProfile.phone}</span>
              </a>
              <a 
                href={`mailto:${userProfile.email}`}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-3xl border border-gray-100 hover:border-sky-600 transition-all group"
              >
                <div className="bg-white p-3 rounded-2xl shadow-sm mb-2 group-hover:bg-sky-600 group-hover:text-white transition-all">
                  <Mail size={24} />
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase">מייל</span>
                <span className="text-sm font-bold text-gray-800 break-all">{userProfile.email}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Action Board */}
        <div className="space-y-4">
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl">
                <Clock size={24} />
              </div>
              <div>
                <h4 className="font-black text-gray-900 italic">סטטוס פעילות</h4>
                <p className="text-xs text-gray-400 font-bold">מחובר כרגע למערכת סבן</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-500 uppercase">Live Now</span>
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            </div>
          </div>

          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-gray-900 text-white rounded-[2rem] p-6 shadow-xl flex items-center justify-between hover:bg-sky-600 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-2xl group-hover:bg-white/20 transition-all">
                <Navigation size={24} />
              </div>
              <div className="text-right">
                <h4 className="font-black italic">כניסה למערכת SabanOS</h4>
                <p className="text-xs text-white/60 font-bold uppercase tracking-widest text-right">Operation Dashboard</p>
              </div>
            </div>
            <ChevronLeft size={24} className="group-hover:-translate-x-2 transition-transform" />
          </button>
        </div>

        {/* Messenger */}
        <TeamMessenger userProfile={userProfile} />
      </div>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-white/10 backdrop-blur-md border-t border-white/10 flex justify-center pointer-events-none">
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] italic">SabanOS Personal Identity Card - VIP Access</p>
      </footer>
    </div>
  );
};
