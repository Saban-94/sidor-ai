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
  RotateCcw
} from 'lucide-react';
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
  key?: React.Key;
}

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
  searchQuery = ''
}: OrderCardProps) => {
  const [isPredicting, setIsPredicting] = useState(false);

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
