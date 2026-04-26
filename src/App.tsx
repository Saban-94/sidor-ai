/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText,
  Plus, 
  Search, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  LogOut, 
  MessageSquare, 
  Send,
  Calendar as CalendarIcon,
  Trash2,
  X,
  ChevronRight,
  ChevronLeft,
  Settings,
  MoreVertical,
  Bell,
  BellOff,
  Pencil,
  Users,
  LayoutList,
  CalendarDays,
  Table,
  Trello,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Package,
  Menu,
  FileUp,
  Paperclip,
  Loader2,
  ListTodo,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  format, 
  addDays, 
  subDays, 
  isSameDay, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  parseISO,
  differenceInMinutes,
  addMinutes
} from 'date-fns';
import { he } from 'date-fns/locale';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firebaseUtils';
import MorningReportSystem from './components/MorningReportSystem';
import { OrderCard, StatusBadge } from './components/OrderCard';
import { KanbanBoard } from './components/KanbanBoard';
import { highlightText, parseItems } from './lib/utils';
import { DriverList } from './components/DriverList';
import { DriverCard } from './components/DriverCard';
import { SearchSuggestions } from './components/SearchSuggestions';
import { NoaChat } from './components/NoaChat';
import { initOneSignal, sendOrderNotification } from './services/notificationService';
import { DeliveryImport } from './components/DeliveryImport';
import { InventoryManager } from './components/InventoryManager';
import OrderForm from './components/OrderForm';
import { Routes, Route, Navigate } from 'react-router-dom';
import TrackingPage from './components/TrackingPage';
import { RemindersSidebar } from './components/RemindersSidebar';
import { GlobalAlertBanner } from './components/GlobalAlertBanner';
import { ReminderForm } from './components/ReminderForm';
import { UserAdminPanel } from './components/UserAdminPanel';
import { UserMagicPage } from './components/UserMagicPage';
import { TeamMessengerContainer } from './components/TeamMessengerContainer';
import { SocialChatRoom } from './components/SocialChatRoom';
import { SmartChatContainer } from './components/SmartChatContainer';
import { NavigationMenu } from './components/NavigationMenu';
import { MobileWrapper } from './components/MobileWrapper';
import { Avatar } from './components/Avatar';
import { NotificationProvider, useNotifications } from './components/NotificationProvider';
import { 
  createOrder, 
  getOrderByTrackingId,
  updateOrder, 
  updateDriver,
  deleteOrder, 
  askNoa, 
  predictOrderEta,
  getPrivateChatHistory,
  createDriver,
  createCustomer,
  updateCustomer,
  getCustomerByNumber,
  createReminder,
  updateReminder,
  deleteReminder,
  syncInventoryOnDelivery
} from './services/auraService';
import { Order, Driver, Customer, Reminder, InventoryItem, UserProfile, TeamChatMessage } from './types';
import { useUserMemory } from './hooks/useUserMemory';
import { uploadFileToDrive, createCustomerFolderHierarchy } from './services/driveService';
import { notificationService } from './services/notificationService';

import { SyncService } from './services/syncService';

// --- Components ---

const SortIcon = ({ field, currentSort, direction }: { field: string, currentSort: string, direction: 'asc' | 'desc' }) => {
  if (currentSort !== field) return <ArrowUpDown size={12} className="inline mr-2 opacity-20" />;
  return direction === 'asc' ? <ArrowUp size={12} className="inline mr-2 text-sky-600" /> : <ArrowDown size={12} className="inline mr-2 text-sky-600" />;
};

const Header = ({ 
  user, 
  notificationsEnabled, 
  onToggleNotifications,
  onOpenDrawer,
  onInstallApp,
  onFileUpload,
  isUploading,
  onOpenReminders,
  onAddReminder,
  hasNaggingReminder,
  uploadProgress = 0
}: { 
  user: FirebaseUser, 
  notificationsEnabled: boolean, 
  onToggleNotifications: () => void,
  onOpenDrawer: () => void,
  onInstallApp: () => void | null,
  onFileUpload: (file: File) => void,
  isUploading?: boolean,
  onOpenReminders: () => void,
  onAddReminder: () => void,
  hasNaggingReminder?: boolean,
  uploadProgress?: number
}) => (
  <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-sky-100 sticky top-0 z-30 overflow-hidden">
    {uploadProgress > 0 && (
      <div className="absolute top-0 right-0 left-0 h-1 bg-sky-100">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${uploadProgress}%` }}
          className="h-full bg-sky-600 shadow-[0_0_10px_rgba(2,132,199,0.5)]"
        />
      </div>
    )}
    <div className="flex items-center gap-3">
      <button 
        onClick={onOpenDrawer}
        className="p-2 hover:bg-sky-50 rounded-xl text-gray-600 md:hidden"
      >
        <MoreVertical size={24} />
      </button>
      <div className="flex items-center gap-3">
        <div className="bg-sky-600/10 p-2 rounded-xl">
          <Truck className="text-sky-600" size={24} />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-lg font-bold text-gray-900 leading-tight tracking-tight">ח. סבן לוגיסטיקה</h1>
          <p className="text-[10px] text-gray-500 font-medium">בוקר טוב, {user.displayName?.split(' ')[0] || 'ראמי'}</p>
        </div>
      </div>
    </div>
    
    <div className="flex items-center gap-2">
      <button 
        onClick={onOpenReminders}
        className="p-2.5 rounded-xl bg-white text-sky-600 border border-sky-100 hover:bg-sky-50 relative"
        title="תזכורות"
      >
        <ListTodo size={20} />
        {hasNaggingReminder && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-ping" />
        )}
        {hasNaggingReminder && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
        )}
      </button>

      <button 
        onClick={onAddReminder}
        className="p-2.5 rounded-xl bg-gray-900 text-white hover:bg-sky-600 transition-all shadow-lg"
        title="הוסף תזכורת"
      >
        <Plus size={20} />
      </button>

      <label className={`p-2.5 rounded-xl transition-all border shadow-sm flex items-center gap-2 cursor-pointer ${
        isUploading ? 'bg-sky-50 border-sky-200' : 'bg-white text-sky-600 border-sky-100 hover:bg-sky-50'
      }`} title="העלאת מסמך לדרייב">
        {isUploading ? (
          <Loader2 size={20} className="animate-spin text-sky-600" />
        ) : (
          <FileUp size={20} />
        )}
        <span className="hidden lg:block text-xs font-bold">
          {isUploading ? 'מעלה מסמך...' : 'העלאת מסמך'}
        </span>
        <input 
          type="file" 
          accept="application/pdf" 
          className="hidden" 
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileUpload(file);
            e.target.value = '';
          }}
        />
      </label>

      {onInstallApp && (
        <button 
          onClick={onInstallApp}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-xl text-[10px] font-bold shadow-lg hover:scale-105 transition-all"
        >
          <Plus size={14} /> התקן אפליקציה
        </button>
      )}
      
      <button 
        onClick={onToggleNotifications}
        className={`p-2.5 rounded-xl transition-all border ${notificationsEnabled ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
        title={notificationsEnabled ? 'התראות פעילות' : 'הפעל התראות'}
      >
        {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
      </button>

      <div className="hidden md:flex flex-col items-end mr-2">
        <span className="text-sm font-semibold text-gray-800">{user.displayName}</span>
        <button onClick={logout} className="text-xs text-red-500 hover:text-red-600 transition-colors flex items-center gap-1">
          <LogOut size={12} /> התנתק
        </button>
      </div>
      <Avatar src={user.photoURL} name={user.displayName || user.email || ''} size="sm" />
    </div>
  </header>
);

const Drawer = ({ 
  isOpen, 
  onClose, 
  user, 
  viewMode, 
  setViewMode,
  installPrompt,
  onOpenReminders
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  user: FirebaseUser, 
  viewMode: string, 
  setViewMode: (v: any) => void,
  installPrompt: any,
  onOpenReminders: () => void
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60]"
        />
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[70] flex flex-col p-6 overflow-y-auto"
          dir="rtl"
        >
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3">
              <div className="bg-sky-600 p-2 rounded-xl text-white">
                <Truck size={20} />
              </div>
              <h2 className="text-xl font-bold italic">ח. סבן</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X size={24} className="text-gray-400" />
            </button>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-4 mb-6 px-2">
              <Avatar src={user.photoURL} name={user.displayName || user.email || ''} size="lg" />
              <div>
                <p className="font-bold text-gray-900 leading-none mb-1">{user.displayName}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{user.email}</p>
              </div>
            </div>
            {[
              { id: 'chat', label: 'דברו עם נועה (AI)', icon: MessageSquare },
              { id: 'chat_full', label: "חדר צ'אט חברתי (חדש!)", icon: Sparkles },
              { id: 'list', label: 'לוח הזמנות', icon: LayoutList },
              { id: 'kanban', label: 'לוח קנבן', icon: Trello },
              { id: 'calendar', label: 'סידור עבודה שבועי', icon: CalendarDays },
              { id: 'import', label: 'יבוא אקסל (Export.xls)', icon: FileSpreadsheet },
              { id: 'reports', label: 'דוח בוקר (ארכיון)', icon: FileText },
              { id: 'table', label: 'סטטוס מלאי', icon: Table },
              { id: 'admin_users', label: 'ניהול משתמשי VIP', icon: Users },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = viewMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'admin_users') {
                      window.location.href = '/admin/users';
                    } else {
                      setViewMode(item.id);
                    }
                    onClose();
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                    isActive 
                      ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 transform scale-[1.02]' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 3 : 2} />
                  <span className="font-bold">{item.label}</span>
                </button>
              );
            })}
            
            <button
              onClick={() => {
                onOpenReminders();
                onClose();
              }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-gray-600 hover:bg-gray-50"
            >
              <ListTodo size={20} />
              <span className="font-bold">תזכורות ומשימות</span>
            </button>
          </div>

          <div className="pt-8 border-t border-gray-100 mt-auto">
            {installPrompt && (
              <button 
                onClick={() => {
                  installPrompt.prompt();
                  onClose();
                }}
                className="w-full mb-4 flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-transform"
              >
                <Plus size={20} /> התקן כאפליקציה
              </button>
            )}
            
            <button 
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 text-red-500 font-bold p-4 hover:bg-red-50 rounded-2xl transition-colors"
            >
              <LogOut size={20} /> התנתק מהמערכת
            </button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
    <div className="bg-gray-100 p-6 rounded-full mb-4">
      <CalendarIcon className="text-gray-400" size={48} />
    </div>
    <h3 className="text-lg font-bold text-gray-800">אין הזמנות ליום הזה</h3>
    <p className="text-gray-500 mt-2 max-w-xs text-sm">הסידור ריק בינתיים. אפשר להוסיף הזמנה חדשה או לבקש מ-Aura לעזור.</p>
  </div>
);

// --- Main App ---

export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const { playDing, playAlert } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const [activeAlertReminder, setActiveAlertReminder] = useState<Reminder | null>(null);
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const loopAudioRef = useRef<HTMLAudioElement | null>(null);

  const RINGTONE_URLS: Record<string, string> = {
    classic: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
    alert: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
    urgent: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3',
    digital: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  };

  // Critical Notification Engine
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const now = new Date();
      const upcoming = reminders.find(r => {
        if (r.isCompleted || r.status === 'completed') return false;
        if (!r.reminderTime) return false;
        const rTime = parseISO(r.reminderTime);
        const diff = differenceInMinutes(rTime, now);
        return diff <= 5;
      });

      if (upcoming) {
        setActiveAlertReminder(upcoming);
        const rTime = parseISO(upcoming.reminderTime!);
        const isTime = differenceInMinutes(now, rTime) >= 0;

        if (isTime && !loopAudioRef.current) {
          const ringUrl = RINGTONE_URLS[upcoming.ringtone] || RINGTONE_URLS.classic;
          loopAudioRef.current = new Audio(ringUrl);
          loopAudioRef.current.loop = true;
          loopAudioRef.current.play().catch(e => console.log('Loop audio failed:', e));
          if (upcoming.priority === 'critical') setIsScreenShaking(true);
        }
      } else {
        if (loopAudioRef.current) {
          loopAudioRef.current.pause();
          loopAudioRef.current = null;
        }
        setIsScreenShaking(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, reminders]);

  const handleReminderAction = async (id: string) => {
    try {
      await updateReminder(id, { isCompleted: true, status: 'completed' });
      setActiveAlertReminder(null);
      if (loopAudioRef.current) {
        loopAudioRef.current.pause();
        loopAudioRef.current = null;
      }
      setIsScreenShaking(false);
      addToast('הושלם', 'התזכורת נסגרה בהצלחה ✅', 'success');
    } catch (error) {
      addToast('שגיאה', 'לא הצלחתי לעדכן את התזכורת', 'warning');
    }
  };

  const handleAlertSnooze = async (id: string) => {
    try {
      const reminder = reminders.find(r => r.id === id);
      if (!reminder || !reminder.reminderTime) return;
      const newTime = addMinutes(parseISO(reminder.reminderTime), 10).toISOString();
      await updateReminder(id, { reminderTime: newTime, status: 'snoozed' });
      setActiveAlertReminder(null);
      if (loopAudioRef.current) {
        loopAudioRef.current.pause();
        loopAudioRef.current = null;
      }
      setIsScreenShaking(false);
      addToast('סנוז', 'נתראה בעוד 10 דקות 🕒', 'info');
    } catch (error) {
      addToast('שגיאה', 'לא הצלחתי לדחות את התזכורת', 'warning');
    }
  };

  const hasNaggingReminder = reminders.some(r => {
    if (r.isCompleted || !r.isNagging) return false;
    try {
      const scheduledTime = parseISO(`${r.dueDate}T${r.dueTime}`);
      return differenceInMinutes(new Date(), scheduledTime) >= 0;
    } catch (e) {
      return false;
    }
  });

  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toasts, setToasts] = useState<any[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const [settings, setSettings] = useUserMemory(user?.uid, 'ui_settings', {
    viewMode: 'kanban' as any,
    statusFilter: 'all',
    driverFilter: 'all',
    warehouseFilter: 'all',
    sortBy: 'time',
    sortDirection: 'asc' as 'asc' | 'desc',
    groupByDriver: false,
    notificationsEnabled: false,
    isRangeMode: false
  });

  const viewMode = settings.viewMode;
  const setViewMode = (v: any) => setSettings({ viewMode: v });
  const statusFilter = settings.statusFilter;
  const setStatusFilter = (v: any) => setSettings({ statusFilter: v });
  const driverFilter = settings.driverFilter;
  const setDriverFilter = (v: any) => setSettings({ driverFilter: v });
  const warehouseFilter = settings.warehouseFilter;
  const setWarehouseFilter = (v: any) => setSettings({ warehouseFilter: v });
  const sortBy = settings.sortBy;
  const setSortBy = (v: any) => setSettings({ sortBy: v });
  const sortDirection = settings.sortDirection;
  const setSortDirection = (v: any) => setSettings({ sortDirection: v });
  const groupByDriver = settings.groupByDriver;
  const setGroupByDriver = (v: any) => setSettings({ groupByDriver: v });
  const notificationsEnabled = settings.notificationsEnabled;
  const setNotificationsEnabled = (v: any) => setSettings({ notificationsEnabled: v });
  const isRangeMode = settings.isRangeMode;
  const setIsRangeMode = (v: any) => setSettings({ isRangeMode: v });

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const handleDriveFileUpload = async (file: File, orderId?: string) => {
    addToast('העלאת קובץ', `מעלה את ${file.name} לדרייב...`, 'info');
    setIsUploadingDoc(true);
    try {
      const uploadResult = await uploadFileToDrive(file);
      const fileId = uploadResult?.fileId;
      if (!fileId) throw new Error("לא התקבל מזהה קובץ מהדרייב.");
      addToast('העלאה הצליחה', 'הקובץ נשמר בדרייב ✅', 'success');
      if (orderId) await updateOrder(orderId, { orderFormId: fileId });
    } catch (error: any) {
      addToast('שגיאת העלאה', `לא הצלחתי להעלות: ${error.message}`, 'warning');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: Order['status']) => {
    try {
      await updateOrder(id, { status: newStatus });
    } catch (error) {
      addToast('שגיאה', 'חלה שגיאה בעדכון הסטטוס.', 'warning');
    }
  };

  const handleRepeatOrder = async (order: Order) => {
    try {
      const newOrder: Partial<Order> = {
        customerName: order.customerName,
        destination: order.destination,
        items: order.items,
        warehouse: order.warehouse,
        driverId: order.driverId,
        date: format(new Date(), 'yyyy-MM-dd'),
        time: order.time,
        status: 'pending',
      };
      await createOrder(newOrder);
      addToast('הזמנה שוכפלה', `ההזמנה של ${order.customerName} שוכפלה.`, 'success');
    } catch (error) {
      addToast('שגיאה', 'לא הצלחתי לשכפל את ההזמנה.', 'warning');
    }
  };

  const handleCreateCustomer = async (name: string, phone: string, address: string) => {
    try {
      const customerId = `CUST-${phone.replace(/[^0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`;
      await createCustomer({
        customerNumber: customerId,
        name,
        phone,
        phoneNumber: phone,
        address,
        totalOrders: 1,
      });
      addToast('כרטיס לקוח', `כרטיס עבור ${name} נוצר בהצלחה! 📑`, 'success');
    } catch (error) {
      addToast('שגיאה', 'לא הצלחתי ליצור כרטיס לקוח.', 'warning');
    }
  };

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  useEffect(() => {
    initOneSignal();
    SyncService.initListeners();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'user_magic_pages'), where('email', '==', user.email));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setCurrentUserProfile({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UserProfile);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'orders'), orderBy('date', 'asc'), orderBy('time', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(docs);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'drivers'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Driver[];
      setDrivers(docs);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'reminders'), where('userId', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Reminder[];
      setReminders(docs);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[];
      setInventoryItems(docs);
    });
  }, [user]);

  const handleAuraAction = async (msg: string) => {
    if (!user) return;
    setChatHistory(prev => [...prev, { role: 'user', parts: [{ text: msg }] }]);
    try {
      const result = await askNoa(msg, chatHistory, user?.displayName || 'אורח');
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: result.text }] }]);
    } catch (e) {
      addToast('שגיאה', 'משהו השתבש בתקשורת עם נועה.', 'warning');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = viewMode === 'kanban' ? true : (statusFilter === 'all' || order.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div>טוען...</div>;

  return (
    <Routes>
      <Route path="/track/:id" element={<TrackingPage />} />
      <Route path="/admin/users" element={<UserAdminPanel />} />
      <Route path="/user/:id" element={<UserMagicPage />} />
      <Route path="*" element={
        !user ? (
          <div className="h-screen w-full flex items-center justify-center">
            <button onClick={loginWithGoogle} className="bg-sky-600 text-white px-8 py-3 rounded-full">כניסה עם Google</button>
          </div>
        ) : (
          <div className="flex h-screen overflow-hidden bg-gray-50" dir="rtl">
            <div className="hidden md:block h-full">
              <NavigationMenu user={user} viewMode={viewMode} setViewMode={setViewMode} onLogout={logout} />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              <AnimatePresence>
                {isDrawerOpen && (
                  <div className="fixed inset-0 z-[200] md:hidden">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDrawerOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-y-0 right-0 w-80 shadow-2xl">
                      <NavigationMenu user={user} viewMode={viewMode} setViewMode={setViewMode} onLogout={logout} isMobile onClose={() => setIsDrawerOpen(false)} />
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {viewMode === 'reports' ? (
                <MorningReportSystem onBack={() => setViewMode('list')} drivers={drivers} />
              ) : viewMode === 'chat' ? (
                <NoaChat chatHistory={chatHistory} chatScrollRef={chatScrollRef} onBack={() => setViewMode('list')} onAction={handleAuraAction} orders={orders} />
              ) : viewMode === 'chat_full' ? (
                currentUserProfile && <SmartChatContainer user={user} currentUserProfile={currentUserProfile} onNavigateToOrder={(id) => setViewMode('list')} onToggleSidebar={() => setIsDrawerOpen(true)} />
              ) : (
                <MobileWrapper viewMode={viewMode} setViewMode={setViewMode} onAddClick={() => setIsAddingOrder(true)} user={user}>
                  <motion.div className="flex-1 flex flex-col overflow-hidden h-full">
                    <Header user={user} notificationsEnabled={notificationsEnabled} onToggleNotifications={() => setNotificationsEnabled(!notificationsEnabled)} onOpenDrawer={() => setIsDrawerOpen(true)} onInstallApp={handleInstallClick} onFileUpload={handleDriveFileUpload} onOpenReminders={() => setIsRemindersOpen(true)} onAddReminder={() => setIsAddingReminder(true)} hasNaggingReminder={hasNaggingReminder} />
                    
                    <GlobalAlertBanner reminder={activeAlertReminder} onAction={handleReminderAction} onSnooze={handleAlertSnooze} onDismiss={() => setActiveAlertReminder(null)} />
                    
                    <RemindersSidebar isOpen={isRemindersOpen} onClose={() => setIsRemindersOpen(false)} reminders={reminders} onToggleComplete={() => {}} onDelete={() => {}} onSnooze={() => {}} />
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-8">
                      <div className="pb-20">
                        {viewMode === 'kanban' ? (
                          <KanbanBoard orders={filteredOrders} drivers={drivers} inventoryItems={inventoryItems} searchQuery={searchQuery} onOrderEdit={setEditingOrder} onOrderUpdateStatus={handleStatusUpdate} onOrderUpdateEta={() => {}} onOrderDelete={() => {}} onOrderRepeat={handleRepeatOrder} onOrderCreateCustomer={handleCreateCustomer} onAddToast={addToast} onUploadDoc={handleDriveFileUpload} />
                        ) : (
                          <div className="grid gap-4">
                            {filteredOrders.map(order => (
                              <OrderCard key={order.id} order={order} drivers={drivers} allOrders={orders} inventoryItems={inventoryItems} searchQuery={searchQuery} onEdit={setEditingOrder} onUpdateStatus={handleStatusUpdate} onUpdateEta={() => {}} onDelete={() => {}} onRepeat={handleRepeatOrder} onAddToast={addToast} onCreateCustomer={handleCreateCustomer} onUploadDoc={handleDriveFileUpload} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </MobileWrapper>
              )}

              <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
                <AnimatePresence>
                  {toasts.map(toast => (
                    <motion.div key={toast.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="pointer-events-auto bg-white shadow-xl rounded-2xl p-4 border border-sky-100">
                      <h4 className="font-bold">{toast.title}</h4>
                      <p className="text-sm">{toast.message}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )
      } />
    </Routes>
  );
}
