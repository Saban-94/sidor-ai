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
  Package,
  X,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { predictOrderEta } from '../services/auraService';
import { Order, Driver, InventoryItem } from '../types';
import { highlightText, parseItems, isKnownProduct, cn } from '../lib/utils';

export const StatusBadge = ({ status }: { status: Order['status'] }) => {
  const configs = {
    pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, label: 'ממתין', emoji: '🕒' },
    preparing: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck, label: 'בהכנה', emoji: '🛠️' },
    ready: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'מוכן', emoji: '🚚' },
    delivered: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle, label: 'סופק', emoji: '✅' },
    cancelled: { color: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertCircle, label: 'בוטל', emoji: '🛑' },
  };

  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border ${config.color} shadow-sm uppercase tracking-tight`}>
      <span className="text-[14px] leading-none">{config.emoji}</span>
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
  key?: React.Key;
}

const ItemsModal = ({ 
  order, 
  inventoryItems = [],
  onClose 
}: { 
  order: Order, 
  inventoryItems?: InventoryItem[],
  onClose: () => void 
}) => {
  const parsedItems = parseItems(order.items);
  
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
      >
        <div className="flex items-center justify-between p-6 bg-gray-900 text-white">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-sky-500 rounded-2xl shadow-lg ring-4 ring-sky-500/20">
               <Package size={20} />
             </div>
             <div>
               <h2 className="text-xl font-black leading-tight">פירוט פריטי הזמנה</h2>
               <p className="text-[10px] font-bold text-sky-200 uppercase tracking-widest leading-none mt-1">
                 {order.customerName} | #{order.orderNumber || order.id?.slice(-4).toUpperCase()}
               </p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-12 text-center">כמות</th>
                <th className="py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">תיאור פריט</th>
                <th className="py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-24 text-left">מק"ט</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {parsedItems.map((item, idx) => (
                <tr key={idx} className="group hover:bg-sky-50/50 transition-colors">
                  <td className="py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-black shadow-sm group-hover:bg-sky-600 transition-colors">
                      {item.quantity}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <p className={cn(
                      "text-sm font-black leading-tight",
                      isKnownProduct(item.name) ? "text-sky-600" : "text-gray-900"
                    )}>
                      {item.name}
                    </p>
                  </td>
                  <td className="py-4 text-left">
                    <div className="flex flex-col items-end gap-1">
                      {item.sku ? (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                          {item.sku}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-300 italic">לא צוין</span>
                      )}
                      
                      {inventoryItems.find(inv => inv.sku === item.sku) && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          (inventoryItems.find(inv => inv.sku === item.sku)?.currentStock || 0) > 0 
                            ? 'bg-emerald-50 text-emerald-600' 
                            : 'bg-rose-50 text-rose-600'
                        }`}>
                          {(inventoryItems.find(inv => inv.sku === item.sku)?.currentStock || 0) > 0 ? 'במלאי' : 'חסר'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {parsedItems.length === 0 && (
            <div className="py-12 text-center">
              <Package size={48} className="mx-auto text-gray-100 mb-4" />
              <p className="text-gray-400 font-bold">אין פריטים להצגה</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest">סה"כ {parsedItems.length} שורות פריטים</p>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-white border border-gray-200 text-gray-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-all shadow-sm"
          >
            סיימתי לצפות
          </button>
        </div>
      </motion.div>
    </div>
  );
};

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
    <div className="fixed inset-0 z-[200] flex overflow-hidden" dir="rtl">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
      />
      
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full mt-auto bg-white rounded-t-[3rem] shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden sm:max-w-md sm:mx-auto sm:mb-10 sm:rounded-[3rem]"
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2" />
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-sky-600 text-white rounded-2xl shadow-xl">
               <FileText size={22} />
             </div>
             <div>
               <h2 className="text-xl font-black text-gray-900 leading-tight">מסמכי הזמנה</h2>
               <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest">#{order.orderNumber || order.id?.slice(-4).toUpperCase()}</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-gray-100 text-gray-400 hover:text-gray-900 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
             <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">מידע לקוח</span>
                <StatusBadge status={order.status} />
             </div>
             <p className="text-lg font-black text-gray-900 leading-tight">{order.customerName}</p>
             <p className="text-xs font-bold text-gray-500 mt-1">{order.destination}</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Paperclip size={14} className="text-sky-500" />
              קבצים מאובטחים
            </h3>

            {[
              { id: order.orderFormId, type: 'orderForm', label: 'טופס הזמנה חתום', icon: Package },
              { id: order.deliveryNoteId, type: 'deliveryNote', label: 'תעודת משלוח', icon: Truck }
            ].map((doc) => (
              <div key={doc.type} className="group">
                <div className={`p-4 rounded-[1.5rem] border transition-all ${
                  doc.id ? 'bg-white border-sky-100 shadow-md ring-1 ring-sky-50' : 'bg-gray-50 border-dashed border-gray-200 opacity-60'
                }`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`p-3 rounded-xl ${
                      doc.id ? 'bg-sky-100 text-sky-600' : 'bg-gray-200 text-gray-400'
                    }`}>
                      <doc.icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <h4 className="text-sm font-black text-gray-900 truncate">{doc.label}</h4>
                      <p className="text-[10px] font-bold text-gray-400">
                        {doc.id ? (isPending(doc.id) ? 'מעבד...' : 'זמין לצפייה') : 'טרם הועלה'}
                      </p>
                    </div>
                    
                    {doc.id && !isPending(doc.id) && (
                      <a 
                        href={getDriveUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-sky-600 text-white rounded-xl shadow-lg shadow-sky-600/20 active:scale-90 transition-transform"
                      >
                         <ExternalLink size={16} />
                      </a>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                     <span className="text-[9px] font-bold text-gray-400 uppercase">פעולות</span>
                     <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                       isUploading === doc.type ? 'bg-sky-50 text-sky-400' : 'bg-white border border-gray-200 text-sky-600 hover:bg-sky-50'
                     }`}>
                        {isUploading === doc.type ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <>
                            <FileUp size={12} />
                            <span>{doc.id ? 'עדכן' : 'העלה'}</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="application/pdf" 
                          className="hidden" 
                          onChange={(e) => handleFileChange(e, doc.type as any)} 
                        />
                     </label>
                  </div>
                </div>
              </div>
            ))}

            {order.documentIds && order.documentIds.length > 0 && (
              <div className="space-y-3">
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                   <FileText size={14} className="text-sky-500" />
                   מזהי מסמכים נוספים
                 </h3>
                 <div className="grid grid-cols-1 gap-2">
                    {order.documentIds.map((id, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex justify-between items-center">
                        <span className="text-xs font-black text-gray-700">{id}</span>
                        <a 
                          href={getDriveUrl(id)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] font-black text-sky-600 hover:underline"
                        >
                          צפייה
                        </a>
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
           <button 
             onClick={onClose}
             className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all"
           >
             סגור
           </button>
        </div>
      </motion.div>
    </div>
  );
};

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
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ date: order.date, time: order.time });

  const handleReschedule = async () => {
     try {
       const { updateOrder } = await import('../services/auraService');
       const { GasService } = await import('../services/gasService');
       
       await updateOrder(order.id!, { 
         date: rescheduleData.date, 
         time: rescheduleData.time 
       });
       
       // Explicit log for rescheduling
       GasService.logBlackBox({
         operation: 'UPDATE',
         user: 'System Quick Reschedule',
         collection: 'orders',
         newValue: rescheduleData,
         path: `orders/${order.id}/schedule`,
         origin: 'App'
       });

       onAddToast('עודכן', 'מועד האספקה עודכן בהצלחה', 'success');
       setIsRescheduling(false);
     } catch (err) {
       onAddToast('שגיאה', 'עדכון המועד נכשל', 'warning');
     }
  };

  const parsedItemsCount = parseItems(order.items).length;

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
        onAddToast('חיזוי ETA חכם', `נמצא זמן הגעה משוער: ${predictedEta} על סמך תנועה`, 'success');
      } else {
        onAddToast('שגיאה בחיזוי', 'לא הצלחתי לחשב זמן הגעה, אנא נסה שנית', 'warning');
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
      onAddToast('הועתק', 'פרטי ההזמנה הועתקו ללוח', 'success');
    }
  };

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
              {(order.orderFormId || order.deliveryNoteId || (order.documentIds && order.documentIds.length > 0)) ? (
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
      )}

      <div className={cn(
        "flex gap-4 pt-2",
        isCompact ? "mb-4" : "mb-6"
      )}>
        <div className={cn(
          "rounded-3xl h-fit border shadow-sm flex items-center justify-center",
          driver?.vehicleType === 'crane' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-blue-50 text-blue-600 border-blue-100',
          isCompact ? "p-2.5" : "p-4"
        )}>
          <Truck size={isCompact ? 20 : 28} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <h3 className={cn(
            "font-black text-gray-900 leading-tight mb-1 truncate",
            isCompact ? "text-base" : "text-xl"
          )}>
            {highlightText(order.customerName, searchQuery)}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
               <Info size={10} /> {highlightText(order.destination, searchQuery)}
            </p>
          </div>
        </div>
      </div>

      <div className={cn(
        "flex items-center justify-between bg-sky-50/50 rounded-2xl border border-sky-50/50",
        isCompact ? "p-3 mb-4" : "p-4 mb-6"
      )}>
        <div className="flex flex-col gap-1 text-right">
          {!isCompact && <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">נהג וזמן</span>}
          <div className="flex items-center gap-2">
            {order.driverId === 'self' ? (
              <span className={cn("font-black text-gray-900", isCompact ? "text-xs" : "text-sm")}>איסוף עצמי</span>
            ) : (
              <div className="flex items-center gap-2">
                {driver?.avatar ? (
                  <img 
                    src={driver.avatar} 
                    alt={driver.name} 
                    className={cn("rounded-full object-cover border-2 border-white shadow-sm", isCompact ? "w-5 h-5" : "w-7 h-7")}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={cn("rounded-full bg-sky-100 flex items-center justify-center border-2 border-white shadow-sm text-sky-600", isCompact ? "w-5 h-5" : "w-7 h-7")}>
                    <User size={isCompact ? 10 : 14} />
                  </div>
                )}
                <span className={cn("font-black text-gray-900 leading-tight", isCompact ? "text-xs" : "text-sm")}>
                  {driver?.name.split(' ')[0]}
                </span>
              </div>
            )}
            <span className={cn("font-black text-sky-600 self-center mr-1", isCompact ? "text-xs" : "text-sm")}>| {order.time}</span>
            <button 
              onClick={() => setIsRescheduling(true)}
              className="p-1 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors ml-1"
              title="שינוי מועד מהיר"
            >
              <Clock size={isCompact ? 10 : 12} />
            </button>
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
        {!isCompact ? (
          <div className="bg-sky-50/30 p-4 rounded-[1.5rem] border border-sky-100/50 flex items-center justify-between group/items">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-sky-100 transition-transform group-hover/items:scale-110">
                  <Package size={20} className="text-sky-600" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-sky-700/60 uppercase tracking-widest block leading-none mb-1">תכולת משלוח</span>
                  <p className="text-xs font-black text-gray-700 leading-none">
                    {parsedItemsCount} פריטים רשומים
                  </p>
                </div>
            </div>
            
            <button 
              onClick={() => setShowItems(true)}
              className="px-4 py-2 bg-white text-sky-600 border border-sky-200 rounded-xl font-black text-[11px] shadow-sm hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all active:scale-95"
            >
              צפייה בפריטים
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setShowItems(true)}
            className="w-full flex items-center justify-between p-3 bg-sky-50/30 hover:bg-sky-100/50 rounded-xl border border-sky-100/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Package size={14} className="text-sky-600" />
              <span className="text-[11px] font-black text-gray-700">{parsedItemsCount} פריטים</span>
            </div>
            <ChevronLeft size={14} className="text-sky-400" />
          </button>
        )}

        <AnimatePresence>
          {showItems && (
            <ItemsModal order={order} inventoryItems={inventoryItems} onClose={() => setShowItems(false)} />
          )}
          {isRescheduling && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRescheduling(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-6"
                dir="rtl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900">תזמון מחדש</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">תאריך</label>
                    <input 
                      type="date"
                      value={rescheduleData.date}
                      onChange={(e) => setRescheduleData({...rescheduleData, date: e.target.value})}
                      className="w-full bg-gray-50 border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-sky-600/10 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">שעה</label>
                    <input 
                      type="time"
                      value={rescheduleData.time}
                      onChange={(e) => setRescheduleData({...rescheduleData, time: e.target.value})}
                      className="w-full bg-gray-50 border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-sky-600/10 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleReschedule} className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-black text-xs shadow-lg shadow-sky-600/20 active:scale-95 transition-all">שמור מועד</button>
                  <button onClick={() => setIsRescheduling(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-black text-xs active:scale-95 transition-all">ביטול</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className={cn(
          "flex items-center gap-2 pt-2 border-t border-gray-100",
          isCompact ? "flex-wrap justify-end" : ""
        )}>
          <button 
            onClick={() => {
              const nextStatusMap: Record<string, string> = {
                pending: 'preparing',
                preparing: 'ready',
                ready: 'delivered'
              };
              onUpdateStatus(order.id!, nextStatusMap[order.status] || order.status);
            }}
            className={cn(
              "bg-sky-600 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 active:scale-95 transition-all",
              isCompact ? "px-3 py-2" : "flex-1 py-3.5"
            )}
          >
            <CheckCircle2 size={isCompact ? 14 : 16} /> 
            {isCompact ? "קדם" : "עדכן סטטוס"}
          </button>
          
          {isCompact ? (
             <div className="flex items-center gap-1">
               <button onClick={() => onEdit(order)} className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl">
                 <Pencil size={14} />
               </button>
               <button onClick={handleShare} className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl">
                 <Share2 size={14} />
               </button>
               <button 
                onClick={() => {
                  if (window.confirm('האם למחוק הזמנה זו?')) onDelete(order.id!);
                }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
               >
                 <Trash2 size={14} />
               </button>
             </div>
          ) : (
            <>
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
                onClick={() => {
                  if (onCreateCustomer) {
                    onCreateCustomer(order.customerName, order.customerPhone || '', order.destination || '');
                  }
                }}
                title="פתח כרטיס לקוח"
                className="p-3.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"
              >
                <User size={18} />
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
                  if (window.confirm('האם אתה בטוח שברצונך למחוק את ההזמנה לצמיתות?')) {
                    onDelete(order.id!);
                  }
                }}
                className="p-3.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
