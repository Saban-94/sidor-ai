import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Truck, 
  Info, 
  Clock, 
  CheckCircle2, 
  CheckCircle, 
  Sparkles, 
  Send, 
  User,
  LogOut,
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
  X,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Order, Driver, predictOrderEta } from '../services/auraService';
import { highlightText } from '../lib/utils';

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
  onEdit: (o: Order) => void;
  onUpdateStatus: (id: string, s: any) => void;
  onUpdateEta: (id: string, eta: string) => void;
  onDelete: (id: string) => void;
  onRepeat: (o: Order) => void;
  onAddToast: (title: string, msg: string, type?: any) => void;
  allOrders: Order[];
  searchQuery?: string;
  onUploadDoc?: (file: File, orderId?: string, docType?: any) => Promise<void>;
  key?: React.Key;
}

const DocumentSheet = ({ 
  order, 
  onClose, 
  onUpload 
}: { 
  order: Order, 
  onClose: () => void,
  onUpload?: (file: File, type: 'orderForm' | 'deliveryNote') => Promise<void>
}) => {
  const [isUploading, setIsUploading] = useState<'orderForm' | 'deliveryNote' | null>(null);
  const getDriveUrl = (id: string) => id === 'PENDING_SCAN' ? '#' : `https://drive.google.com/file/d/${id}/view`;
  const isPending = (id?: string) => id === 'PENDING_SCAN';
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'orderForm' | 'deliveryNote') => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      setIsUploading(type);
      try {
        await onUpload(file, type);
      } finally {
        setIsUploading(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex overflow-hidden" dir="rtl">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
      />
      
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full ml-auto"
      >
        <div className="flex items-center justify-between p-6 border-bottom border-gray-100 bg-sky-50/30">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-sky-600 text-white rounded-2xl shadow-lg ring-4 ring-sky-50">
               <FileText size={20} />
             </div>
             <div>
               <h2 className="text-xl font-black text-gray-900 leading-tight">ניהול מסמכים</h2>
               <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest">הזמנה #{order.orderNumber || order.id?.slice(-4).toUpperCase()}</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Order Details Summary */}
          <div className="p-4 bg-gray-50 rounded-[1.5rem] border border-gray-100 flex flex-col gap-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">לקוח</span>
            <p className="text-base font-black text-gray-900">{order.customerName}</p>
            <p className="text-xs font-bold text-gray-500">{order.destination}</p>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Paperclip size={16} className="text-sky-500" />
              קבצים מצורפים
            </h3>

            {/* Document Types */}
            {[
              { id: order.orderFormId, type: 'orderForm', label: 'טופס הזמנה', themeColor: 'sky' },
              { id: order.deliveryNoteId, type: 'deliveryNote', label: 'תעודת משלוח', themeColor: 'emerald' }
            ].map((doc) => (
              <div key={doc.type} className="group relative">
                <div className={`p-5 rounded-[2rem] border transition-all duration-300 ${
                  doc.id ? 
                  `bg-white border-${doc.themeColor}-100 shadow-md` : 
                  'bg-gray-50 border-dashed border-gray-200 opacity-80'
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${
                        doc.id ? `bg-${doc.themeColor}-100 text-${doc.themeColor}-600` : 'bg-gray-200 text-gray-400'
                      }`}>
                        <FileText size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-gray-900">{doc.label}</h4>
                        <p className="text-[10px] font-bold text-gray-400">PDF Document</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {doc.id ? (
                      isPending(doc.id) ? (
                        <div className={`flex items-center gap-3 p-3 bg-${doc.themeColor}-50/50 rounded-2xl border border-${doc.themeColor}-100 animate-pulse`}>
                          <Loader2 size={16} className="animate-spin text-sky-600" />
                          <span className={`text-xs font-bold text-${doc.themeColor}-700`}>מעבד את המסמך אחי...</span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <a 
                            href={getDriveUrl(doc.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 flex items-center justify-center gap-2 py-3 bg-${doc.themeColor}-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-${doc.themeColor}-600/20 hover:scale-[1.02] active:scale-95 transition-all`}
                          >
                            <ExternalLink size={14} /> צפייה בקובץ
                          </a>
                        </div>
                      )
                    ) : (
                      <p className="text-[11px] font-bold text-gray-400 italic bg-gray-100/50 p-3 rounded-xl border border-gray-200">אין מסמך מצורף להזמנה זו</p>
                    )}

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest decoration-sky-500 decoration-2 underline-offset-4 decoration-dotted">עדכון קובץ</span>
                      <label className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all cursor-pointer shadow-sm ${
                        isUploading === doc.type ? 
                        `bg-${doc.themeColor}-50 border-${doc.themeColor}-200` : 
                        'bg-white border-gray-100 hover:border-sky-300 hover:bg-sky-50 text-sky-600'
                      }`}>
                        {isUploading === doc.type ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <>
                            <FileUp size={14} />
                            <span className="text-[10px] font-black">העלה חדש</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="application/pdf" 
                          className="hidden" 
                          disabled={!!isUploading}
                          onChange={(e) => handleFileChange(e, doc.type as any)} 
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100">
           <button 
             onClick={onClose}
             className="w-full py-4 bg-white border border-gray-200 text-gray-600 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-all hover:shadow-md"
           >
             סגור תצוגה
           </button>
        </div>
      </motion.div>
    </div>
  );
};

export const OrderCard = ({ 
  order, 
  drivers,
  onEdit, 
  onUpdateStatus, 
  onUpdateEta,
  onDelete,
  onRepeat,
  onAddToast,
  allOrders,
  searchQuery = '',
  onUploadDoc
}: OrderCardProps) => {
  const [isPredicting, setIsPredicting] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [isLocalUploading, setIsLocalUploading] = useState(false);

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadDoc) {
      setIsLocalUploading(true);
      try {
        await onUploadDoc(file, order.id, 'orderForm');
      } finally {
        setIsLocalUploading(false);
      }
    }
  };

  const handleSmartPredict = async () => {
    setIsPredicting(true);
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(() => {});
      }
      const historicalOrders = allOrders.filter(o => o.status === 'delivered');
      const predictedEta = await predictOrderEta(order, historicalOrders);
      if (predictedEta) {
        onUpdateEta(order.id!, predictedEta);
        onAddToast('חיזוי ETA חכם', `נמצא זמן הגעה משוער: ${predictedEta} על סמך תנועה אחי`, 'success');
      } else {
        onAddToast('שגיאה בחיזוי', 'לא הצלחתי לחשב זמן הגעה, תנסה שוב שותף', 'warning');
      }
    } catch (error) {
      console.error(error);
      onAddToast('שגיאה', 'משהו השתבש בחיבור ל-AI', 'warning');
    } finally {
      setIsPredicting(false);
    }
  };

  const handleShare = () => {
    const driver = drivers.find(d => d.id === order.driverId);
    const driverName = driver?.name || order.driverId;
    const statusHebrew: Record<string, string> = {
      pending: 'ממתין',
      preparing: 'בהכנה',
      ready: 'מוכן',
      delivered: 'סופק',
      cancelled: 'בוטל'
    };
    const text = `📦 *הזמנה #${order.orderNumber || order.id?.slice(-4).toUpperCase()}*\n👤 לקוח: ${order.customerName}\n📍 יעד: ${order.destination}\n🚛 נהג: ${driverName}\n⏰ שעה: ${order.time}\n📊 סטטוס: ${statusHebrew[order.status] || order.status}`;
    
    if (navigator.share) {
      navigator.share({ title: 'שיתוף הזמנה', text }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      onAddToast('הועתק', 'פרטי ההזמנה הועתקו ללוח אחי', 'success');
    }
  };

  const driver = drivers.find(d => d.id === order.driverId);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-sm p-5 rounded-[2rem] border border-sky-100 shadow-lg hover:shadow-xl transition-all relative group"
    >
      <div className="absolute top-4 left-4 bg-gray-900 text-white px-3 py-1 rounded-full text-[10px] font-black z-10 shadow-lg">
        #{order.orderNumber || order.id?.slice(-4).toUpperCase()}
      </div>

      <div className="absolute top-4 left-24 z-10 flex gap-2">
        {onUploadDoc && (
          <div className="flex items-center gap-2">
            {(order.orderFormId || order.deliveryNoteId) ? (
              <button 
                onClick={() => setShowDocs(!showDocs)}
                disabled={order.orderFormId === 'PENDING_SCAN' || order.deliveryNoteId === 'PENDING_SCAN'}
                className={`p-1.5 rounded-full shadow-lg border transition-all ${
                  showDocs ? 'bg-sky-600 text-white border-sky-600' : 
                  (order.orderFormId === 'PENDING_SCAN' || order.deliveryNoteId === 'PENDING_SCAN') ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed' :
                  'bg-white text-sky-600 border-sky-100 hover:bg-sky-50'
                }`}
                title={order.orderFormId === 'PENDING_SCAN' || order.deliveryNoteId === 'PENDING_SCAN' ? "מעבד מסמכים..." : "צפה במסמכים"}
              >
                {order.orderFormId === 'PENDING_SCAN' || order.deliveryNoteId === 'PENDING_SCAN' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Eye size={14} strokeWidth={3} />
                )}
              </button>
            ) : (
              <label 
                className={`p-1.5 rounded-full shadow-lg border transition-all cursor-pointer ${
                  isLocalUploading ? 'bg-sky-50 border-sky-200 text-sky-400' : 'bg-white text-sky-600 border-sky-100 hover:bg-sky-50'
                }`}
                title="העלאת מסמך מהיר"
              >
                {isLocalUploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileUp size={14} strokeWidth={3} />
                )}
                <input 
                  type="file" 
                  accept="application/pdf" 
                  className="hidden" 
                  disabled={isLocalUploading}
                  onChange={handleQuickUpload}
                />
              </label>
            )}
          </div>
        )}

        <AnimatePresence>
          {showDocs && (
            <DocumentSheet 
              order={order} 
              onClose={() => setShowDocs(false)} 
              onUpload={(file, type) => onUploadDoc ? onUploadDoc(file, order.id, type) : Promise.resolve()}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-4 mb-6 pt-2">
        <div className={`p-4 rounded-3xl h-fit border shadow-sm ${driver?.vehicleType === 'crane' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
          <Truck size={28} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <h3 className="font-black text-gray-900 text-xl leading-tight mb-1 truncate">
            {highlightText(order.customerName, searchQuery)}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-gray-400 font-bold flex items-center gap-1">
               <Info size={12} /> {highlightText(order.destination, searchQuery)}
            </p>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg font-black border border-gray-200 uppercase">{order.warehouse}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-sky-50/50 rounded-2xl mb-6 border border-sky-50/50">
        <div className="flex flex-col gap-1 text-right">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">נהג וזמן</span>
          <div className="flex items-center gap-2">
            {order.driverId === 'self' ? (
              <span className="text-sm font-black text-gray-900">איסוף עצמי</span>
            ) : (
              <div className="flex items-center gap-2">
                {driver?.avatar ? (
                  <img 
                    src={driver.avatar} 
                    alt={driver.name} 
                    className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center border-2 border-white shadow-sm">
                    <User size={14} className="text-sky-600" />
                  </div>
                )}
                <div className="flex flex-col -gap-0.5">
                  <span className="text-sm font-black text-gray-900 leading-tight">
                    {driver?.name.split(' ')[0]}
                  </span>
                  <span className="text-[9px] font-bold text-sky-600/80 uppercase">
                    {driver?.vehicleType === 'crane' ? 'מנוף 🏗️' : 'משאית 🚛'}
                  </span>
                </div>
              </div>
            )}
            <span className="text-sm font-black text-sky-600 self-center mr-1">| {order.time}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={order.status} />
          {isPredicting ? (
            <div className="flex items-center gap-1.5 mt-1">
              <Sparkles size={12} className="text-sky-400 animate-pulse" />
              <div className="w-16 h-3 bg-sky-100/50 rounded-full overflow-hidden relative border border-sky-100">
                <div className="absolute inset-0 shimmer-anim" />
              </div>
            </div>
          ) : order.eta && (
            <span className="text-[10px] font-black text-sky-600 animate-pulse flex items-center gap-1">
              <Sparkles size={10} />
              צפי: {order.eta}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 text-right">
           <span className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">פירוט פריטים</span>
           <p className="text-sm font-medium text-gray-700 leading-relaxed">
             {highlightText(order.items, searchQuery)}
           </p>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button 
            onClick={() => {
              const nextStatusMap: Record<string, string> = {
                pending: 'preparing',
                preparing: 'ready',
                ready: 'delivered'
              };
              onUpdateStatus(order.id!, nextStatusMap[order.status] || order.status);
            }}
            className="flex-1 bg-sky-600 text-white py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 active:scale-95 transition-all"
          >
            <CheckCircle2 size={16} /> עדכן סטטוס
          </button>
          
          <button 
            onClick={handleSmartPredict}
            disabled={isPredicting}
            className="bg-gray-900 text-white p-3.5 rounded-2xl hover:bg-sky-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10 active:scale-95 disabled:opacity-50"
          >
            {isPredicting ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Sparkles size={18} />
            )}
            <span className="hidden sm:inline text-xs font-bold">AI ETA</span>
          </button>

          <button 
            onClick={handleShare}
            title="שתף הזמנה"
            className="bg-white border-2 border-gray-100 text-gray-600 p-3.5 rounded-2xl hover:bg-sky-50 hover:text-sky-600 hover:border-sky-100 transition-all active:scale-95 shadow-sm"
          >
            <Share2 size={18} />
          </button>

          <button 
            onClick={() => onEdit(order)}
            title="ערוך הזמנה"
            className="p-3.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-2xl transition-all"
          >
            <Pencil size={18} />
          </button>

          <button 
            onClick={() => onRepeat(order)}
            title="הזמנה חוזרת (שכפול)"
            className="p-3.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-2xl transition-all"
          >
            <RotateCcw size={18} />
          </button>

          <button 
            onClick={() => {
              if (window.confirm('בטוח שאתה רוצה למחוק את ההזמנה לצמיתות אחי?')) {
                onDelete(order.id!);
              }
            }}
            className="p-3.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
