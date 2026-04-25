import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  Info, 
  Clock, 
  CheckCircle2, 
  CheckCircle, 
  Sparkles, 
  Send, 
  User,
  Pencil,
  AlertCircle,
  Trash2,
  Share2,
  RotateCcw,
  Eye,
  FileText,
  FileUp,
  Loader2,
  Paperclip,
  Package,
  X,
  ExternalLink,
  ChevronLeft,
  MessageSquare
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { predictOrderEta } from '../services/auraService';
import { Order, Driver, InventoryItem } from '../types';
import { highlightText, parseItems, isKnownProduct, cn } from '../lib/utils';

// קומפוננטת בועת הצאט עם אפקט הנדנוד
const ChatNotificationBadge = ({ orderId, onClick }: { orderId: string, onClick: () => void }) => {
  const [hasUnread, setHasUnread] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // אתחול סאונד התראה
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    
    const chatRef = collection(db, `orders/${orderId}/chat`);
    const q = query(chatRef, orderBy('createdAt', 'desc'), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const msgData = snapshot.docs[0].data();
        // אם ההודעה האחרונה היא מהלקוח
        if (msgData.sender === 'customer') {
          setHasUnread(true);
          setLastMessage(msgData.text);
          // הפעלת צלצול
          audioRef.current?.play().catch(e => console.log("Audio block:", e));
        }
      }
    });

    return () => unsubscribe();
  }, [orderId]);

  if (!hasUnread) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        x: [0, -2, 2, -2, 2, 0], // אפקט נדנוד (Shake)
      }}
      transition={{ 
        x: { repeat: Infinity, duration: 0.5, repeatDelay: 2 }, // מנדנד כל 2 שניות
        scale: { type: 'spring' } 
      }}
      onClick={(e) => {
        e.stopPropagation();
        setHasUnread(false);
        onClick();
      }}
      className="absolute -top-3 -right-3 z-[20] cursor-pointer"
    >
      <div className="relative">
        <div className="bg-rose-500 text-white p-3 rounded-2xl shadow-xl border-2 border-white flex items-center gap-2">
          <MessageSquare size={18} fill="currentColor" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase leading-none mb-0.5">הודעה חדשה</span>
            {lastMessage && <span className="text-[9px] font-bold opacity-90 truncate max-w-[80px]">{lastMessage}</span>}
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-rose-500 animate-ping opacity-20 -z-10"></div>
      </div>
    </motion.div>
  );
};

export const StatusBadge = ({ status }: { status: Order['status'] }) => {
  const configs = {
    pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, label: 'ממתין' },
    preparing: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck, label: 'בהכנה' },
    ready: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'מוכן' },
    delivered: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle, label: 'סופק' },
    cancelled: { color: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertCircle, label: 'בוטל' },
  };

  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border ${config.color} shadow-sm uppercase tracking-tight`}>
      <Icon size={12} strokeWidth={3} />
      {config.label}
    </span>
  );
};

interface OrderCardProps {
  order: Order;
  drivers: Driver[];
  inventoryItems?: InventoryItem[];
  onEdit: (o: Order) => void;
  onUpdateStatus: (id: string, s: any) => void;
  onUpdateEta: (id: string, eta: string) => void;
  onDelete: (id: string) => void;
  onRepeat: (o: Order) => void;
  onAddToast: (title: string, msg: string, type?: any) => void;
  onCreateCustomer?: (name: string, phone: string, address: string) => void;
  allOrders: Order[];
  searchQuery?: string;
  onUploadDoc?: (file: File, orderId?: string, docType?: any) => Promise<void>;
  isCompact?: boolean;
}

// ... הקוד של ItemsModal ו-DocumentSheet נשאר זהה ...

export const OrderCard = ({ 
  order, 
  drivers,
  inventoryItems = [],
  onEdit, 
  onUpdateStatus, 
  onUpdateEta,
  onDelete,
  onRepeat,
  onAddToast,
  onCreateCustomer,
  allOrders,
  searchQuery = '',
  onUploadDoc,
  isCompact = false
}: OrderCardProps) => {
  const [isPredicting, setIsPredicting] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [isLocalUploading, setIsLocalUploading] = useState(false);

  const parsedItemsCount = parseItems(order.items).length;
  const driver = drivers.find(d => d.id === order.driverId);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white/95 backdrop-blur-sm rounded-[2rem] border border-sky-100 shadow-lg hover:shadow-xl transition-all relative group",
        isCompact ? "p-4" : "p-5"
      )}
    >
      {/* בועת צאט חכמה עם צלצול ונדנוד */}
      {order.id && (
        <ChatNotificationBadge 
          orderId={order.id} 
          onClick={() => onAddToast("צ'אט לקוח", "פתיחת ממשק שיחה עם " + order.customerName, "info")} 
        />
      )}

      <div className={cn(
        "absolute bg-gray-900 text-white px-3 py-1 rounded-full text-[10px] font-black z-10 shadow-lg",
        isCompact ? "top-2 left-2" : "top-4 left-4"
      )}>
        #{order.orderNumber || order.id?.slice(-4).toUpperCase()}
      </div>

      {!isCompact && (
        <div className="absolute top-4 left-24 z-10 flex gap-2">
          {onUploadDoc && (
            <div className="flex items-center gap-2">
              {(order.orderFormId || order.deliveryNoteId) ? (
                <button 
                  onClick={() => setShowDocs(!showDocs)}
                  className="p-1.5 bg-white text-sky-600 border border-sky-100 rounded-full shadow-lg hover:bg-sky-50 transition-all"
                >
                  <Eye size={14} strokeWidth={3} />
                </button>
              ) : (
                <label className="p-1.5 bg-white text-sky-600 border border-sky-100 rounded-full shadow-lg cursor-pointer hover:bg-sky-50">
                  <FileUp size={14} strokeWidth={3} />
                  <input type="file" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onUploadDoc) onUploadDoc(file, order.id, 'orderForm');
                  }} />
                </label>
              )}
            </div>
          )}
        </div>
      )}

      <div className={cn("flex gap-4 pt-2", isCompact ? "mb-4" : "mb-6")}>
        <div className={cn(
          "rounded-3xl h-fit border shadow-sm flex items-center justify-center",
          driver?.vehicleType === 'crane' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-blue-50 text-blue-600 border-blue-100',
          isCompact ? "p-2.5" : "p-4"
        )}>
          <Truck size={isCompact ? 20 : 28} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <h3 className={cn("font-black text-gray-900 leading-tight mb-1 truncate", isCompact ? "text-base" : "text-xl")}>
            {highlightText(order.customerName, searchQuery)}
          </h3>
          <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
             <Info size={10} /> {highlightText(order.destination, searchQuery)}
          </p>
        </div>
      </div>

      <div className={cn("flex items-center justify-between bg-sky-50/50 rounded-2xl p-4 mb-6")}>
        <div className="flex flex-col gap-1 text-right">
          <div className="flex items-center gap-2">
            <span className="font-black text-gray-900 text-sm">{driver?.name || 'טרם שובץ'}</span>
            <span className="font-black text-sky-600 text-sm">| {order.time}</span>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button 
            onClick={() => {
              const nextMap: any = { pending: 'preparing', preparing: 'ready', ready: 'delivered' };
              onUpdateStatus(order.id!, nextMap[order.status] || order.status);
            }}
            className="flex-1 bg-sky-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all"
          >
            עדכן סטטוס
          </button>
          
          <button onClick={() => onEdit(order)} className="p-3 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-2xl transition-all">
            <Pencil size={18} />
          </button>
          
          <button onClick={() => onDelete(order.id!)} className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all">
            <Trash2 size={18} />
          </button>
      </div>
    </motion.div>
  );
};
