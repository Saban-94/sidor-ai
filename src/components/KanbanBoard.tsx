import React from 'react';
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
  AlertCircle
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
  inventoryItems?: any[];
}

const statusConfig = [
  { status: 'pending', label: 'ממתין לאישור', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', accent: 'bg-amber-500' },
  { status: 'preparing', label: 'בהכנה במחסן', icon: Truck, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100', accent: 'bg-sky-500' },
  { status: 'ready', label: 'מוכן להפצה', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'bg-emerald-500' },
  { status: 'delivered', label: 'סופק בהצלחה', icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100', accent: 'bg-green-500' },
  { status: 'cancelled', label: 'בוטל / נדחה', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', accent: 'bg-rose-500' },
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
  onUploadDoc,
  inventoryItems = []
}) => {
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

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent snap-x" dir="rtl" style={{ height: 'calc(100vh - 280px)' }}>
        {statusConfig.map((col) => {
          const colOrders = orders.filter(o => o.status === col.status);
          const Icon = col.icon;

          return (
            <div 
              key={col.status} 
              className="flex-shrink-0 w-[300px] flex flex-col h-full snap-start"
            >
              {/* Column Header */}
              <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm bg-white mb-3 sticky top-0 z-20`}>
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-8 rounded-full ${col.accent}`} />
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900 text-sm tracking-tight">{col.label}</span>
                    <span className="text-[10px] font-medium text-gray-400 capitalize">{colOrders.length} הזמנות</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-100`}>
                  <span className={`text-[10px] font-bold text-gray-500`}>{colOrders.length}</span>
                </div>
              </div>

              {/* Droppable Orders Area */}
              <Droppable droppableId={col.status}>
                {(provided, snapshot) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 space-y-3 p-1 transition-all duration-300 rounded-xl ${
                      snapshot.isDraggingOver ? 'bg-sky-50/50 ring-2 ring-sky-100 ring-inset' : 'bg-transparent'
                    }`}
                    style={{ minHeight: '100px' }}
                  >
                    <AnimatePresence mode="popLayout">
                      {colOrders.length === 0 && !snapshot.isDraggingOver ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-[2rem] bg-white group hover:border-sky-200 transition-colors"
                        >
                          <div className="bg-gray-50 p-3 rounded-full mb-2 group-hover:scale-110 transition-transform">
                            <Icon size={20} className="text-gray-200" />
                          </div>
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">אין פעילות פתוחה</span>
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
                                  snapshot.isDragging ? "rotate-2 scale-105 z-50 shadow-2xl cursor-grabbing" : "cursor-grab"
                                )}
                              >
                                <motion.div
                                  layout
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
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
                                    onAddToast={onAddToast}
                                    onUploadDoc={onUploadDoc}
                                    inventoryItems={inventoryItems}
                                    isCompact={true}
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
  );
};
