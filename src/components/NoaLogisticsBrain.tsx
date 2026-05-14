import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Brain, 
  Search, 
  Package, 
  Route as RouteIcon, 
  Zap, 
  Activity,
  Mic,
  Database,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Truck
} from 'lucide-react';
import { NoaChat } from './NoaChat';
import { Order } from '../types';
import { getLogisticsInsight, getTrafficRefinedRoute, analyzeLocationConsolidation } from '../services/auraService';

interface NoaLogisticsBrainProps {
  isOpen: boolean;
  onClose: () => void;
  chatHistory: any[];
  onAction: (action: string, file?: File | string) => void;
  orders: Order[];
}

export const NoaLogisticsBrain = ({
  isOpen,
  onClose,
  chatHistory,
  onAction,
  orders
}: NoaLogisticsBrainProps) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'insights'>('chat');
  const [smartInsight, setSmartInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    if (isOpen && orders.length > 0) {
      generateTopInsight();
    }
  }, [isOpen, orders]);

  const generateTopInsight = async () => {
    setLoadingInsight(true);
    try {
      // Pick the most recent pending order to analyze
      const recentOrder = orders.find(o => o.status === 'pending') || orders[0];
      if (recentOrder) {
        const insight = await getLogisticsInsight(recentOrder.customerName, recentOrder.destination);
        setSmartInsight(insight);
      }
    } catch (err) {
      console.error("Failed to generate insight:", err);
    } finally {
      setLoadingInsight(false);
    }
  };

  const handleOptimizedRoute = async () => {
    if (orders.length === 0) return;
    const dest = orders[0].destination;
    const traffic = await getTrafficRefinedRoute("הוד השרון", dest);
    onAction(`תכנני מסלול אופטימלי ל-${dest}. זמן נסיעה משוער כולל עומסים: ${traffic.estimatedMinutes} דקות.`);
  };

  const handleSpecialOrders = () => {
    onAction("תייגי את כל הפריטים שאינם במלאי כ'הזמנה מיוחדת' בדוח הבוקר.");
  };

  const handleAnalyzeLocation = async (dest: string) => {
    const consolidation = await analyzeLocationConsolidation(dest);
    if (consolidation.pendingOrders > 1) {
      onAction(`בצעי איחוד משלוחים ל-${dest}. נמצאו ${consolidation.pendingOrders} הזמנות פתוחות.`);
    } else {
      onAction(`נתחי את היסטוריית הפריקה והגישה ל-${dest}.`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="fixed inset-0 z-[1000] bg-[#F8FAFC] flex flex-col overflow-hidden"
          dir="rtl"
        >
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/50 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
            
            {/* Real-time Data Streams */}
            <div className="absolute left-10 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent">
               <motion.div 
                 animate={{ top: ['-10%', '110%'] }} 
                 transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                 className="absolute left-0 w-px h-20 bg-gold shadow-[0_0_10px_rgba(197,160,89,0.5)]" 
               />
            </div>
            <div className="absolute right-10 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent">
               <motion.div 
                 animate={{ top: ['110%', '-10%'] }} 
                 transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                 className="absolute right-0 w-px h-20 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]" 
               />
            </div>
          </div>

          {/* Header */}
          <header className="relative z-10 px-8 py-6 flex items-center justify-between border-b border-slate-200 bg-white/70 backdrop-blur-md">
            <div className="flex items-center gap-4">
               <button 
                 onClick={onClose}
                 className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 shadow-sm transition-all text-slate-400 hover:text-slate-900 group"
               >
                 <X size={24} className="group-active:scale-90 transition-transform" />
               </button>
               <div className="flex flex-col">
                  <h1 className="text-2xl font-black text-navy tracking-tighter italic uppercase">נועה - מוח לוגיסטי</h1>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SabanOS 6.0 | מצב דיוק מקסימלי</span>
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden lg:flex items-center gap-8">
                 {[
                   { label: 'Latency', value: '14ms', icon: Activity },
                   { label: 'Processing', value: 'Neural', icon: Database },
                   { label: 'Integrity', value: '100%', icon: ShieldCheck }
                 ].map((stat, i) => (
                   <div key={i} className="flex flex-col items-end">
                      <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {stat.label}
                        <stat.icon size={10} />
                      </div>
                      <span className="text-xs font-black text-navy">{stat.value}</span>
                   </div>
                 ))}
              </div>

               <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex gap-1 shadow-inner">
                 <button 
                  onClick={() => setActiveTab('chat')}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'chat' ? 'bg-navy text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
                 >
                   צ'אט מבצעי
                 </button>
                 <button 
                  onClick={() => setActiveTab('insights')}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'insights' ? 'bg-navy text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
                 >
                   תובנות אתר
                 </button>
               </div>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col md:flex-row relative z-10 overflow-hidden">
            {/* Sidebar Stats (Desktop) */}
            <div className="hidden xl:flex w-80 border-l border-slate-200 flex-col p-8 gap-8 overflow-y-auto bg-white/30">
               <div className="space-y-6">
                  <div>
                    <h3 className="text-[10px] font-black text-gold uppercase tracking-[0.3em] mb-4">עיבוד ליבה</h3>
                    <div className="relative aspect-square rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center justify-center overflow-hidden">
                       <motion.div 
                        animate={{ 
                          scale: [1, 1.15, 1],
                          opacity: [0.1, 0.3, 0.1]
                        }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="absolute inset-0 bg-gold/20 blur-3xl rounded-full"
                       />
                       <div className="relative">
                          <Brain size={80} className="text-navy shadow-2xl" strokeWidth={1.5} />
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
                            className="absolute -inset-4 border-2 border-dashed border-gold/40 rounded-full"
                          />
                       </div>
                    </div>
                  </div>

                  <div>
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">סטרימינג פעיל</h3>
                     <div className="space-y-3">
                        {orders.slice(0, 4).map((o, i) => (
                          <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-gold/30 hover:shadow-md transition-all group">
                             <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-black text-slate-900 group-hover:text-gold transition-colors truncate max-w-[120px]">{o.customerName}</span>
                                <span className="text-[8px] font-black text-gold bg-gold/5 px-1.5 py-0.5 rounded-md">#{o.id.slice(-4).toUpperCase()}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span className="text-[9px] font-bold text-slate-500">{o.destination}</span>
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 flex flex-col relative">
              <div className="flex-1 overflow-hidden p-4 md:p-8">
                {activeTab === 'chat' ? (
                  <NoaChat 
                    chatHistory={chatHistory}
                    onBack={onClose}
                    onAction={onAction}
                    orders={orders}
                    isPopup={true}
                    currentContext="general"
                  />
                ) : (
                  <div className="h-full flex flex-col gap-6 overflow-y-auto">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                          { title: 'חיפוש מלאי', icon: Package, desc: 'סנכרון מלאי מול הזמנות פתוחות', action: () => onAction("חיפוש מלאי לשבוע הקרוב") },
                          { title: 'ניתוח סל (Basket)', icon: Database, desc: 'זיהוי דפוסי רכישה והצעות משלימות', action: () => onAction("נתחי את סל הרכישות של הלקוח האחרון") },
                          { title: 'אופטימיזציית מסלול', icon: RouteIcon, desc: 'חישוב מסלול מבוסס עומסי תנועה + 25%', action: handleOptimizedRoute },
                        ].map((card, i) => (
                          <button 
                            key={i}
                            onClick={card.action}
                            className="p-8 bg-white border border-slate-100 rounded-[2rem] text-right hover:border-gold/30 hover:shadow-2xl hover:shadow-gold/10 transition-all group relative overflow-hidden shadow-sm"
                          >
                             <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <card.icon size={64} className="text-navy" />
                             </div>
                             <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-navy mb-6 group-hover:bg-gold group-hover:text-white transition-all">
                                <card.icon size={24} />
                             </div>
                             <h4 className="text-xl font-black text-navy mb-2">{card.title}</h4>
                             <p className="text-sm font-bold text-slate-500 leading-relaxed">{card.desc}</p>
                          </button>
                        ))}
                     </div>

                     <div className="mt-8 p-10 rounded-[3rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                        <div className="relative z-10">
                           <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 bg-gold/10 text-gold rounded-lg">
                                <Zap size={20} className="animate-pulse" />
                              </div>
                              <h3 className="text-2xl font-black text-navy italic tracking-tight">מנוע בינה לוגיסטי</h3>
                           </div>
                           
                           <div className="min-h-[100px] flex items-center">
                              {loadingInsight ? (
                                <div className="flex gap-2 items-center text-slate-400 font-bold italic">
                                   <div className="w-2 h-2 rounded-full bg-gold animate-bounce" />
                                   <div className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: '0.2s' }} />
                                   <div className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: '0.4s' }} />
                                   מעבד נתונים מהשטח...
                                </div>
                              ) : (
                                <p className="text-slate-500 max-w-2xl font-bold mb-8 italic leading-relaxed text-lg whitespace-pre-wrap">
                                  "{smartInsight || 'שלום המפקד ראמי. המערכת סורקת כעת את לוח ההזמנות כדי לזהות חריגות ותובנות לוגיסטיות.'}"
                                </p>
                              )}
                           </div>

                           <div className="flex flex-wrap gap-4 mt-4">
                              <button 
                                onClick={() => orders[0] && handleAnalyzeLocation(orders[0].destination)}
                                className="flex items-center gap-3 bg-navy text-white px-10 py-4 rounded-2xl font-black hover:bg-gold transition-all shadow-xl shadow-navy/20 active:scale-95"
                              >
                                  נתח יעד נוכחי
                                  <ChevronRight size={20} />
                              </button>
                              
                              <button 
                                onClick={generateTopInsight}
                                className="p-4 bg-slate-50 text-slate-400 hover:text-navy hover:bg-white rounded-2xl border border-slate-100 transition-all shadow-sm"
                                title="רענן תובנות"
                              >
                                <Activity size={20} />
                              </button>
                           </div>
                        </div>
                        <div className="absolute right-[-10%] bottom-[-20%] opacity-5">
                           <Brain size={400} className="text-navy" />
                        </div>
                     </div>
                  </div>
                )}
              </div>

              {/* Voice Wave Visualizer Footer */}
              {!activeTab && (
                <div className="h-24 bg-white border-t border-slate-100 flex items-center justify-between px-12 shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-navy shadow-inner">
                      <Mic size={24} />
                    </div>
                    <div className="flex items-end gap-1.5 h-8 px-4">
                       {[2, 5, 8, 4, 9, 3, 7, 5, 8, 4, 6, 2, 8, 5, 9, 3, 7, 4].map((h, i) => (
                         <motion.div 
                           key={i}
                           animate={{ height: [4, h * 3, 4] }}
                           transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05 }}
                           className="w-1 bg-navy/20 rounded-full"
                         />
                       ))}
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    משוב קולי פעיל • {chatHistory.length} מחזורי עבודה
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Signature */}
          <div className="absolute bottom-6 left-12 z-20 pointer-events-none">
            <span className="text-[10px] font-black text-slate-400 bg-white/50 backdrop-blur-md px-6 py-2.5 rounded-full border border-slate-200 shadow-sm">
              נועה | SabanOS 6.0 Intelligence ❤️
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


const CpuIcon = ({ size, className }: { size: number, className?: string }) => (
  <Database size={size} className={className} />
);
