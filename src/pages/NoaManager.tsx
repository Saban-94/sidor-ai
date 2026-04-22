import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Plus, Calendar, CheckCircle2, Circle, 
  User, Bell, Search, Filter, MessageSquare,
  Sparkles, ListTodo, ChevronLeft, Pin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getPrivateChatHistory, 
  saveMessage, 
  askNoaPersonalized 
} from '../services/auraService';

// טיפוס למשימה אישית
interface PersonalTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
  source?: string; // מאיפה נועה הקריצה את המשימה (למשל: וואטסאפ רכש)
}

export const NoaManager = () => {
  const { userKey } = useParams<{ userKey: string }>();
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [isNoaThinking, setIsNoaThinking] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'insights'>('tasks');

  // הגדרות פרופיל (הזנה מוקדמת של הזיכרון)
  const profiles: Record<string, any> = {
    harel: { name: 'הראל - מנכ"ל', focus: 'ניהול על, ישיבות הנהלה, אשראי לקוחות' },
    vered: { name: 'ורד - תפעול', focus: 'שכר, גבייה, ספקים' },
    oren: { name: 'אורן - לוגיסטיקה', focus: 'חצר, מלאי, מלגזות, מכולות' },
    rami: { name: 'ראמי - הבוס', focus: 'סידור עבודה, תיאום נהגים, בקרה' }
  };

  const userProfile = profiles[userKey || 'rami'] || profiles.rami;

  // פונקציה ששואבת משימות מה"זיכרון" של נועה החדשה
  const syncWithNoa = async () => {
    setIsNoaThinking(true);
    // כאן נועה החדשה עוברת על נתוני הוואטסאפ (רכש/אורן) ומייצרת רשימת משימות
    // לצורך הדוגמה, הנה משימות שנועה "מסיקה" מהקבצים שלך:
    const mockTasks: PersonalTask[] = [
      { id: '1', title: 'בדיקת יתרת אשראי לקונטרופ', description: 'לקוח חסום, יתרה -3,672', status: 'pending', priority: 'high', source: 'סידור.docx' },
      { id: '2', title: 'תיאום טסט למלגזה', description: 'הראל שאל את אורן ב-1.3', status: 'pending', priority: 'medium', source: 'סידור+אורן.docx' },
      { id: '3', title: 'חישוב צמר סלעים (65 מטר)', description: 'משימה מנתנאל/ראמי', status: 'completed', priority: 'low', source: 'רכש.docx' }
    ];
    
    setTimeout(() => {
      setTasks(mockTasks);
      setIsNoaThinking(false);
    }, 1500);
  };

  useEffect(() => { syncWithNoa(); }, [userKey]);

  return (
    <div className="h-screen bg-[#f8fafc] flex flex-col font-sans" dir="rtl">
      {/* Header ממותג נועה-ניהול */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-lg">נועה - ניהול אישי</h1>
            <p className="text-xs text-gray-500">שלום, {userProfile.name}</p>
          </div>
        </div>
        <button onClick={syncWithNoa} className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${isNoaThinking ? 'animate-spin' : ''}`}>
          <Bell size={20} className="text-gray-600" />
        </button>
      </header>

      {/* לוח בקרה - "זיקית" לפי משתמש */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* כרטיס סטטוס חכם */}
        <div className="bg-gradient-to-l from-indigo-50 to-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
          <h2 className="text-sm font-semibold text-indigo-900 flex items-center gap-2 mb-2">
            <Pin size={16} /> תובנות מנועה החדשה
          </h2>
          <p className="text-xs text-indigo-700 leading-relaxed">
            מבוסס על "סידור+רכש": יש 3 הזמנות של עמית בית חלומותי שממתינות לאישור סופי מחר בבוקר. 
            {userKey === 'oren' && " אורן, שים לב לדיווח על נזילת שמן אצל חכמת."}
          </p>
        </div>

        {/* טאבים */}
        <div className="flex gap-2 p-1 bg-gray-200/50 rounded-lg">
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'tasks' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
          >
            משימות פתוחות ({tasks.length})
          </button>
          <button 
            onClick={() => setActiveTab('insights')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'insights' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
          >
            תזכורות אוויר
          </button>
        </div>

        {/* רשימת משימות */}
        <div className="space-y-3">
          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div 
                key={task.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4 hover:border-indigo-200 transition-all cursor-pointer"
              >
                <div className="mt-1">
                  {task.status === 'completed' ? <CheckCircle2 className="text-green-500" size={20} /> : <Circle className="text-gray-300" size={20} />}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold text-sm ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {task.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <MessageSquare size={10} /> {task.source}
                    </span>
                    {task.priority === 'high' && (
                      <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">דחוף</span>
                    )}
                  </div>
                </div>
                <ChevronLeft size={16} className="text-gray-300 self-center" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* כפתור הוספה צף */}
      <button className="absolute bottom-6 left-6 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-95 transition-all">
        <Plus size={28} />
      </button>
    </div>
  );
};
