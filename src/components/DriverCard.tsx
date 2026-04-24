import React from 'react';
import { motion } from 'motion/react';
import { Truck, Phone, Star, TrendingUp, Package, AlertCircle, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { Order, Driver } from '../types';
import { OrderCard } from './OrderCard';
import { DriverPerformanceReport } from './DriverPerformanceReport';

interface DriverCardProps {
  driver: Driver;
  orders: Order[];
  allOrders: Order[];
  searchQuery?: string;
  onOrderEdit: (o: Order) => void;
  onOrderUpdateStatus: (id: string, s: any) => void;
  onOrderUpdateEta: (id: string, eta: string) => void;
  onOrderDelete: (id: string) => void;
  onOrderRepeat: (o: Order) => void;
  onOrderCreateCustomer?: (name: string, phone: string, address: string) => void;
  onAddToast: (title: string, msg: string, type?: any) => void;
  onUploadDoc?: (file: File, orderId?: string, documentType?: any) => Promise<void>;
  inventoryItems?: any[];
  isExpanded?: boolean;
  key?: React.Key;
}

export const DriverCard = ({
  driver,
  orders,
  allOrders,
  searchQuery = '',
  onOrderEdit,
  onOrderUpdateStatus,
  onOrderUpdateEta,
  onOrderDelete,
  onOrderRepeat,
  onOrderCreateCustomer,
  onAddToast,
  onUploadDoc,
  inventoryItems = [],
  isExpanded = true
}: DriverCardProps) => {
  const [showReport, setShowReport] = React.useState(false);
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const deliveryProgress = orders.length > 0 ? (deliveredCount / orders.length) * 100 : 0;

  const completedOrders = allOrders
    .filter(o => o.driverId === driver.id && o.status === 'delivered')
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden mb-8"
      dir="rtl"
    >
      {/* Header Info */}
      <div className="p-6 md:p-8 bg-gradient-to-br from-white to-sky-50/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`relative ${driver.avatar ? 'p-0 overflow-hidden' : 'p-5'} rounded-[2rem] shadow-inner ${driver.vehicleType === 'crane' ? 'bg-sky-100 text-sky-600' : 'bg-blue-100 text-blue-600'} w-20 h-20 flex items-center justify-center border-4 border-white shadow-lg`}>
              {driver.avatar ? (
                <img 
                  src={driver.avatar} 
                  alt={driver.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Truck size={36} strokeWidth={2.5} />
              )}
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">{driver.name}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <a 
                  href={`tel:${driver.phone}`} 
                  className="flex items-center gap-1.5 text-xs font-bold text-sky-600 bg-sky-50 px-3 py-1 rounded-full border border-sky-100 hover:bg-sky-100 transition-colors"
                >
                  <Phone size={12} />
                  {driver.phone}
                </a>
                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                  {driver.vehicleModel || 'משאית סבן'} | {driver.plateNumber || '00-000-00'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="text-center md:text-right">
              <div className="flex items-center gap-1 mb-1 justify-center md:justify-end">
                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">דירוג</span>
              </div>
              <p className="text-xl font-black text-gray-900">{driver.rating || 5.0}</p>
            </div>
            <div className="text-center md:text-right border-x border-gray-100 px-6">
              <div className="flex items-center gap-1 mb-1 justify-center md:justify-end">
                <TrendingUp size={14} className="text-green-500" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">עמידה בזמן</span>
              </div>
              <p className="text-xl font-black text-gray-900">{driver.onTimeRate || 100}%</p>
            </div>
            <div className="text-center md:text-right">
              <div className="flex items-center gap-1 mb-1 justify-center md:justify-end">
                <Package size={14} className="text-sky-500" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">סופקו</span>
              </div>
              <p className="text-xl font-black text-gray-900">{driver.totalDeliveries || 0}</p>
            </div>
          </div>
        </div>

        {/* Action Tabs for Card */}
        <div className="mt-8 flex gap-3">
          <button 
            onClick={() => setShowReport(!showReport)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all border ${
              showReport 
                ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-600/20' 
                : 'bg-white border-gray-100 text-gray-500 hover:bg-sky-50 hover:text-sky-600'
            }`}
          >
            <BarChart3 size={18} />
            {showReport ? 'סגור דוח ביצועים' : 'פתח דוח ביצועים ודירוג'}
            {showReport ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Report Section */}
        {showReport && (
          <div className="mt-8 pt-8 border-t border-gray-100">
            <DriverPerformanceReport 
              driver={driver} 
              completedOrders={completedOrders} 
            />
          </div>
        )}

        {/* Delivery Progress Bar */}
        {!showReport && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">התקדמות יומית</span>
              <span className="text-[11px] font-black text-sky-600">{deliveredCount}/{orders.length} משלוחים שהושלמו</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${deliveryProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full ${deliveryProgress === 100 ? 'bg-green-500' : 'bg-sky-500'} shadow-[0_0_10px_rgba(14,165,233,0.3)]`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Orders List */}
      <div className="p-6 md:p-8 bg-gray-50/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-sky-500 rounded-full" />
          <h3 className="text-lg font-black text-gray-900">הזמנות פעילות ליומי</h3>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 p-10 rounded-[2rem] text-center">
            <AlertCircle size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-bold text-gray-400 italic">אין הזמנות מתוכננות לנהג זה להיום</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                drivers={[driver]}
                allOrders={allOrders}
                searchQuery={searchQuery}
                onEdit={onOrderEdit}
                onUpdateStatus={onOrderUpdateStatus}
                onUpdateEta={onOrderUpdateEta}
                onDelete={onOrderDelete}
                onRepeat={onOrderRepeat}
                onCreateCustomer={onOrderCreateCustomer}
                onAddToast={onAddToast}
                onUploadDoc={onUploadDoc}
                inventoryItems={inventoryItems}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
