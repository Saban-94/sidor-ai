import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg, EventDragStopArg } from '@fullcalendar/interaction';
import { Order, Driver } from '../types';
import { motion } from 'motion/react';
import { useToast } from '../providers/ToastProvider';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Truck, Calendar as CalendarIcon, User, Package } from 'lucide-react';

interface DeliveryCalendarProps {
  orders: Order[];
  drivers: Driver[];
  onOrderUpdate: (id: string, updates: Partial<Order>) => Promise<void>;
  onOrderClick: (order: Order) => void;
}

export const DeliveryCalendar: React.FC<DeliveryCalendarProps> = ({
  orders,
  drivers,
  onOrderUpdate,
  onOrderClick
}) => {
  const { addToast } = useToast();

  const events = orders.map(order => {
    const driver = drivers.find(d => d.id === order.driverId);
    return {
      id: order.id,
      title: `${order.customerName} | ${order.items}`,
      start: order.date, // YYYY-MM-DD
      extendedProps: {
        order,
        driverName: driver?.name || 'ללא נהג'
      },
      backgroundColor: order.status === 'delivered' ? '#16a34a' : 
                      order.status === 'on_the_way' ? '#4f46e5' : 
                      order.status === 'preparing' ? '#0ea5e9' : '#f59e0b',
      borderColor: 'transparent',
      className: 'saban-calendar-event'
    };
  });

  const handleEventDrop = async (info: any) => {
    const { event } = info;
    const newDate = format(event.start!, 'yyyy-MM-dd');
    const orderId = event.id;
    
    try {
      await onOrderUpdate(orderId, { date: newDate });
      addToast('מועד עודכן', `ההזמנה הוזזה ל-${format(event.start!, 'dd/MM/yyyy')}`, 'success');
    } catch (error: any) {
      info.revert();
      addToast('שגיאה בעדכון', error.message, 'warning');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-8 h-full flex flex-col gap-6"
      dir="rtl"
    >
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-navy flex items-center justify-center text-gold shadow-lg shadow-navy/20">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">לוח הפצה ומשימות</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bridging Logistics & Time</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span className="text-[10px] font-bold text-slate-600">ממתין</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-2 h-2 rounded-full bg-[#0ea5e9]" />
            <span className="text-[10px] font-bold text-slate-600">בהעמסה</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-2 h-2 rounded-full bg-[#4f46e5]" />
            <span className="text-[10px] font-bold text-slate-600">בדרך</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-2 h-2 rounded-full bg-[#16a34a]" />
            <span className="text-[10px] font-bold text-slate-600">סופק</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden custom-full-calendar">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            start: 'prev,next today',
            center: 'title',
            end: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          locale="he"
          direction="rtl"
          events={events}
          editable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventClick={(info) => onOrderClick(info.event.extendedProps.order)}
          height="100%"
          eventContent={(eventInfo) => {
            const { driverName } = eventInfo.event.extendedProps;
            const order = eventInfo.event.extendedProps.order as Order;
            return (
              <div className="p-1 px-2 flex flex-col gap-0.5 overflow-hidden">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-[10px] truncate">{order.customerName}</span>
                  <span className="text-[8px] opacity-70">{order.time}</span>
                </div>
                <div className="flex items-center gap-1 opacity-80">
                  <Truck size={8} />
                  <span className="text-[8px] font-bold truncate">{driverName}</span>
                </div>
              </div>
            );
          }}
        />
      </div>

      <style>{`
        .custom-full-calendar .fc {
          font-family: inherit;
          --fc-border-color: #f1f5f9;
          --fc-today-bg-color: #f8fafc;
          --fc-page-bg-color: transparent;
        }
        .custom-full-calendar .fc-header-toolbar {
          margin-bottom: 2rem !important;
          padding: 0 0.5rem;
        }
        .custom-full-calendar .fc-toolbar-title {
          font-weight: 900 !important;
          font-size: 1.25rem !important;
          text-transform: uppercase;
          letter-spacing: -0.025em;
          color: #0f172a;
        }
        .custom-full-calendar .fc-button {
          background: #white !important;
          border: 1px solid #e2e8f0 !important;
          color: #64748b !important;
          font-weight: 800 !important;
          font-size: 0.75rem !important;
          padding: 0.5rem 1rem !important;
          border-radius: 0.75rem !important;
          text-transform: uppercase;
          transition: all 0.2s;
        }
        .custom-full-calendar .fc-button-active {
          background: #0f172a !important;
          color: white !important;
          border-color: #0f172a !important;
        }
        .custom-full-calendar .fc-button:hover:not(.fc-button-active) {
          background: #f8fafc !important;
          color: #0f172a !important;
        }
        .custom-full-calendar .fc-col-header-cell {
          padding: 1rem 0 !important;
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0 !important;
        }
        .custom-full-calendar .fc-col-header-cell-cushion {
          font-size: 10px !important;
          font-weight: 900 !important;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #94a3b8 !important;
          text-decoration: none !important;
        }
        .custom-full-calendar .fc-daygrid-day-number {
          font-size: 0.75rem !important;
          font-weight: 800 !important;
          padding: 0.75rem !important;
          color: #64748b;
          text-decoration: none !important;
        }
        .custom-full-calendar .fc-day-today .fc-daygrid-day-number {
          color: #4f46e5 !important;
          font-size: 1.25rem !important;
        }
        .fc-event {
          border-radius: 0.5rem !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important;
          margin: 1px 2px !important;
          border: none !important;
        }
        .fc-v-event {
          background-color: var(--fc-event-bg-color) !important;
        }
      `}</style>
    </motion.div>
  );
};
