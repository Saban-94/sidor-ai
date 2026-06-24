import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  MapPin, 
  Phone, 
  ChevronRight, 
  Package, 
  Calendar,
  Sparkles
} from 'lucide-react';

// Status Configuration following SabanOS CRM Precision Guidelines
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface SidorOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  destination: string;
  items: string;
  date: string;
  time?: string;
  status: OrderStatus;
  driverName?: string;
}

interface SidorOrderCardProps {
  initialOrder?: SidorOrder;
  onStatusChange?: (id: string, newStatus: OrderStatus) => void;
}

export const SidorOrderCard: React.FC<SidorOrderCardProps> = ({ 
  initialOrder,
  onStatusChange 
}) => {
  // Demo order if none is supplied
  const defaultOrder: SidorOrder = {
    id: 'saban-9442',
    orderNumber: '9442',
    customerName: 'ראמי אהובי - ח.סבן חומרי בניין',
    customerPhone: '052-1234567',
    destination: 'אתר בנייה - רחוב העצמאות 12, חיפה',
    items: '20 שקי מלט (סולידי), 5 קוב חול, 10 ברזל בניין קוטר 12',
    date: '2026-06-23',
    time: '08:30',
    status: 'pending',
    driverName: 'מוחמד סבן'
  };

  const [order, setOrder] = useState<SidorOrder>(initialOrder || defaultOrder);
  const [history, setHistory] = useState<OrderStatus[]>([order.status]);

  // Status map for label, color, and icon configuration with NO TRANSPARENCY on text
  const statusConfig: Record<OrderStatus, { 
    label: string; 
    bg: string; 
    text: string; 
    border: string; 
    emoji: string;
    icon: React.ComponentType<any>;
  }> = {
    pending: { 
      label: 'ממתין לאישור', 
      bg: 'bg-slate-900', 
      text: 'text-[#C5A059]', // Solid Gold
      border: 'border-[#C5A059]', 
      emoji: '🕒',
      icon: Clock 
    },
    preparing: { 
      label: 'בהכנה במלאי', 
      bg: 'bg-slate-900', 
      text: 'text-sky-400', // Bright Sky Blue
      border: 'border-sky-500', 
      emoji: '🛠️',
      icon: Package 
    },
    ready: { 
      label: 'מוכן למשלוח', 
      bg: 'bg-slate-900', 
      text: 'text-amber-400', // Bright Amber
      border: 'border-amber-500', 
      emoji: '📦',
      icon: Truck 
    },
    delivered: { 
      label: 'נמסר בהצלחה', 
      bg: 'bg-slate-900', 
      text: 'text-[#34D399]', // Solid Emerald
      border: 'border-[#34D399]', 
      emoji: '✅',
      icon: CheckCircle2 
    },
    cancelled: { 
      label: 'בוטל', 
      bg: 'bg-slate-950', 
      text: 'text-red-500', // Solid Red
      border: 'border-red-600', 
      emoji: '🛑',
      icon: AlertCircle 
    }
  };

  // Progression chain for advancing status
  const nextStatusMap: Record<OrderStatus, OrderStatus> = {
    pending: 'preparing',
    preparing: 'ready',
    ready: 'delivered',
    delivered: 'pending', // Loops back for demonstration
    cancelled: 'pending'
  };

  const handleAdvanceStatus = () => {
    const nextStatus = nextStatusMap[order.status];
    const updatedOrder = { ...order, status: nextStatus };
    setOrder(updatedOrder);
    setHistory(prev => [...prev, nextStatus]);
    
    if (onStatusChange) {
      onStatusChange(order.id, nextStatus);
    }
  };

  const currentConfig = statusConfig[order.status];
  const StatusIcon = currentConfig.icon;

  return (
    <div className="w-full max-w-md mx-auto bg-[#1E293B] border-2 border-slate-800 rounded-3xl p-4 shadow-2xl relative overflow-hidden select-none" dir="rtl">
      {/* Decorative Branding Status */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-white font-black tracking-widest uppercase">SABAN-PRECISION CRM</span>
        </div>
        <div className="text-[10px] text-[#C5A059] font-black">נועה | מחוברת ✅</div>
      </div>

      {/* Main Order Card Body */}
      <div className="space-y-2.5">
        {/* Order Header / Title */}
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono text-[#C5A059] font-bold">הזמנה #{order.orderNumber}</span>
            <h3 className="text-sm font-black text-white flex items-center gap-1.5 leading-none">
              <User size={14} className="text-slate-400" />
              {order.customerName}
            </h3>
          </div>
          
          {/* Animated Status Badge */}
          <motion.div 
            key={order.status}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[10px] font-black ${currentConfig.bg} ${currentConfig.text} ${currentConfig.border}`}
          >
            <span>{currentConfig.emoji}</span>
            <StatusIcon size={12} strokeWidth={3} />
            <span>{currentConfig.label}</span>
          </motion.div>
        </div>

        {/* Delivery Destination details */}
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-2 space-y-1">
          <div className="flex items-center gap-1.5 text-xs">
            <MapPin size={12} className="text-amber-400" />
            <span className="text-white font-medium truncate">{order.destination}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Phone size={12} className="text-[#34D399]" />
            <span className="text-white font-mono">{order.customerPhone}</span>
          </div>
          {order.driverName && (
            <div className="flex items-center gap-1.5 text-xs border-t border-slate-800/40 pt-1 mt-1">
              <Truck size={12} className="text-sky-400" />
              <span className="text-slate-300">נהג משויך: </span>
              <span className="text-white font-bold">{order.driverName}</span>
            </div>
          )}
        </div>

        {/* Cargo Items List */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
          <span className="text-[10px] font-black text-[#C5A059] uppercase tracking-wider block mb-1">תכולת מטען:</span>
          <p className="text-xs text-white leading-relaxed font-semibold">
            {order.items}
          </p>
        </div>

        {/* Action Controls - Tactical CRM Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
          {/* Main Advance Order Button */}
          <button 
            onClick={handleAdvanceStatus}
            data-intent="confirm_galia"
            data-payload={JSON.stringify({ orderId: order.id, status: order.status })}
            className="col-span-2 h-12 bg-gradient-to-l from-[#C5A059] to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={16} className="animate-pulse" />
            <span>קדם הזמנה ➔</span>
          </button>
        </div>

        {/* Dynamic Status Progression History Visual */}
        <div className="bg-slate-950/20 border border-slate-800/40 rounded-xl p-2">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">היסטוריית שינוי סטטוס במסך:</span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" dir="ltr">
            {history.map((histStatus, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="text-slate-600 text-xs">➔</span>}
                <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-black border uppercase ${statusConfig[histStatus].bg} ${statusConfig[histStatus].text} ${statusConfig[histStatus].border}`}>
                  {statusConfig[histStatus].emoji} {histStatus}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Mandatory Signature with exact formatting from SabanOS CRM Guidelines */}
      <div className="mt-3 text-center border-t border-slate-800/60 pt-2">
        <div className="signature text-xs text-[#C5A059] font-black tracking-widest">
          באדיבות נועה ❤️
        </div>
      </div>
    </div>
  );
};

export default SidorOrderCard;
