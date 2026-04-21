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
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
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
  subMonths
} from 'date-fns';
import { he } from 'date-fns/locale';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
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
import { 
  createOrder, 
  updateOrder, 
  updateDriver,
  deleteOrder, 
  askNoa, 
  predictOrderEta,
  createDriver,
  createReminder,
  updateReminder,
  deleteReminder
} from './services/auraService';
import { Order, Driver, Customer, Reminder } from './types';
import { useUserMemory } from './hooks/useUserMemory';
import { uploadFileToDrive } from './services/driveService';

// --- Components ---
// פונקציית עזר לניקוי טקסט לדיבור (TTS)
const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') // הסרת אימוג'ים
    .replace(/\*\*|##|__|#|\*|`/g, '') // הסרת סימני Markdown
    .replace(/^\s*[\-\*+]\s+/gm, '') // הסרת סימני רשימות
    .replace(/\s+/g, ' ') // ניקוי רווחים כפולים
    .trim();
};
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
  onOpenReminders
}: { 
  user: FirebaseUser, 
  notificationsEnabled: boolean, 
  onToggleNotifications: () => void,
  onOpenDrawer: () => void,
  onInstallApp: () => void | null,
  onFileUpload: (file: File) => void,
  isUploading?: boolean,
  onOpenReminders: () => void
}) => (
  <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-sky-100 sticky top-0 z-30">
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
          <h1 className="text-lg font-bold text-gray-900 leading-tight tracking-tight">סידור ח.סבן </h1>
          <p className="text-[10px] text-gray-500 font-medium">בוקר טוב, {user.displayName?.split(' ')[0] || 'ראמי'} </p>
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
      <img src={user.photoURL || ''} alt="" className="w-9 h-9 rounded-full border-2 border-sky-50 shadow-sm" referrerPolicy="no-referrer" />
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
            {[
              { id: 'chat', label: 'דברו עם נועה (AI)', icon: MessageSquare },
              { id: 'list', label: 'לוח הזמנות', icon: LayoutList },
              { id: 'kanban', label: 'לוח קנבן', icon: Trello },
              { id: 'calendar', label: 'סידור עבודה שבועי', icon: CalendarDays },
              { id: 'import', label: 'יבוא אקסל (Export.xls)', icon: FileSpreadsheet },
              { id: 'reports', label: 'דוח בוקר (ארכיון)', icon: FileText },
              { id: 'table', label: 'סטטוס מלאי', icon: Table },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = viewMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setViewMode(item.id);
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
            
            <div className="flex items-center gap-4 mb-6 px-2">
              <img src={user.photoURL || ''} alt="" className="w-12 h-12 rounded-full border-2 border-sky-100" />
              <div>
                <p className="font-bold text-gray-900 leading-none mb-1">{user.displayName}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{user.email}</p>
              </div>
            </div>
            
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
    <p className="text-gray-500 mt-2 max-w-xs text-sm">הסידור ריק בינתיים 👩🏼. אפשר להוסיף הזמנה חדשה או לבקש מ-ראמי לעזור.</p>
  </div>
);

// Drawer and other UI components...

// Reminders Sidebar Component
const RemindersSidebar = ({ 
  isOpen, 
  onClose, 
  reminders,
  onToggleComplete,
  onDelete
}: { 
  isOpen: boolean, 
  onClose: () => void,
  reminders: Reminder[],
  onToggleComplete: (id: string, completed: boolean) => void,
  onDelete: (id: string) => void
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[80]"
        />
        <motion.div 
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-[90] flex flex-col p-6 overflow-y-auto"
          dir="rtl"
        >
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3">
              <div className="bg-sky-600 p-2 rounded-xl text-white">
                <ListTodo size={20} />
              </div>
              <h2 className="text-xl font-bold italic">תזכורות </h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X size={24} className="text-gray-400" />
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {reminders.length === 0 ? (
              <div className="text-center py-20">
                <Sparkles size={40} className="mx-auto text-sky-100 mb-4" />
                <p className="text-gray-400 font-bold">אין תזכורות לבינתיים . הכל מוכן!</p>
              </div>
            ) : (
              reminders.map((reminder) => (
                <div 
                  key={reminder.id}
                  className={`p-4 rounded-3xl border transition-all ${
                    reminder.isCompleted ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-sky-100 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <button 
                      onClick={() => onToggleComplete(reminder.id!, !reminder.isCompleted)}
                      className={`p-2 rounded-xl transition-all ${
                        reminder.isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-sky-50 hover:text-sky-600'
                      }`}
                    >
                      <CheckCircle size={18} />
                    </button>
                    <div className="flex-1 mr-3 text-right">
                      <h4 className={`font-bold text-sm ${reminder.isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {reminder.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={12} className="text-sky-400" />
                        <span className="text-[10px] font-bold text-gray-400">{reminder.dueDate} | {reminder.dueTime}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (window.confirm('למחוק את התזכורת ?')) onDelete(reminder.id!);
                      }}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {reminder.description && (
                    <p className="text-xs text-gray-500 mt-2 pr-11">{reminder.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  // --- User Memory Persistence ---
  const [settings, setSettings] = useUserMemory(user?.uid, 'ui_settings', {
    viewMode: 'kanban' as 'list' | 'calendar' | 'reports' | 'chat' | 'drivers' | 'kanban' | 'import',
    statusFilter: 'all',
    driverFilter: 'all',
    warehouseFilter: 'all',
    sortBy: 'time',
    sortDirection: 'asc' as 'asc' | 'desc',
    groupByDriver: false,
    notificationsEnabled: false,
    isRangeMode: false
  });

  const [draftOrder, setDraftOrder, clearDraftOrder] = useUserMemory(user?.uid, 'new_order_draft', {
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '',
    driverId: '',
    customerName: '',
    destination: '',
    items: '',
    orderNumber: '',
    warehouse: 'החרש'
  });

  // Backward compatibility aliases for existing code
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
  const isNotificationListenerReady = useRef(false);

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
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleDriveFileUpload = async (file: File, orderId?: string, documentType: 'orderForm' | 'deliveryNote' = 'orderForm') => {
    addToast('העלאת קובץ', `מעלה את ${file.name} לדרייב...`, 'info');
    setIsUploadingDoc(true);
    try {
      const uploadResult = await uploadFileToDrive(file);
      const fileId = uploadResult?.fileId;
      
      if (!fileId) {
        const errorMsg = uploadResult?.message || uploadResult?.error || "לא התקבל מזהה קובץ מהדרייב .";
        throw new Error(errorMsg);
      }
      
      addToast('העלאה הצליחה', 'הקובץ נשמר בתיקיית הראשית  ✅', 'success');
      
      if (orderId) {
        addToast('עדכון הזמנה', 'משייכת את המסמך להזמנה 👩🏼...', 'info');
        const updateField = documentType === 'orderForm' ? { orderFormId: fileId } : { deliveryNoteId: fileId };
        await updateOrder(orderId, updateField);
      }

      // Suggest to Noa to analyze the new file
      handleAuraAction(`העליתי עכשיו את הקובץ ${file.name} לדרייב. ${orderId ? `זה שייך להזמנה ${orderId}.` : ''} סרקי אותו ותגידי לי מה נסגר.`);
    } catch (error: any) {
      console.error("Upload error:", error);
      addToast('שגיאת העלאה', `לא הצלחתי להעלות: ${error.message}`, 'warning');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: Order['status']) => {
    try {
      await updateOrder(id, { status: newStatus });
      
      const order = orders.find(o => o.id === id);
      if (order) {
        const statusLabels: Record<string, string> = {
          pending: 'ממתין',
          preparing: 'בהכנה',
          ready: 'מוכן',
          delivered: 'סופק',
          cancelled: 'בוטל'
        };
        sendOrderNotification(
          'עדכון סטטוס ! 🔄', 
          `ההזמנה של ${order.customerName} עודכנה ל-${statusLabels[newStatus] || newStatus}`
        );
      }

      // Auto-predict ETA when status changes to 'preparing'
      if (newStatus === 'preparing') {
        const order = orders.find(o => o.id === id);
        if (order) {
          addToast('מחשבת צפי הגעה', `מעדכנת צפי ל-${order.customerName} נשמה ...`, 'info');
          const predictedEta = await predictOrderEta(order, orders.filter(o => o.status === 'delivered'));
          if (predictedEta) {
            await updateOrder(id, { eta: predictedEta });
            addToast('צפי עודכן אוטומטית', `צפי הגעה ל-${order.customerName}: ${predictedEta}`, 'success');
          }
        }
      }

      // Update driver metrics when delivered
      if (newStatus === 'delivered') {
        const order = orders.find(o => o.id === id);
        if (order && order.driverId && order.driverId !== 'self') {
          const driver = drivers.find(d => d.id === order.driverId);
          if (driver) {
            await updateDriver(driver.id, { 
              totalDeliveries: (driver.totalDeliveries || 0) + 1 
            });
          }
        }
      }
    } catch (error) {
      console.error(error);
      addToast('שגיאה', 'משהו השתבש בעדכון הסטטוס ', 'warning');
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
        orderNumber: order.orderNumber ? `${order.orderNumber}-RE` : '',
      };
      
      await createOrder(newOrder);
      addToast('הזמנה שוכפלה', `ההזמנה של ${order.customerName} שוכפלה להיום 👩🏼`, 'success');
      sendOrderNotification('הזמנה חוזרת 👩🏼 🔄', `שוכפלה הזמנה עבור ${order.customerName}`);
    } catch (error) {
      console.error(error);
      addToast('שגיאה', 'לא הצלחתי לשכפל את ההזמנה 👩🏼', 'warning');
    }
  };

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // --- Auth & Init ---
  useEffect(() => {
    initOneSignal();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // --- Background Notification Listener ---
  useEffect(() => {
    if (!user || !notificationsEnabled) {
      isNotificationListenerReady.current = false;
      return;
    }

    // Listen to all active/recent orders (from 2 days ago to forever)
    const recentDate = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'orders'),
      where('date', '>=', recentDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isNotificationListenerReady.current) {
        if (!snapshot.metadata.fromCache) {
          isNotificationListenerReady.current = true;
        }
        return;
      }

      snapshot.docChanges().forEach((change) => {
        // Skip local changes
        if (change.doc.metadata.hasPendingWrites) return;

        const order = change.doc.data() as Order;
        
        if (change.type === 'added') {
          const title = 'הזמנה חדשה ! 🚛';
          const msg = `${order.customerName} - ${order.items}`;
          addToast(title, msg, 'success');
          
          if (Notification.permission === 'granted') {
            new Notification(title, { body: msg });
          }
        }
        
        if (change.type === 'modified') {
          const oldData = change.oldIndex !== -1 ? null : null; // Snapshot changes don't easily provide previous fields without state tracking
          // We'll track previous status in a specialized hook/ref if we wanted perfection, 
          // but for now let's refine the message to be more specific.
          
          const title = 'עדכון סטטוס 👩🏼! 🔄';
          const statusLabels: Record<string, string> = {
            pending: 'ממתין',
            preparing: 'בהכנה',
            ready: 'מוכן',
            delivered: 'סופק',
            cancelled: 'בוטל'
          };
          const msg = `ההזמנה של ${order.customerName} עודכנה ל-${statusLabels[order.status] || order.status}`;
          
          addToast(title, msg, order.status === 'delivered' ? 'success' : 'info');
          
          if (Notification.permission === 'granted') {
            new Notification(title, { body: msg, icon: '/vite.svg' });
          }
        }
      });
    });

    return () => {
      unsubscribe();
      isNotificationListenerReady.current = false;
    };
  }, [user, notificationsEnabled]);

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      } else {
        alert('כדי לקבל התראות צריך לאשר אותן בדפדפן .');
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    let startStr, endStr;
    let actualIsRange = isRangeMode;

    if (viewMode === 'calendar') {
      startStr = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
      endStr = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');
      actualIsRange = true;
    } else {
      startStr = format(startDate, 'yyyy-MM-dd');
      endStr = format(endDate, 'yyyy-MM-dd');
    }
    
    let q;
    if (!actualIsRange) {
      q = query(
        collection(db, 'orders'),
        where('date', '==', startStr),
        orderBy('time', 'asc')
      );
    } else {
      q = query(
        collection(db, 'orders'),
        where('date', '>=', startStr),
        where('date', '<=', endStr),
        orderBy('date', 'asc'),
        orderBy('time', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(docs);
    });

    return () => unsubscribe();
  }, [user, startDate, endDate, isRangeMode, viewMode, calendarMonth]);

  // --- Fetch Drivers ---
  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'drivers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Seed default drivers if none exist
        const DEFAULT_DRIVERS = [
          { 
            id: 'hikmat', 
            name: 'חכמת (מנוף 🏗️)', 
            phone: '050-0000001', 
            vehicleType: 'crane', 
            plateNumber: '12-345-67', 
            vehicleModel: 'Volvo FM', 
            status: 'active',
            avatar: 'https://i.postimg.cc/d3S0NJJZ/Screenshot-20250623-200646-Facebook.jpg'
          },
          { 
            id: 'ali', 
            name: 'עלי (משאית 🚛)', 
            phone: '050-0000002', 
            vehicleType: 'truck', 
            plateNumber: '89-012-34', 
            vehicleModel: 'Scania R450', 
            status: 'active',
            avatar: 'https://i.postimg.cc/tCNbgXK3/Screenshot-20250623-200744-Tik-Tok.jpg'
          }
        ];
        
        const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
        for (const driverData of DEFAULT_DRIVERS) {
          const { id, ...data } = driverData;
          await setDoc(doc(db, 'drivers', id), {
            ...data,
            totalDeliveries: 0,
            onTimeRate: 100,
            rating: 5,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Driver[];
        setDrivers(docs);

        // One-time update for existing drivers missing avatars
        const driversMissingAvatars = docs.filter(d => (d.id === 'ali' || d.id === 'hikmat') && !d.avatar);
        if (driversMissingAvatars.length > 0) {
          const { updateDoc, doc } = await import('firebase/firestore');
          for (const d of driversMissingAvatars) {
             const avatarUrl = d.id === 'ali' 
               ? 'https://i.postimg.cc/tCNbgXK3/Screenshot-20250623-200744-Tik-Tok.jpg'
               : 'https://i.postimg.cc/d3S0NJJZ/Screenshot-20250623-200646-Facebook.jpg';
             await updateDoc(doc(db, 'drivers', d.id), { avatar: avatarUrl });
          }
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  // --- Fetch Reminders ---
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'reminders'),
      where('userId', '==', user.uid),
      orderBy('dueDate', 'asc'),
      orderBy('dueTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Reminder[];
      setReminders(docs);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // --- Aura AI Handlers ---
  const handleAuraAction = async (msg: string) => {
    const userMsg = { role: 'user', parts: [{ text: msg }] };
    setChatHistory(prev => [...prev, userMsg]);
    
    try {
      const result = await askNoa(msg, chatHistory);
      
      // Extract text parts carefully to avoid SDK warnings about non-text parts (function calls)
      const textResponse = result.candidates?.[0]?.content?.parts
        ?.filter((p: any) => p.text)
        ?.map((p: any) => p.text)
        .join('\n');

      const functionCalls = result.functionCalls;

      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'create_order') {
            const args = call.args as any;
            await createOrder(args);
            sendOrderNotification('הזמנה חדשה 👩🏼! 🚛', `${args.customerName} - ${args.items}`);
          } else if (call.name === 'update_order') {
            const { orderId, ...rest } = call.args as any;
            await updateOrder(orderId, rest);
          } else if (call.name === 'update_order_status') {
            const { orderId, status } = call.args as any;
            await handleStatusUpdate(orderId, status);
          } else if (call.name === 'delete_order_by_customer') {
            const { customerName } = call.args as any;
            const q = query(collection(db, 'orders'), where('customerName', '==', customerName));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await deleteOrder(d.id);
            }
          } else if (call.name === 'search_orders') {
            const { query: qStr } = call.args as any;
            setSearchQuery(qStr);
            setViewMode('list');
            addToast('חיפוש הזמנות', `מחפשת את "${qStr}" בלוח 👩🏼`, 'info');
          } else if (call.name === 'get_order_eta') {
            const { customerName, orderId } = call.args as any;
            let targetOrder = orders.find(o => 
              (orderId && o.id === orderId) || 
              (customerName && o.customerName.includes(customerName))
            );
            
            // If not in current view, try fetching from DB
            if (!targetOrder) {
              const q = query(collection(db, 'orders'), where('customerName', '>=', customerName), where('customerName', '<=', customerName + '\uf8ff'));
              const snap = await getDocs(q);
              if (!snap.empty) {
                targetOrder = { id: snap.docs[0].id, ...snap.docs[0].data() } as Order;
              }
            }

            if (targetOrder) {
              addToast('חיזוי הגעה', `מחשבת צפי הגעה ל-${targetOrder.customerName}...`, 'info');
              const eta = await predictOrderEta(targetOrder, orders);
              if (eta) {
                await updateOrder(targetOrder.id!, { eta });
                const etaMsg = { role: 'model', parts: [{ text: ` הצפי להגעה ליעד-${targetOrder.customerName} הוא בערך ב-${eta}.` }] };
                setChatHistory(prev => [...prev, etaMsg]);
                addToast('צפי עודכן', `הצפי ל-${targetOrder.customerName} הוא ${eta}`, 'success');
              } else {
                setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "ניסיתי לחשב צפי בשבילך , אבל לא הצלחתי להתחבר למפות כרגע." }] }]);
              }
            } else {
              setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: `לא מצאתי הזמנה עבור ${customerName} .` }] }]);
            }
          } else if (call.name === 'update_driver') {
            const { driverId, ...rest } = call.args as any;
            await updateDriver(driverId, rest);
            addToast('👩🏼עדכון נהג', `פרטי הנהג עודכנו בהצלחה תודה מנועה.`, 'success');
          } else if (call.name === 'search_drivers') {
            const { query: qStr } = call.args as any;
            setSearchQuery(qStr);
            setViewMode('drivers');
            addToast('חיפוש נהגים', `מחפשת נהגים בשם "${qStr}" 👩🏼`, 'info');
          }
        }
      }

      const auraResponse = { role: 'model', parts: [{ text: textResponse || "בוצע 👩🏼." }] };
      setChatHistory(prev => [...prev, auraResponse]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "משהו לא הסתדר , תנסה שוב." }] }]);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-sky-50/30 backdrop-blur-sm">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="text-sky-600"
      >
        <Truck size={40} />
      </motion.div>
    </div>
  );

  if (!user) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-6 relative overflow-hidden" dir="rtl">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-100/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/20 rounded-full blur-3xl animate-pulse" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <div className="bg-sky-600/10 p-6 rounded-3xl">
            <Truck className="text-sky-600" size={64} />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 text-center mb-2 tracking-tight">נועה - לוגיסטיקה חכמה</h1>
        <p className="text-center text-gray-500 mb-10 text-lg">המערכת המבצעית של ח. סבן חומרי בניין</p>
        
        <button 
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-sky-600 transition-all shadow-xl shadow-sky-100"
        >
          <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="" />
          כניסה עם Google
        </button>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">© 2026 ח. סבן חומרי בניין - תפעול ולוגיסטיקה</p>
        </div>
      </div>
    </div>
  );

  if (viewMode === 'reports') {
    return <MorningReportSystem onBack={() => setViewMode('list')} drivers={drivers} />;
  }

  if (viewMode === 'chat') {
    return (
      <NoaChat 
        chatHistory={chatHistory}
        chatScrollRef={chatScrollRef}
        onBack={() => setViewMode('list')}
        onAction={handleAuraAction}
        orders={orders}
      />
    );
  }

  const filteredOrders = orders
    .filter(order => {
      const matchesSearch = 
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesDriver = driverFilter === 'all' || order.driverId === driverFilter;
      const matchesWarehouse = warehouseFilter === 'all' || order.warehouse === warehouseFilter;
      
      // Feature: Hide delivered from main board, keep in reports
      const isDelivered = order.status === 'delivered';
      const shouldHideDelivered = viewMode !== 'reports' && isDelivered && statusFilter === 'all';
      
      return matchesSearch && matchesStatus && matchesDriver && matchesWarehouse && !shouldHideDelivered;
    })
    .sort((a: any, b: any) => {
      let comparison = 0;
      if (sortBy === 'time') {
        comparison = a.date.localeCompare(b.date);
        if (comparison === 0) comparison = a.time.localeCompare(b.time);
      } else {
        const valA = String(a[sortBy] || '');
        const valB = String(b[sortBy] || '');
        comparison = valA.localeCompare(valB, 'he', { numeric: true });
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending').length;
  const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered').length;
  const totalOrders = filteredOrders.length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans mb-20 md:mb-0" dir="rtl">
      <Header 
        user={user} 
        notificationsEnabled={notificationsEnabled} 
        onToggleNotifications={toggleNotifications} 
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onInstallApp={installPrompt ? handleInstallClick : null}
        onFileUpload={handleDriveFileUpload}
        onOpenReminders={() => setIsRemindersOpen(true)}
      />

      <Drawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        user={user} 
        viewMode={viewMode}
        setViewMode={setViewMode}
        installPrompt={installPrompt}
        onOpenReminders={() => setIsRemindersOpen(true)}
      />

      <RemindersSidebar 
        isOpen={isRemindersOpen}
        onClose={() => setIsRemindersOpen(false)}
        reminders={reminders}
        onToggleComplete={(id, completed) => updateReminder(id, { isCompleted: completed })}
        onDelete={deleteReminder}
      />

      {/* Manual Order Modal */}
      <AnimatePresence>
        {(isAddingOrder || editingOrder) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingOrder(false);
                setEditingOrder(null);
              }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingOrder ? 'עדכון הזמנה ' : 'הזמנה חדשה '}</h3>
                <button onClick={() => {
                  setIsAddingOrder(false);
                  setEditingOrder(null);
                }} className="p-1 hover:bg-white/10 rounded-lg">
                  <X size={24} />
                </button>
              </div>
              
              <form 
                key={editingOrder?.id || 'new'}
                onChange={(e) => {
                  if (editingOrder) return;
                  const target = e.target as any;
                  setDraftOrder({ [target.name === 'customer' ? 'customerName' : target.name === 'driver' ? 'driverId' : target.name]: target.value });
                }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as any;
                  const data = {
                    date: form.date.value,
                    time: form.time.value,
                    driverId: form.driver.value,
                    orderNumber: form.orderNumber.value,
                    customerName: form.customer.value,
                    destination: form.destination.value,
                    items: form.items.value,
                    warehouse: form.warehouse.value as any,
                  };
                  
                  if (editingOrder) {
                    await updateOrder(editingOrder.id!, data);
                  } else {
                    await createOrder(data);
                    clearDraftOrder();
                  }
                  
                  setIsAddingOrder(false);
                  setEditingOrder(null);
                }}
                className="p-6 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">תאריך</label>
                    <input name="date" type="date" required defaultValue={editingOrder ? editingOrder.date : draftOrder.date} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">שעה</label>
                    <input name="time" type="time" required defaultValue={editingOrder ? editingOrder.time : draftOrder.time} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">מחסן</label>
                    <select name="warehouse" required defaultValue={editingOrder ? editingOrder.warehouse : draftOrder.warehouse} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none">
                      <option value="החרש">החרש</option>
                      <option value="התלמיד">התלמיד</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">נהג</label>
                    <select name="driver" required defaultValue={editingOrder ? editingOrder.driverId : (draftOrder.driverId || (drivers.length > 0 ? drivers[0].id : ''))} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none">
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">לקוח</label>
                    <input name="customer" required defaultValue={editingOrder ? editingOrder.customerName : draftOrder.customerName} placeholder="שם הלקוח" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">מספר הזמנה / ליד</label>
                    <input name="orderNumber" defaultValue={editingOrder ? editingOrder.orderNumber : draftOrder.orderNumber} placeholder="מס' נתור / הזמנה" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">יעד</label>
                  <input name="destination" required defaultValue={editingOrder ? editingOrder.destination : draftOrder.destination} placeholder="לאן נוסעים?" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-400">פריטים</label>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        const currentItems = editingOrder ? editingOrder.items : draftOrder.items;
                        const parsed = parseItems(currentItems);
                        if (parsed.length > 0) {
                          const formatted = parsed.map(p => `${p.quantity} | ${p.name}${p.sku ? ` | ${p.sku}` : ''}`).join('\n');
                          if (editingOrder) {
                            setEditingOrder({ ...editingOrder, items: formatted });
                          } else {
                            setDraftOrder({ items: formatted });
                          }
                          addToast('סידור רשימה', 'הפריטים סודרו בשורות  ✅', 'success');
                        }
                      }}
                      className="text-[10px] font-black text-sky-600 bg-sky-50 px-2 py-1 rounded-lg border border-sky-100 hover:bg-sky-100 transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Sparkles size={12} />
                      סדר רשימה
                    </button>
                  </div>
                  <textarea 
                    name="items" 
                    required 
                    value={editingOrder ? editingOrder.items : draftOrder.items}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (editingOrder) {
                        setEditingOrder({ ...editingOrder, items: val });
                      } else {
                        setDraftOrder({ items: val });
                      }
                    }}
                    placeholder="מה מעמיסים? (למשל: 8 חול 11501)" 
                    rows={3} 
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none resize-none" 
                  />
                  
                  {/* Automatic Preview */}
                  {(() => {
                    const items = editingOrder ? editingOrder.items : draftOrder.items;
                    const parsed = parseItems(items);
                    if (parsed.length > 0) {
                      return (
                        <div className="mt-2 p-3 bg-sky-50/50 rounded-xl border border-sky-100 flex flex-wrap gap-2">
                           {parsed.map((p, i) => (
                             <div key={i} className="bg-white px-2 py-1 rounded-lg border border-sky-200 text-[10px] font-bold text-sky-700 flex items-center gap-1 shadow-sm">
                                <span className="bg-sky-600 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px]">{p.quantity}</span>
                                <span>{p.name}</span>
                                {p.sku && <span className="text-gray-400 font-medium">({p.sku})</span>}
                             </div>
                           ))}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="pt-4 flex items-center gap-3">
                  {editingOrder && (
                    <label className="flex items-center justify-center gap-2 px-4 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold cursor-pointer hover:bg-gray-200 transition-colors h-[60px] min-w-[130px]" title="צרף מסמך PDF">
                      {isUploadingDoc ? (
                        <Loader2 size={24} className="animate-spin text-sky-600" />
                      ) : (
                        <>
                          <Paperclip size={20} />
                          <span className="text-sm">צרף PDF</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="application/pdf" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && editingOrder) handleDriveFileUpload(file, editingOrder.id, 'orderForm');
                        }}
                      />
                    </label>
                  )}
                  <button type="submit" className="flex-1 bg-sky-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-sky-700 transition-colors shadow-lg shadow-sky-600/20 h-[60px]">
                    {editingOrder ? 'תעדכן לי' : 'תאשר לי, הכל מוכן'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 pb-32 sm:pb-8">
        <div className="pb-[env(safe-area-inset-bottom)]">
        {viewMode === 'list' ? (
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-sky-100 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <CalendarIcon size={18} className="text-sky-600" />
                בחירת תאריך
              </h3>
              <button 
                onClick={() => setIsRangeMode(!isRangeMode)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${isRangeMode ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {isRangeMode ? 'ביטול טווח' : 'סינון לפי טווח'}
              </button>
            </div>

            {!isRangeMode ? (
              <div className="flex items-center justify-between bg-gray-50/50 p-2 rounded-2xl">
                <button onClick={() => setStartDate(subDays(startDate, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
                  <ChevronRight size={20} className="text-gray-400" />
                </button>
                
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-gray-900">{format(startDate, 'dd/MM/yyyy')}</span>
                  <span className="text-xs font-semibold text-sky-600">
                    {isSameDay(startDate, new Date()) ? 'היום' : format(startDate, 'EEEE', { locale: he })}
                  </span>
                </div>

                <button onClick={() => setStartDate(addDays(startDate, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
                  <ChevronLeft size={20} className="text-gray-400" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">מתאריך</label>
                  <input 
                    type="date" 
                    value={format(startDate, 'yyyy-MM-dd')}
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">עד תאריך</label>
                  <input 
                    type="date" 
                    value={format(endDate, 'yyyy-MM-dd')}
                    onChange={(e) => setEndDate(new Date(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-600 outline-none font-bold"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-sky-100 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-2 hover:bg-sky-50 rounded-xl transition-colors text-sky-600">
                  <ChevronRight size={24} />
                </button>
                <h3 className="text-xl font-black text-gray-900 capitalize min-w-[150px] text-center">
                  {format(calendarMonth, 'MMMM yyyy', { locale: he })}
                </h3>
                <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-2 hover:bg-sky-50 rounded-xl transition-colors text-sky-600">
                  <ChevronLeft size={24} />
                </button>
              </div>

              <div className="flex items-center gap-2 bg-gray-50/50 p-1.5 rounded-2xl">
                <button 
                  onClick={() => {
                    setIsRangeMode(false);
                    setStartDate(new Date());
                    setEndDate(new Date());
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!isRangeMode ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  יום בודד
                </button>
                <button 
                  onClick={() => setIsRangeMode(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isRangeMode ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  בחירת טווח
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => (
                <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const monthStart = startOfMonth(calendarMonth);
                const monthEnd = endOfMonth(monthStart);
                const startDateRange = startOfWeek(monthStart);
                const endDateRange = endOfWeek(monthEnd);
                
                return eachDayOfInterval({
                  start: startDateRange,
                  end: endDateRange,
                }).map((day, i) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayOrders = orders.filter(o => o.date === dayStr);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, startDate);
                  const isEndSelected = isRangeMode && isSameDay(day, endDate);
                  const isInRange = isRangeMode && day >= startDate && day <= endDate;

                  const deliveredCount = dayOrders.filter(o => o.status === 'delivered').length;
                  const readyCount = dayOrders.filter(o => o.status === 'ready').length;
                  const pendingCount = dayOrders.length - deliveredCount - readyCount;
                  const harashCount = dayOrders.filter(o => o.warehouse === 'החרש').length;
                  const talmidCount = dayOrders.filter(o => o.warehouse === 'התלמיד').length;

                  return (
                    <button 
                      key={day.toString()}
                      onClick={() => {
                        if (isRangeMode) {
                          if (isSameDay(startDate, endDate) && day > startDate) {
                            setEndDate(day);
                          } else {
                            setStartDate(day);
                            setEndDate(day);
                          }
                        } else {
                          setStartDate(day);
                          setEndDate(day);
                          setIsRangeMode(false);
                          setViewMode('list');
                        }
                      }}
                      className={`
                        min-h-[90px] p-2 rounded-2xl border transition-all flex flex-col items-start relative overflow-hidden
                        ${!isCurrentMonth ? 'bg-gray-50/50 border-transparent opacity-30 cursor-default' : 
                          isSelected || isEndSelected ? 'bg-sky-50 border-sky-200 shadow-inner z-10' : 
                          isInRange ? 'bg-sky-50/40 border-sky-100 shadow-sm' :
                          'bg-white border-gray-100 hover:border-sky-100 hover:shadow-sm'}
                      `}
                    >
                      <div className="flex justify-between items-center w-full mb-1">
                        <span className={`text-[10px] font-bold ${isToday ? 'bg-sky-600 text-white w-5 h-5 flex items-center justify-center rounded-full' : 'text-gray-900'}`}>
                          {format(day, 'd')}
                        </span>
                        {dayOrders.length > 0 && (
                          <span className="text-[9px] font-black text-gray-400">#{dayOrders.length}</span>
                        )}
                      </div>
                      
                      {dayOrders.length > 0 && isCurrentMonth && (
                        <div className="mt-auto space-y-1.5 w-full">
                          <div className="flex flex-wrap gap-1">
                            {harashCount > 0 && <span className="text-[7px] font-black bg-blue-50 text-blue-500 px-1 rounded-sm">H:{harashCount}</span>}
                            {talmidCount > 0 && <span className="text-[7px] font-black bg-sky-50 text-sky-500 px-1 rounded-sm">T:{talmidCount}</span>}
                          </div>
                          <div className="flex w-full h-1 rounded-full overflow-hidden bg-gray-100/50">
                            {deliveredCount > 0 && <div style={{width: `${(deliveredCount/dayOrders.length)*100}%`}} className="bg-green-500" />}
                            {readyCount > 0 && <div style={{width: `${(readyCount/dayOrders.length)*100}%`}} className="bg-blue-500" />}
                            {pendingCount > 0 && <div style={{width: `${(pendingCount/dayOrders.length)*100}%`}} className="bg-sky-400" />}
                          </div>
                        </div>
                      )}
                      
                      {isRangeMode && isSameDay(day, startDate) && !isSameDay(startDate, endDate) && (
                        <div className="absolute top-0 right-0 w-1 h-full bg-sky-200" />
                      )}
                      {isRangeMode && isSameDay(day, endDate) && !isSameDay(startDate, endDate) && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-sky-200" />
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-gray-900 underline decoration-sky-500 decoration-4 underline-offset-8">
              {viewMode === 'list' ? 'דוח בוקר' : viewMode === 'kanban' ? 'לוח קנבן' : viewMode === 'calendar' ? 'לוח שנתי' : viewMode === 'drivers' ? 'נהגים וביצועים' : viewMode === 'import' ? 'יבוא הזמנות חכם' : 'ארכיון דוחות'}
            </h2>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <LayoutList size={20} />
              </button>
              <button 
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="קנבן"
              >
                <Trello size={20} />
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <CalendarDays size={20} />
              </button>
              <button 
                onClick={() => setViewMode('drivers')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'drivers' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="נהגים וביצועים"
              >
                <Users size={20} />
              </button>
              <button 
                onClick={() => setViewMode('reports')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'reports' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="ארכיון דוחות"
              >
                <FileText size={20} />
              </button>
              <button 
                onClick={() => setViewMode('chat')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'chat' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="נועה AI"
              >
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
          <button 
            onClick={() => setIsAddingOrder(true)}
            className="bg-sky-600 text-white flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-sky-600/20 hover:scale-105 transition-transform"
          >
            <Plus size={20} />
            הזמנה חדשה
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="חפש לקוח, יעד, פריט או מס' הזמנה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full bg-white border border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm focus:ring-2 focus:ring-sky-600 outline-none shadow-sm transition-all"
            />
            
            <AnimatePresence>
              {isSearchFocused && (
                <SearchSuggestions 
                  orders={orders} 
                  searchQuery={searchQuery} 
                  isVisible={isSearchFocused}
                  onSelect={(val) => {
                    setSearchQuery(val);
                    setIsSearchFocused(false);
                  }}
                />
              )}
            </AnimatePresence>
          </div>
          <div className="flex flex-wrap gap-3">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="preparing">בהכנה</option>
              <option value="ready">מוכן ✅</option>
              <option value="delivered">סופק</option>
              <option value="cancelled">בוטל</option>
            </select>
            
            <select 
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"
            >
              <option value="all">כל הנהגים</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select 
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"
            >
              <option value="all">כל המחסנים</option>
              <option value="החרש">מחסן החרש 🏭</option>
              <option value="התלמיד">מחסן התלמיד 🏗️</option>
            </select>

            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 min-w-[140px] bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none shadow-sm focus:ring-2 focus:ring-sky-600 transition-all cursor-pointer"
            >
              <option value="time">מיין לפי שעת יציאה 🕒</option>
              <option value="customerName">מיין לפי לקוח 👤</option>
              <option value="destination">מיין לפי יעד 📍</option>
            </select>
          </div>
        </div>

        {/* Daily Summary */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-sm">סיכום מסירות</h3>
          <button 
            onClick={() => setGroupByDriver(!groupByDriver)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${groupByDriver ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Users size={14} />
            {groupByDriver ? 'בטל הקבצה' : 'קבץ לפי נהג'}
          </button>
        </div>

        <div className="space-y-4">
          {viewMode === 'import' ? (
            <DeliveryImport />
          ) : filteredOrders.length === 0 && (viewMode === 'list' || viewMode === 'kanban') ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-3 text-gray-400">
                <Search size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">לא מצאתי תוצאות </h3>
              <p className="text-gray-500 text-sm">נסה לחפש משהו אחר או לשנות את הסינון.</p>
            </div>
          ) : groupByDriver ? (
            <DriverList 
              orders={filteredOrders}
              drivers={drivers}
              searchQuery={searchQuery}
              onOrderEdit={setEditingOrder}
              onOrderUpdateStatus={handleStatusUpdate}
              onOrderUpdateEta={(id, eta) => updateOrder(id, { eta })}
              onOrderDelete={deleteOrder}
              onOrderRepeat={handleRepeatOrder}
              onAddToast={addToast}
              onDriverSelect={id => setSelectedDriverId(id === selectedDriverId ? null : id)}
              selectedDriverId={selectedDriverId}
            />
          ) : viewMode === 'drivers' ? (
            <div className="space-y-6">
              {drivers.map(driver => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  orders={orders.filter(o => o.driverId === driver.id && (isRangeMode || isSameDay(new Date(o.date), selectedDate)))}
                  allOrders={orders}
                  searchQuery={searchQuery}
                  onOrderEdit={setEditingOrder}
                  onOrderUpdateStatus={handleStatusUpdate}
                  onOrderUpdateEta={(id, eta) => updateOrder(id, { eta })}
                  onOrderDelete={deleteOrder}
                  onOrderRepeat={handleRepeatOrder}
                  onAddToast={addToast}
                  onUploadDoc={handleDriveFileUpload}
                />
              ))}
            </div>
          ) : viewMode === 'kanban' ? (
            <KanbanBoard
              orders={filteredOrders}
              drivers={drivers}
              searchQuery={searchQuery}
              onOrderEdit={setEditingOrder}
              onOrderUpdateStatus={handleStatusUpdate}
              onOrderUpdateEta={(id, eta) => updateOrder(id, { eta })}
              onOrderDelete={deleteOrder}
              onOrderRepeat={handleRepeatOrder}
              onAddToast={addToast}
              onUploadDoc={handleDriveFileUpload}
            />
          ) : (
            <div className="grid gap-4">
              {filteredOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  drivers={drivers}
                  allOrders={orders}
                  searchQuery={searchQuery}
                  onEdit={setEditingOrder}
                  onUpdateStatus={handleStatusUpdate}
                  onUpdateEta={(id, eta) => updateOrder(id, { eta })}
                  onDelete={deleteOrder}
                  onRepeat={handleRepeatOrder}
                  onAddToast={addToast}
                  onUploadDoc={handleDriveFileUpload}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      </main>

      {/* Toasts */}

      {/* Mobile Nav Overlay */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-sky-100 px-8 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex justify-between items-center z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setViewMode('list')}
          className={`flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${viewMode === 'list' ? 'text-sky-600' : 'text-gray-300'}`}
        >
          <Truck size={20} />
          <span className="text-[10px] font-bold">סידור</span>
        </button>
        <button 
          onClick={() => setViewMode('chat')}
          className={`flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${viewMode === 'chat' ? 'text-sky-600' : 'text-gray-300'}`}
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-bold">נועה</span>
        </button>
        <button 
          onClick={() => setViewMode('drivers')}
          className={`flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${viewMode === 'drivers' ? 'text-sky-600' : 'text-gray-300'}`}
        >
          <Users size={20} />
          <span className="text-[10px] font-bold">נהגים</span>
        </button>
        <button 
          onClick={() => setViewMode('reports')}
          className={`flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${viewMode === 'reports' ? 'text-sky-600' : 'text-gray-300'}`}
        >
          <FileText size={20} />
          <span className="text-[10px] font-bold">דוחות</span>
        </button>
      </div>

      {/* Toasts */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm" dir="rtl">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="pointer-events-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-sky-100 p-4 flex gap-4 overflow-hidden relative"
            >
              <div className={`w-1 absolute right-0 top-0 bottom-0 ${
                toast.type === 'success' ? 'bg-green-500' : 
                toast.type === 'warning' ? 'bg-sky-500' : 'bg-blue-500'
              }`} />
              
              <div className={`p-2 rounded-xl h-fit ${
                toast.type === 'success' ? 'bg-green-50' : 
                toast.type === 'warning' ? 'bg-sky-50' : 'bg-blue-50'
              }`}>
                {toast.type === 'success' && <CheckCircle size={20} className="text-green-600" />}
                {toast.type === 'warning' && <AlertTriangle size={20} className="text-sky-600" />}
                {toast.type === 'info' && <Info size={20} className="text-blue-600" />}
              </div>

              <div className="flex-1">
                <h4 className="font-black text-gray-900 text-sm mb-0.5">{toast.title}</h4>
                <p className="text-gray-500 text-xs leading-relaxed">{toast.message}</p>
              </div>

              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
