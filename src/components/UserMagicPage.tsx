import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Phone, 
  Mail, 
  MessageSquare, 
  ArrowRight,
  ShieldCheck,
  Globe
} from 'lucide-react';

const UserMagicPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // זה ה-ID בן 4 הספרות (למשל 1001)
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // אפקט לעדכון סטטוס Online בזמן אמת - מתוקן למניעת שגיאת No Document
  useEffect(() => {
    if (!id) return;

    // הגדרת רפרנס למסמך - וודא שהקולקציה תואמת לאדמין (user_magic_pages)
    const userDocRef = doc(db, 'user_magic_pages', id);

    const updateStatus = async () => {
      try {
        // שימוש ב-setDoc עם merge: true במקום updateDoc
        // זה מונע את השגיאה במידה והמסמך עוד לא נוצר באדמין
        await setDoc(userDocRef, {
          lastSeen: serverTimestamp(),
          status: 'online',
          // אנחנו מוסיפים את ה-id ליתר ביטחון אם המסמך נוצר עכשיו
          id: id 
        }, { merge: true });
      } catch (error) {
        // לוג נקי במקום קריסה של האפליקציה
        console.warn(`[SabanOS] שים לב: לא ניתן לעדכן סטטוס למשתמש ${id}. וודא שהמסמך קיים או שהרשאות ה-Firestore תקינות.`);
      }
    };

    // עדכון ראשוני
    updateStatus();

    // הגדרת אינטרוול לעדכון כל דקה
    const interval = setInterval(updateStatus, 60000);

    // ניקוי ביציאה מהדף
    return () => {
      clearInterval(interval);
      // עדכון אופציונלי לסטטוס offline ביציאה
      setDoc(userDocRef, { status: 'offline' }, { merge: true }).catch(() => {});
    };
  }, [id]);

  // האזנה לנתוני המשתמש בזמן אמת
  useEffect(() => {
    if (!id) return;

    const userDocRef = doc(db, 'user_magic_pages', id);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-sky-500 font-black italic text-2xl"
        >
          SabanOS Magic...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans" dir="rtl">
      {/* Header ברמה גבוהה */}
      <div className="max-w-lg mx-auto pt-8 pb-6 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-all">
          <ArrowRight size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Live Identity</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        {/* פרופיל Hero - Glassmorphism */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-b from-white/10 to-transparent p-8 rounded-[3rem] border border-white/10 overflow-hidden text-center backdrop-blur-xl"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent"></div>
          
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-[2.5rem] bg-sky-600 p-1">
              <img 
                src={userData?.avatarUrl || `https://ui-avatars.com/api/?name=${userData?.name}&background=0284c7&color=fff`} 
                alt={userData?.name}
                className="w-full h-full object-cover rounded-[2.3rem] shadow-2xl"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-slate-950 rounded-full"></div>
          </div>

          <h1 className="text-2xl font-black mb-1">{userData?.name || 'משתמש SabanOS'}</h1>
          <p className="text-sky-400 font-bold text-sm mb-6 uppercase tracking-widest">{userData?.role || 'צוות סידור'}</p>

          <div className="flex justify-center gap-4">
            <a href={`tel:${userData?.phone}`} className="p-4 bg-white/5 rounded-2xl hover:bg-sky-600 transition-all group">
              <Phone size={20} className="group-hover:scale-110 transition-transform" />
            </a>
            <a href={`mailto:${userData?.email}`} className="p-4 bg-white/5 rounded-2xl hover:bg-sky-600 transition-all group">
              <Mail size={20} className="group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </motion.div>

        {/* כרטיס סטטיסטיקה/מידע */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
            <ShieldCheck className="text-sky-500 mb-2" size={24} />
            <p className="text-[10px] font-black text-gray-500 uppercase">הרשאות</p>
            <p className="text-sm font-bold">גישת מנהל</p>
          </div>
          <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
            <Globe className="text-emerald-500 mb-2" size={24} />
            <p className="text-[10px] font-black text-gray-500 uppercase">מזהה מערכת</p>
            <p className="text-sm font-bold">#{id}</p>
          </div>
        </div>

        {/* כפתור צ'אט פנימי מהיר */}
        <button className="w-full py-5 bg-sky-600 rounded-[2rem] font-black shadow-xl shadow-sky-900/40 flex items-center justify-center gap-3 active:scale-95 transition-all">
          <MessageSquare size={20} />
          פתיחת צ'אט צוות
        </button>
      </div>
    </div>
  );
};

export default UserMagicPage;
