import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Bell, 
  Tag, 
  Clock, 
  Calendar, 
  Music, 
  Play, 
  Square,
  AlertOctagon,
  CheckCircle2,
  ListTodo
} from 'lucide-react';
import { Reminder } from '../types';
import { format, parseISO } from 'date-fns';

interface ReminderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Partial<Reminder>) => Promise<void>;
  initialData?: Reminder | null;
}

const RINGTONES = [
  { id: 'classic', name: 'קלאסי', url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' },
  { id: 'alert', name: 'התראה חדה', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
  { id: 'urgent', name: 'דחוף מאוד', url: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3' },
  { id: 'digital', name: 'דיגיטלי', url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' },
];

export const ReminderForm: React.FC<ReminderFormProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueTime, setDueTime] = useState(format(new Date(), 'HH:mm'));
  const [reminderTime, setReminderTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [priority, setPriority] = useState<'low' | 'high' | 'urgent' | 'critical'>('low');
  const [ringtone, setRingtone] = useState<string>('classic');
  const [isNagging, setIsNagging] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [testAudio, setTestAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setDueDate(initialData.dueDate);
      setDueTime(initialData.dueTime);
      if (initialData.reminderTime) {
        setReminderTime(format(parseISO(initialData.reminderTime), "yyyy-MM-dd'T'HH:mm"));
      }
      setPriority(initialData.priority);
      setRingtone(initialData.ringtone);
      setIsNagging(initialData.isNagging);
    } else {
      setTitle('');
      setDescription('');
      const now = new Date();
      setDueDate(format(now, 'yyyy-MM-dd'));
      setDueTime(format(now, 'HH:mm'));
      setReminderTime(format(now, "yyyy-MM-dd'T'HH:mm"));
      setPriority('low');
      setRingtone('classic');
      setIsNagging(false);
    }
  }, [initialData, isOpen]);

  const handleTestSound = () => {
    if (isPlaying && testAudio) {
      testAudio.pause();
      setIsPlaying(false);
      return;
    }

    const sound = RINGTONES.find(r => r.id === ringtone) || RINGTONES[0];
    const audio = new Audio(sound.url);
    audio.play();
    setTestAudio(audio);
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        title,
        description,
        dueDate,
        dueTime,
        reminderTime: new Date(reminderTime).toISOString(),
        priority,
        ringtone,
        isNagging,
        status: 'active',
        isCompleted: false,
        snoozeCount: 0
      });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100]"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="fixed inset-0 m-auto w-full max-w-lg h-fit bg-white rounded-[2.5rem] shadow-2xl z-[110] overflow-hidden"
            dir="rtl"
          >
            <div className="bg-sky-600 p-8 text-white relative">
              <button 
                onClick={onClose}
                className="absolute top-6 left-6 p-2 hover:bg-white/10 rounded-full transition-all"
              >
                <X size={24} />
              </button>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl">
                  <ListTodo size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter">
                    {initialData ? 'עריכת תזכורת' : 'תזכורת חדשה'}
                  </h2>
                  <p className="text-sky-100/80 text-xs font-bold uppercase tracking-widest mt-1">SabanOS Task Manager</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <Tag className="absolute right-4 top-4 text-sky-600 group-focus-within:scale-110 transition-transform" size={18} />
                  <input 
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="כותרת התזכורת..."
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-sky-600 focus:bg-white rounded-2xl px-12 py-4 text-sm font-bold outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase mr-4">תאריך יעד</label>
                    <div className="relative">
                      <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        className="w-full bg-gray-50 rounded-2xl px-12 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase mr-4">שעת יעד</label>
                    <div className="relative">
                      <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="time"
                        value={dueTime}
                        onChange={e => setDueTime(e.target.value)}
                        className="w-full bg-gray-50 rounded-2xl px-12 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase mr-4 underline decoration-sky-600">זמן התראה קריטי</label>
                  <input 
                    type="datetime-local"
                    value={reminderTime}
                    onChange={e => setReminderTime(e.target.value)}
                    className="w-full bg-sky-50 rounded-2xl px-6 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer text-sky-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase mr-4">עדיפות</label>
                    <select 
                      value={priority}
                      onChange={e => setPriority(e.target.value as any)}
                      className="w-full bg-gray-50 rounded-2xl px-6 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"
                    >
                      <option value="low">נמוכה</option>
                      <option value="high">גבוהה</option>
                      <option value="urgent">דחופה</option>
                      <option value="critical">🆘 קריטית</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase mr-4">צליל התראה</label>
                    <div className="flex gap-2">
                      <select 
                        value={ringtone}
                        onChange={e => setRingtone(e.target.value)}
                        className="flex-1 bg-gray-50 rounded-2xl px-6 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"
                      >
                        {RINGTONES.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <button 
                        type="button"
                        onClick={handleTestSound}
                        className="p-3 bg-sky-100 text-sky-600 rounded-2xl hover:bg-sky-200 transition-all"
                      >
                        {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-[1.5rem]">
                <div className={`p-2 rounded-xl ${isNagging ? 'bg-sky-600 text-white' : 'bg-white text-gray-400 shadow-sm'}`}>
                  <Bell size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-black text-gray-800">מצב נדנוד פעיל</h4>
                  <p className="text-[10px] text-gray-500 font-bold">המערכת תתריע כל 5 דקות עד לביצוע</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsNagging(!isNagging)}
                  className={`w-12 h-6 rounded-full relative transition-all ${isNagging ? 'bg-sky-600' : 'bg-gray-300'}`}
                >
                  <motion.div 
                    animate={{ x: isNagging ? -26 : -2 }}
                    className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-lg hover:bg-sky-600 transition-all shadow-xl shadow-sky-600/10 flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />}
                {initialData ? 'שמור שינויים' : 'צור תזכורת'}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={`animate-spin h-6 w-6 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
