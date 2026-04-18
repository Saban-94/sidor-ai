import React from 'react';
import { motion } from 'motion/react';
import { Truck } from 'lucide-react';
import { Order, Driver } from '../services/auraService';
import { OrderCard } from './OrderCard';
import { DriverCard } from './DriverCard';

interface DriverListProps {
  orders: Order[];
  drivers: Driver[];
  onOrderEdit: (o: Order) => void;
  onOrderUpdateStatus: (id: string, s: any) => void;
  onOrderUpdateEta: (id: string, eta: string) => void;
  onOrderDelete: (id: string) => void;
  onAddToast: (title: string, msg: string, type?: any) => void;
  onDriverSelect?: (driverId: string) => void;
  selectedDriverId?: string | null;
  searchQuery?: string;
}

export const DriverList = ({ 
  orders, 
  drivers,
  onOrderEdit, 
  onOrderUpdateStatus, 
  onOrderUpdateEta, 
  onOrderDelete, 
  onAddToast,
  onDriverSelect,
  selectedDriverId,
  searchQuery = ''
}: DriverListProps) => {

  const driversWithStats = drivers.map(driver => {
    const driverOrders = orders.filter(o => o.driverId === driver.id);
    const deliveredCount = driverOrders.filter(o => o.status === 'delivered').length;
    return {
      ...driver,
      orders: driverOrders,
      stats: {
        total: driverOrders.length,
        delivered: deliveredCount,
        pending: driverOrders.length - deliveredCount
      }
    };
  });

  return (
    <div className="space-y-8" dir="rtl">
      {/* Driver Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {driversWithStats.map(driver => (
          <motion.button
            key={driver.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onDriverSelect?.(driver.id)}
            className={`p-6 rounded-[2.5rem] border transition-all text-right shadow-sm relative overflow-hidden ${
              selectedDriverId === driver.id 
                ? 'bg-sky-600 border-sky-600 text-white shadow-sky-200' 
                : 'bg-white border-gray-100 text-gray-900 group hover:border-sky-200'
            }`}
          >
            {/* Performance Bar */}
            <div className="absolute top-0 right-0 left-0 h-1 bg-gray-100/10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${driver.onTimeRate || 100}%` }}
                className={`h-full ${selectedDriverId === driver.id ? 'bg-white/40' : 'bg-green-500'}`}
              />
            </div>

            <div className="flex items-center justify-between mb-4 mt-2">
              <div className={`p-3 rounded-2xl ${
                selectedDriverId === driver.id ? 'bg-white/20' : 'bg-sky-50 text-sky-600'
              }`}>
                {driver.vehicleType === 'crane' ? <Truck size={24} /> : <Truck size={24} />}
              </div>
              <div className="flex flex-col items-end gap-1">
                 <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                   selectedDriverId === driver.id ? 'border-white/20 bg-white/10' : 'bg-gray-100 border-gray-200 text-gray-500'
                 }`}>
                   {driver.stats.delivered}/{driver.stats.total} משלוחים
                 </span>
                 <span className={`text-[9px] font-bold ${selectedDriverId === driver.id ? 'text-white/60' : 'text-gray-400'}`}>
                   {driver.vehicleModel || 'משאית סבן'} | {driver.plateNumber || '00-000-00'}
                 </span>
              </div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-xl font-black mb-1">{driver.name}</h3>
              <p className={`text-xs font-bold ${selectedDriverId === driver.id ? 'text-white/70' : 'text-sky-600'}`}>
                {driver.phone}
              </p>
            </div>

            <div className={`grid grid-cols-3 gap-2 pt-4 border-t ${selectedDriverId === driver.id ? 'border-white/10' : 'border-gray-50'}`}>
              <div className="text-center">
                <p className={`text-[9px] font-black uppercase mb-0.5 ${selectedDriverId === driver.id ? 'text-white/50' : 'text-gray-400'}`}>עמידה בזמן</p>
                <p className="text-sm font-black">{driver.onTimeRate || 100}%</p>
              </div>
              <div className="text-center border-x border-white/10 px-1">
                <p className={`text-[9px] font-black uppercase mb-0.5 ${selectedDriverId === driver.id ? 'text-white/50' : 'text-gray-400'}`}>דירוג</p>
                <p className="text-sm font-black text-yellow-500">★ {driver.rating || 5.0}</p>
              </div>
              <div className="text-center">
                <p className={`text-[9px] font-black uppercase mb-0.5 ${selectedDriverId === driver.id ? 'text-white/50' : 'text-gray-400'}`}>סה"כ מסירות</p>
                <p className="text-sm font-black">{driver.totalDeliveries || 0}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Detailed Driver Cards with Orders */}
      <div className="pt-4">
        {driversWithStats
          .filter(d => !selectedDriverId || d.id === selectedDriverId)
          .filter(d => d.orders.length > 0)
          .map(driver => (
            <DriverCard
              key={driver.id}
              driver={driver}
              orders={driver.orders}
              allOrders={orders}
              searchQuery={searchQuery}
              onOrderEdit={onOrderEdit}
              onOrderUpdateStatus={onOrderUpdateStatus}
              onOrderUpdateEta={onOrderUpdateEta}
              onOrderDelete={onOrderDelete}
              onAddToast={onAddToast}
            />
          ))}
      </div>
    </div>
  );
};
