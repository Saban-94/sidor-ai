import React from 'react';
import { motion } from 'motion/react';
import { 
  Trophy, 
  Clock, 
  Star, 
  PackageCheck, 
  History,
  Calendar,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { Driver, Order } from '../types';

interface DriverPerformanceReportProps {
  driver: Driver;
  completedOrders: Order[];
}

export const DriverPerformanceReport: React.FC<DriverPerformanceReportProps> = ({ 
  driver, 
  completedOrders 
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500" dir="rtl">
      {/* Performance Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { 
            label: 'סך הכל משלוחים', 
            value: driver.totalDeliveries || 0, 
            icon: Trophy, 
            color: 'text-amber-500', 
            bg: 'bg-amber-50' 
          },
          { 
            label: 'עמידה בזמנים', 
            value: `${driver.onTimeRate || 100}%`, 
            icon: Clock, 
            color: 'text-emerald-500', 
            bg: 'bg-emerald-50' 
          },
          { 
            label: 'דירוג כללי', 
            value: driver.rating || 5.0, 
            icon: Star, 
            color: 'text-yellow-500', 
            bg: 'bg-yellow-50' 
          },
          { 
            label: 'הזמנות שהושלמו', 
            value: completedOrders.length, 
            icon: PackageCheck, 
            color: 'text-sky-500', 
            bg: 'bg-sky-50' 
          },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className={`p-2 rounded-xl w-fit mb-3 ${stat.bg} ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-xl font-black text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
          <div className="flex items-center gap-3">
            <div className="bg-sky-600 p-2 rounded-xl text-white">
              <History size={18} />
            </div>
            <h4 className="text-lg font-black text-gray-900">הזמנות אחרונות שהושלמו אחי</h4>
          </div>
          <span className="text-xs font-bold text-sky-600 bg-sky-50 px-3 py-1 rounded-full border border-sky-100">
            {completedOrders.length} מסירות
          </span>
        </div>

        <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
          {completedOrders.length === 0 ? (
            <div className="p-12 text-center">
              <PackageCheck size={40} className="mx-auto text-gray-100 mb-3" />
              <p className="text-gray-400 font-bold">אין עדיין הזמנות שהושלמו ברשימה אחי</p>
            </div>
          ) : (
            completedOrders.slice(0, 10).map((order) => (
              <div key={order.id} className="p-5 hover:bg-sky-50/30 transition-colors flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-green-50 p-2.5 rounded-full text-green-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 leading-tight mb-1">{order.customerName}</p>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {order.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {order.destination}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-gray-900">#{order.orderNumber || '0000'}</p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">נמסר בהצלחה</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
