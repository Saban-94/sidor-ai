import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../types';
import { 
  Building2, 
  Truck, 
  Calendar, 
  ExternalLink,
  ChevronRight,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface MiniOrderCardProps {
  orderId: string;
  onView?: (order: Order) => void;
}

export const MiniOrderCard: React.FC<MiniOrderCardProps> = ({ orderId, onView }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      // Normalize order ID if it starts with #
      const normalizedId = orderId.startsWith('#') ? orderId.slice(1) : orderId;
      
      try {
        const orderDoc = await getDoc(doc(db, 'orders', normalizedId));
        if (orderDoc.exists()) {
          setOrder({ id: orderDoc.id, ...orderDoc.data() } as Order);
        }
      } catch (error) {
        console.error('Error fetching order for mini card:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  if (loading || !order) return null;

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed': return { icon: <CheckCircle2 size={12} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100', label: 'הושלם' };
      case 'in_progress': return { icon: <Truck size={12} />, color: 'bg-sky-50 text-sky-600 border-sky-100', label: 'בתנועה' };
      case 'cancelled': return { icon: <AlertCircle size={12} />, color: 'bg-rose-50 text-rose-600 border-rose-100', label: 'בוטל' };
      default: return { icon: <Clock size={12} />, color: 'bg-amber-50 text-amber-600 border-amber-100', label: 'ממתין' };
    }
  };

  const status = getStatusInfo(order.status);

  const handleAdvanceStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.id) return;
    
    const nextStatusMap: Record<string, Order['status']> = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'on_the_way',
      on_the_way: 'delivered',
      delivered: 'delivered',
      cancelled: 'cancelled'
    };
    
    const nextStatus = nextStatusMap[order.status];
    if (nextStatus === order.status) return;

    try {
      const { updateOrder } = await import('../services/auraService');
      await updateOrder(order.id, { status: nextStatus });
      // In a real app we might want to refresh the local state or use a global state manager
      // but since this is a mini card often used in chat, simple UI update is harder without props
      setOrder({...order, status: nextStatus});
    } catch (err) {
      console.error('Failed to advance status from mini card:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="mt-3 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-slate-200 shadow-xl shadow-slate-900/5 min-w-[280px] max-w-sm pointer-events-auto"
      dir="rtl"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Building2 size={16} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 truncate max-w-[150px]">{order.customerName}</h4>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-slate-400">הזמנה {order.id?.slice(-4).toUpperCase()}</span>
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-black ${status.color}`}>
                {status.icon}
                {status.label}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <button 
              onClick={handleAdvanceStatus}
              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all"
              title="קדם סטטוס"
            >
              <CheckCircle2 size={14} />
            </button>
          )}
          <button 
            onClick={() => onView?.(order)}
            className="p-2 bg-slate-50 hover:bg-sky-50 text-slate-400 hover:text-sky-600 rounded-xl transition-all"
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
          <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">נהג</p>
          <p className="text-[10px] font-black text-slate-700 flex items-center gap-1">
            <Truck size={10} /> {order.driverName || 'טרם שובץ'}
          </p>
        </div>
        <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
          <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">תזמון</p>
          <p className="text-[10px] font-black text-slate-700 flex items-center gap-1">
            <Calendar size={10} /> {format(new Date(order.date), 'dd/MM')}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between group cursor-pointer" onClick={() => onView?.(order)}>
        <div className="flex items-center gap-1">
          <Package size={12} className="text-slate-400" />
          <span className="text-[9px] font-bold text-slate-500">לחץ לצפייה בפרטי פריטים</span>
        </div>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-sky-600 transform group-hover:translate-x-1 transition-all" />
      </div>
    </motion.div>
  );
};
