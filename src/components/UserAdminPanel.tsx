import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit2, 
  ExternalLink, 
  ShieldCheck, 
  Lock,
  Search,
  UserPlus,
  Phone,
  Mail,
  Briefcase,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

export const UserAdminPanel = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingMod, setIsAddingMod] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    role: '',
    avatarUrl: ''
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, 'user_magic_pages'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'user_magic_pages');
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1125') {
      setIsAuthenticated(true);
    } else {
      alert('סיסמה שגויה!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id.length !== 4) {
      alert('מזהה חייב להיות בן 4 ספרות!');
      return;
    }

    try {
      const userRef = doc(db, 'user_magic_pages', formData.id);
      await setDoc(userRef, {
        ...formData,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: editingUser ? editingUser.createdAt : serverTimestamp()
      }, { merge: true });

      alert(editingUser ? 'משתמש עודכן בהצלחה!' : 'משתמש נוצר בהצלחה!');
      setIsAddingMod(false);
      setEditingUser(null);
      setFormData({ id: '', name: '', phone: '', email: '', role: '', avatarUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `user_magic_pages/${formData.id}`);
      alert('שגיאה בשמירת המשתמש');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) return;
    try {
      await deleteDoc(doc(db, 'user_magic_pages', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `user_magic_pages/${id}`);
      alert('שגיאה במחיקת המשתמש');
    }
  };

  const copyLink = (id: string) => {
    const link = `https://sidor-ai-xi.vercel.app/user/${id}`;
    navigator.clipboard.writeText(link);
    alert('קישור הועתק ללוח!');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 text-center border-t-8 border-sky-600"
        >
          <div className="bg-sky-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={40} className="text-sky-600" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">ניהול משתמשים</h2>
          <p className="text-gray-500 mb-8 font-bold">הזן סיסמת מנהל כדי להמשיך</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <input 
              type="password"
              placeholder="סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-center text-xl font-bold focus:ring-2 focus:ring-sky-600 focus:bg-white transition-all outline-none"
              autoFocus
            />
            <button 
              type="submit"
              className="w-full bg-sky-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-sky-700 transition-all shadow-lg shadow-sky-600/20"
            >
              כניסה למערכת
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-10" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="bg-sky-600 p-4 rounded-3xl text-white shadow-xl shadow-sky-600/20">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tight italic">ניהול משתמשים VIP</h1>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">SabanOS Admin Core</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAddingMod(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-sky-600 transition-all shadow-xl"
          >
            <UserPlus size={20} />
            הוסף משתמש חדש
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(user => (
              <motion.div 
                key={user.id}
                layoutId={user.id}
                className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-all group"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <img src={user.avatarUrl || 'https://via.placeholder.com/150'} className="w-16 h-16 rounded-2xl object-cover border-2 border-sky-50 shadow-sm" alt="" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-xl leading-tight">{user.name}</h3>
                    <p className="text-sky-600 font-bold text-xs uppercase">{user.role}</p>
                    <p className="text-gray-400 font-mono text-[10px] mt-1 tracking-widest">#{user.id}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-bold">
                    <Phone size={14} className="text-sky-400" />
                    {user.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-bold">
                    <Mail size={14} className="text-sky-400" />
                    {user.email}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingUser(user);
                      setFormData(user);
                      setIsAddingMod(true);
                    }}
                    className="flex-1 bg-gray-50 text-gray-700 py-2 rounded-xl text-xs font-bold hover:bg-sky-50 hover:text-sky-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit2 size={14} /> ערוך
                  </button>
                  <button 
                    onClick={() => copyLink(user.id)}
                    className="flex-1 bg-gray-50 text-gray-700 py-2 rounded-xl text-xs font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center justify-center gap-2 relative group"
                  >
                    <Copy size={14} /> העתק קישור
                  </button>
                  <button 
                    onClick={() => handleDelete(user.id)}
                    className="p-2 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddingMod && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingMod(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-gray-900 italic">
                  {editingUser ? 'עריכת משתמש' : 'יצירת משתמש Vip חדש'}
                </h2>
                <button onClick={() => setIsAddingMod(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase mr-4 mb-2 block">מזהה 4 ספרות</label>
                    <input 
                      required
                      maxLength={4}
                      placeholder="לוג'ין (1001)"
                      value={formData.id}
                      onChange={e => setFormData({...formData, id: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-3 font-bold focus:ring-2 focus:ring-sky-600 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase mr-4 mb-2 block">שם מלא</label>
                    <input 
                      required
                      placeholder="שם המשתמש"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-3 font-bold focus:ring-2 focus:ring-sky-600 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mr-4 mb-2 block">תפקיד / הגדרה</label>
                  <input 
                    required
                    placeholder="מנהל אתר / לקוח VIP"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-3 font-bold focus:ring-2 focus:ring-sky-600 transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase mr-4 mb-2 block">טלפון</label>
                    <input 
                      required
                      placeholder="052-..."
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-3 font-bold focus:ring-2 focus:ring-sky-600 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase mr-4 mb-2 block">אימייל</label>
                    <input 
                      required
                      type="email"
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-3 font-bold focus:ring-2 focus:ring-sky-600 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mr-4 mb-2 block">קישור לתמונת פרופיל</label>
                  <div className="relative">
                    <ImageIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      placeholder="https://..."
                      value={formData.avatarUrl}
                      onChange={e => setFormData({...formData, avatarUrl: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-3 pr-12 font-bold focus:ring-2 focus:ring-sky-600 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-sky-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-sky-700 transition-all shadow-xl shadow-sky-600/20 flex items-center justify-center gap-3"
                  >
                    <CheckCircle2 size={24} />
                    שמור משתמש במערכת
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
