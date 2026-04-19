import React from 'react';
import { motion } from 'motion/react';
import { Order, Driver } from '../types';
import { OrderCard } from './OrderCard';
import { 
  Clock, 
  Truck, 
  CheckCircle2, 
  CheckCircle, 
  AlertCircle,
  MoreVertical
} from 'lucide-react';

interface KanbanBoardProps {
  orders: Order[];
  drivers: Driver[];
  searchQuery: string;
  onOrderEdit: (o: Order) => void;
  onOrderUpdateStatus: (id: string, s: Order['status']) => void;
  onOrderUpdateEta: (id: string, eta: string) => void;
  onOrderDelete: (id: string) => void;
  onOrderRepeat: (o: Order) => void;
  onAddToast: (title: string, msg: string, type?: any) => void;
  onUploadDoc: (file: File, orderId?: string, documentType?: any) => Promise<void>;
}

const statusConfig = [
  { status: 'pending', label: 'ממתין', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
  { status: 'preparing', label: 'בהכנה', icon: Truck, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
  { status: 'ready', label: 'מוכן ✅', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { status: 'delivered', label: 'סופק', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
  { status: 'cancelled', label: 'בוטל', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
] as const;

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  orders,
  drivers,
  searchQuery,
  onOrderEdit,
  onOrderUpdateStatus,
  onOrderUpdateEta,
  onOrderDelete,
  onOrderRepeat,
  onAddToast,
  onUploadDoc
}) => {
  return (
    <div className="flex gap-6 overflow-x-auto pb-8 min-h-[calc(100vh-350px)]" dir="rtl">
      {statusConfig.map((col) => {
        const colOrders = orders.filter(o => o.status === col.status);
        const Icon = col.icon;

        return (
          <div 
            key={col.status} 
            className="flex-shrink-0 w-80 flex flex-col"
          >
            {/* Column Header */}
            <div className={`p-4 rounded-2xl border-b-2 mb-4 flex items-center justify-between ${col.bg} ${col.border}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white shadow-sm ${col.color}`}>
                  <Icon size={18} />
                </div>
                <span className="font-black text-gray-900">{col.label}</span>
                <span className="bg-white/50 px-2 py-0.5 rounded-full text-[10px] font-black text-gray-400">
                  {colOrders.length}
                </span>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical size={16} />
              </button>
            </div>

            {/* Orders List */}
            <div className="flex-1 space-y-4">
              {colOrders.length === 0 ? (
                <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-[2.5rem] bg-gray-50/30">
                  <span className="text-xs font-bold text-gray-300 italic">אין הזמנות אחי</span>
                </div>
              ) : (
                colOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <OrderCard
                      order={order}
                      drivers={drivers}
                      allOrders={orders}
                      searchQuery={searchQuery}
                      onEdit={onOrderEdit}
                      onUpdateStatus={onOrderUpdateStatus}
                      onUpdateEta={onOrderUpdateEta}
                      onDelete={onOrderDelete}
                      onRepeat={onOrderRepeat}
                      onAddToast={onAddToast}
                      onUploadDoc={onUploadDoc}
                      isCompact={true}
                    />
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
