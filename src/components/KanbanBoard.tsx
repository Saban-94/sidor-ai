import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Order, Driver } from '../types';
import { OrderCard } from './OrderCard';
import { cn } from '../lib/utils';
import { 
  Clock, 
  Truck, 
  CheckCircle2, 
  CheckCircle, 
  AlertCircle,
  Package,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Sparkles,
  Search,
  LayoutGrid,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';

interface KanbanBoardProps {
  orders: Order[];
  drivers: Driver[];
  searchQuery: string;
  onOrderEdit: (o: Order) => void;
  onOrderUpdateStatus: (id: string, s: Order['status']) => void;
  onOrderUpdateEta: (id: string, eta: string) => void;
  onOrderDelete: (id: string) => void;
  onOrderRepeat: (o: Order) => void;
  onOrderCreateCustomer?: (name: string, phone: string, address: string) => void;
  onAddToast: (title: string, msg: string, type?: any) => void;
  onUploadDoc: (file: File, orderId?: string, documentType?: any) => Promise<void>;
  inventoryItems?: any[];
  highlightedOrderId?: string | null;

  // Day browsing and date props
  startDate: Date;
  setStartDate: (d: Date) => void;
  endDate: Date;
  setEndDate: (d: Date) => void;
  isRangeMode: boolean;
  setIsRangeMode: (r: boolean) => void;
}

const statusConfig = [
  { status: 'pending', label: 'ממתינים (Pending)', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-950/20', border: 'border-amber-900/40', accent: 'bg-[#C5A059]' },
  { status: 'preparing', label: 'בהעמסה (Loading)', icon: Package, color: 'text-sky-400', bg: 'bg-sky-950/20', border: 'border-sky-900/40', accent: 'bg-sky-500' },
  { status: 'on_the_way', label: 'בדרך (En Route)', icon: Truck, color: 'text-indigo-400', bg: 'bg-indigo-950/20', border: 'border-indigo-900/40', accent: 'bg-indigo-500' },
  { status: 'delivered', label: 'סופק (Delivered)', icon: CheckCircle, color: 'text-[#34D399]', bg: 'bg-emerald-950/20', border: 'border-emerald-900/40', accent: 'bg-[#34D399]' },
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
  onOrderCreateCustomer,
  onAddToast,
  onUploadDoc,
  inventoryItems = [],
  highlightedOrderId,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isRangeMode,
  setIsRangeMode
}) => {
  // Mobile Column Tab selection
  const [activeMobileColumn, setActiveMobileColumn] = useState<Order['status']>('pending');

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Update status if it changed
    if (destination.droppableId !== source.droppableId) {
      const newStatus = destination.droppableId as Order['status'];
      const order = orders.find(o => o.id === draggableId);
      onOrderUpdateStatus(draggableId, newStatus);
      
      const label = statusConfig.find(s => s.status === newStatus)?.label;
      onAddToast('עדכון סידור', `ההזמנה של ${order?.customerName || draggableId.slice(-4)} הועברה ל-${label}`, 'success');
    }
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setStartDate(subDays(startDate, 1));
    } else {
      setStartDate(addDays(startDate, 1));
    }
  };

  const setToday = () => {
    setStartDate(new Date());
  };

  return (
    <div className="flex flex-col gap-4 w-full select-none" dir="rtl">
      
      {/* 📅 Advanced Day Browser & Header Dashboard */}
      <div className="w-full bg-[#1E293B] border-2 border-slate-800 rounded-[2.5rem] p-4 shadow-xl flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-[#C5A059] border border-amber-500/20">
              <Calendar size={18} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-black text-white leading-tight">ניהול סידור עבודה דינמי</h2>
              <span className="text-[10px] text-emerald-400 font-bold leading-none mt-0.5">נועה | מחוברת ✅</span>
            </div>
          </div>

          {/* Range Selection Mode Toggle Button */}
          <button 
            onClick={() => setIsRangeMode(!isRangeMode)}
            className={cn(
              "text-xs font-black px-3 py-1.5 rounded-xl transition-all border self-start sm:self-auto",
              isRangeMode 
                ? "bg-amber-500 text-slate-950 border-amber-400" 
                : "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-900"
            )}
          >
            {isRangeMode ? 'ביטול טווח תאריכים' : 'סינון לפי טווח תאריכים'}
          </button>
        </div>

        {/* Browser Nav Controls */}
        {!isRangeMode ? (
          <div className="flex items-center justify-between bg-slate-950 p-2 rounded-2xl border border-slate-850">
            {/* Prev Day Button */}
            <button 
              onClick={() => navigateDay('prev')} 
              className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all border border-slate-800"
              title="יום קודם"
            >
              <ChevronRight size={16} />
            </button>
            
            <div className="flex flex-col items-center">
              <span className="text-xs font-black text-white">{format(startDate, 'dd/MM/yyyy')}</span>
              <span className="text-[10px] font-bold text-amber-500 leading-none mt-0.5">
                {isSameDay(startDate, new Date()) ? 'היום (סבלנות מנצחת)' : format(startDate, 'EEEE', { locale: he })}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {!isSameDay(startDate, new Date()) && (
                <button 
                  onClick={setToday}
                  className="px-2 py-1 text-[9px] font-black bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 rounded-lg border border-emerald-900/40 transition-all"
                >
                  היום
                </button>
              )}
              {/* Next Day Button */}
              <button 
                onClick={() => navigateDay('next')} 
                className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all border border-slate-800"
                title="יום הבא"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-850">
            <div>
              <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-wider">מתאריך</label>
              <input 
                type="date" 
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-wider">עד תאריך</label>
              <input 
                type="date" 
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* 📱 Mobile Mode Tab Bar (Hidden on Desktop) */}
      <div className="flex sm:hidden overflow-x-auto gap-1 bg-[#1E293B] p-1 rounded-xl border border-slate-800 scrollbar-none mb-1">
        {statusConfig.map((col) => {
          const colOrders = orders.filter(o => {
            if (col.status === 'preparing') {
              return o.status === 'preparing' || o.status === 'ready';
            }
            return o.status === col.status;
          });
          const Icon = col.icon;
          const isActive = activeMobileColumn === col.status;

          return (
            <button
              key={col.status}
              onClick={() => setActiveMobileColumn(col.status)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-black whitespace-nowrap transition-all border",
                isActive 
                  ? "bg-slate-950 text-white border-amber-500/50 shadow-md" 
                  : "bg-transparent text-slate-400 border-transparent hover:text-slate-300"
              )}
            >
              <Icon size={12} className={cn(isActive ? col.color : "text-slate-500")} />
              <span>{col.label.split(' ')[0]}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-bold",
                isActive ? "bg-amber-500 text-slate-950" : "bg-slate-850 text-slate-400"
              )}>
                {colOrders.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* 📱 MOBILE VIEW: Swipeable active tab content */}
      <div className="block sm:hidden w-full">
        {statusConfig.map((col) => {
          if (activeMobileColumn !== col.status) return null;

          const colOrders = orders.filter(o => {
            if (col.status === 'preparing') {
              return o.status === 'preparing' || o.status === 'ready';
            }
            return o.status === col.status;
          });
          const Icon = col.icon;

          return (
            <div key={col.status} className="space-y-3">
              {/* Column Meta Detail */}
              <div className="bg-[#1E293B] p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", col.accent)} />
                  {col.label}
                </span>
                <span className="text-[10px] font-black text-amber-500">{colOrders.length} פריטים פתוחים</span>
              </div>

              {/* Mobile stacked lists */}
              <div className="space-y-3 min-h-[150px]">
                {colOrders.length === 0 ? (
                  <div className="bg-[#1E293B]/20 border-2 border-dashed border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                    <Icon size={28} className="text-slate-700 mb-2" />
                    <span className="text-xs font-black text-slate-400">אין משימות בעמודה זו</span>
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <OrderCard
                      key={order.id!}
                      order={order}
                      drivers={drivers}
                      allOrders={orders}
                      onEdit={onOrderEdit}
                      onUpdateStatus={onOrderUpdateStatus}
                      onUpdateEta={onOrderUpdateEta}
                      onDelete={onOrderDelete}
                      onRepeat={onOrderRepeat}
                      onCreateCustomer={onOrderCreateCustomer}
                      onAddToast={onAddToast}
                      onUploadDoc={onUploadDoc}
                      inventoryItems={inventoryItems}
                      isCompact={true}
                      isHighlighted={highlightedOrderId === order.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 🖥️ DESKTOP VIEW: Draggable & Droppable Board Columns */}
      <div className="hidden sm:block w-full">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-4 gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent select-none">
            {statusConfig.map((col) => {
              const colOrders = orders.filter(o => {
                if (col.status === 'preparing') {
                  return o.status === 'preparing' || o.status === 'ready';
                }
                return o.status === col.status;
              });
              const Icon = col.icon;

              return (
                <div 
                  key={col.status} 
                  className="flex flex-col min-w-[250px] bg-[#1E293B]/40 rounded-3xl border border-slate-800/80 p-2.5 h-[calc(100vh-280px)] overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="p-3 bg-[#1E293B] border border-slate-800 rounded-2xl flex items-center justify-between mb-3 shadow-md">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-6 rounded-full", col.accent)} />
                      <div className="flex flex-col">
                        <span className="font-black text-white text-xs tracking-tight">{col.label.split(' ')[0]}</span>
                        <span className="text-[9px] font-bold text-slate-400 capitalize leading-none mt-0.5">{colOrders.length} הזמנות</span>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center bg-slate-950 border border-slate-850">
                      <span className="text-[9px] font-black text-amber-500">{colOrders.length}</span>
                    </div>
                  </div>

                  {/* Droppable Orders Area */}
                  <Droppable droppableId={col.status}>
                    {(provided, snapshot) => (
                      <div 
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={cn(
                          "flex-1 space-y-3 p-1 transition-all duration-350 rounded-2xl overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800",
                          snapshot.isDraggingOver ? 'bg-slate-950/40 border border-amber-500/20 shadow-inner' : 'bg-transparent'
                        )}
                      >
                        <AnimatePresence mode="popLayout">
                          {colOrders.length === 0 && !snapshot.isDraggingOver ? (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/60 rounded-[2rem] bg-slate-900/10 group hover:border-slate-800 transition-colors"
                            >
                              <div className="bg-slate-900/60 p-2.5 rounded-full mb-1.5 group-hover:scale-105 transition-transform">
                                <Icon size={16} className="text-slate-600" />
                              </div>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">אין פעילות פתוחה</span>
                            </motion.div>
                          ) : (
                            colOrders.map((order, index) => (
                              // @ts-ignore
                              <Draggable key={order.id!} draggableId={order.id!} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={cn(
                                      "transition-all duration-200",
                                      snapshot.isDragging ? "rotate-1 scale-102 z-50 shadow-2xl cursor-grabbing" : "cursor-grab"
                                    )}
                                  >
                                    <motion.div
                                      layout
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                    >
                                      <OrderCard
                                        order={order}
                                        drivers={drivers}
                                        allOrders={orders}
                                        onEdit={onOrderEdit}
                                        onUpdateStatus={onOrderUpdateStatus}
                                        onUpdateEta={onOrderUpdateEta}
                                        onDelete={onOrderDelete}
                                        onRepeat={onOrderRepeat}
                                        onCreateCustomer={onOrderCreateCustomer}
                                        onAddToast={onAddToast}
                                        onUploadDoc={onUploadDoc}
                                        inventoryItems={inventoryItems}
                                        isCompact={true}
                                        isHighlighted={highlightedOrderId === order.id}
                                      />
                                    </motion.div>
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                        </AnimatePresence>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Dedicated Signature Panel */}
      <div className="text-center pt-2">
        <div className="signature text-xs text-[#C5A059] font-black tracking-widest">
          באדיבות נועה ❤️
        </div>
      </div>

    </div>
  );
};
