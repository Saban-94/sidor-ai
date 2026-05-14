import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Brain, 
  Zap, 
  Activity,
  Database,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Cpu,
  Globe,
  Trash2,
  Settings as SettingsIcon
} from 'lucide-react';
import { NoaChat } from './NoaChat';
import { Order } from '../types';
import { getLogisticsInsight, getTrafficRefinedRoute } from '../services/auraService';

interface NoaChatHubProps {
  isOpen: boolean;
  onClose: () => void;
  chatHistory: any[];
  onAction: (action: string, file?: File | string) => void;
  onClearHistory?: () => void;
  orders: Order[];
  onOrderView?: (order: Order) => void;
}

export const NoaChatHub = ({
  isOpen,
  onClose,
  chatHistory,
  onAction,
  onClearHistory,
  orders,
  onOrderView
}: NoaChatHubProps) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'performance'>('chat');
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
      const recentOrder = orders.find(o => o.status === 'pending') || orders[0];
      if (recentOrder) {
        const insight = await getLogisticsInsight(recentOrder.customerName, recentOrder.destination);
        setSmartInsight(insight);
      }
    } catch (err) {
      console.error("Noa Hub Insight Error:", err);
    } finally {
      setLoadingInsight(false);
    }
  };

  const handleTrafficAudit = async () => {
    if (orders.length === 0) return;
    const dest = orders[0].destination;
    const traffic = await getTrafficRefinedRoute("הוד השרון", dest);
    onAction(`בצעי ניתוח תנועה ל-${dest}. סטטוס: ${traffic.estimatedMinutes} דקות (+25% Buffer).`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[2000] bg-white flex flex-col overflow-hidden w-full h-full"
          dir="rtl"
        >
          {/* Main Visual Component - Optimizing for Mobile */}
          <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden w-full" dir="rtl">
            {/* Mobile/Desktop Integrated Header */}
            <header className="flex items-center justify-between px-6 py-5 border-b-2 border-slate-100 bg-white/95 backdrop-blur-md sticky top-0 z-50 shrink-0">
               <div className="flex items-center gap-5">
                 <button 
                  onClick={onClose}
                  className="w-14 h-14 flex items-center justify-center bg-navy text-white rounded-2xl border-2 border-navy active:scale-90 transition-all shadow-lg"
                 >
                   <X size={28} />
                 </button>
                 <div className="flex flex-col">
                   <h2 className="text-xl font-black text-navy italic leading-none mb-1">נועה | SabanOS Intelligence</h2>
                   <div className="flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-400" />
                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Global Logix Node Active</span>
                   </div>
                 </div>
               </div>
               
               <div className="flex gap-3">
                 {onClearHistory && activeTab === 'chat' && (
                   <button 
                     onClick={onClearHistory}
                     className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center border-2 border-red-100 active:scale-95 transition-all"
                     title="ניקוי היסטוריה"
                   >
                     <Trash2 size={24} />
                   </button>
                 )}
                 <button 
                   onClick={handleTrafficAudit} 
                   className="w-14 h-14 bg-white text-navy border-2 border-navy/10 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                 >
                   <Globe size={24} />
                 </button>
               </div>
            </header>

            {/* Content Switcher - 100% Viewport Height Optimization */}
            <main className="flex-1 overflow-hidden w-full relative bg-white">
               {activeTab === 'chat' && (
                 <div className="h-full w-full">
                    <NoaChat 
                      chatHistory={chatHistory}
                      onBack={onClose}
                      onAction={onAction}
                      onClearHistory={onClearHistory}
                      orders={orders}
                      onOrderView={onOrderView}
                      isPopup={true}
                    />
                 </div>
               )}

               {activeTab === 'insights' && (
                 <div className="h-full overflow-y-auto px-6 py-10 space-y-10 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[
                        { title: 'ניתוח עומסי תנועה', icon: Globe, desc: 'חיזוי זמני הגעה בזמן אמת (Real-time ETA Monitor)', action: handleTrafficAudit },
                        { title: 'אימות היסטוריית מיקומים', icon: ShieldCheck, desc: 'סריקת צמתים לוגיסטיים ומאגרי מידע (GPS Validation)', action: () => onAction("נתחי את אמינות הנתונים בסידור") },
                        { title: 'אופטימיזציית משאבים', icon: Cpu, desc: 'חישוב נצילות משאיות מול קריאות מנוף (Resource Efficiency)', action: () => onAction("בצעי אופטימיזציית משאבים להיום") },
                      ].map((card, i) => (
                        <button 
                          key={i}
                          onClick={card.action}
                          className="bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-xl hover:shadow-navy/5 hover:border-navy transition-all text-right group flex flex-col items-start"
                        >
                          <div className="w-16 h-16 bg-navy text-white rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all shadow-lg">
                            <card.icon size={28} />
                          </div>
                          <h4 className="text-xl font-black text-navy mb-2 leading-tight">{card.title}</h4>
                          <p className="text-base font-bold text-slate-500 leading-relaxed">{card.desc}</p>
                        </button>
                      ))}
                    </div>

                    <div className="p-10 rounded-[3rem] bg-navy text-white relative overflow-hidden shadow-2xl shadow-navy/30">
                       <div className="relative z-10">
                          <h3 className="text-2xl font-black italic mb-6 leading-tight">Advanced Logistics Insight</h3>
                          <div className="space-y-4 mb-10">
                             {loadingInsight ? (
                               <div className="flex gap-3 py-4">
                                  <div className="w-3 h-3 bg-gold/50 rounded-full animate-bounce" />
                                  <div className="w-3 h-3 bg-gold/50 rounded-full animate-bounce delay-100" />
                                  <div className="w-3 h-3 bg-gold/50 rounded-full animate-bounce delay-200" />
                               </div>
                             ) : (
                               <p className="text-xl font-bold text-white/95 leading-relaxed italic max-w-4xl">
                                  "{smartInsight || 'המערכת ממתינה לפקודה ממך, המפקד ראמי. מה ברצונך לבצע?'}"
                                </p>
                             )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <button 
                               onClick={() => { setActiveTab('chat'); onAction("תכיני דוח בוקר HTML מעוצב"); }}
                               className="bg-gold text-navy px-10 py-5 rounded-2xl font-black hover:bg-white transition-all text-lg shadow-xl"
                             >
                               הפק דוח בוקר Enterprise
                             </button>
                             <button 
                               onClick={generateTopInsight}
                               className="bg-white/10 text-white px-10 py-5 rounded-2xl font-black hover:bg-white/20 transition-all text-lg border-2 border-white/20"
                             >
                               רענן ניתוח בינה מלאכותית
                             </button>
                          </div>
                       </div>
                       <Brain size={400} className="absolute -bottom-40 -left-40 text-white/5 rotate-12" />
                    </div>
                 </div>
               )}

               {activeTab === 'performance' && (
                 <div className="p-12 flex flex-col items-center justify-center h-full text-center space-y-6">
                    <div className="w-24 h-24 bg-navy/5 rounded-[2.5rem] flex items-center justify-center text-navy mb-4 shadow-inner">
                       <TrendingUp size={56} />
                    </div>
                    <h3 className="text-3xl font-black text-navy italic">ניתוח ביצועים בבנייה</h3>
                    <p className="text-xl font-bold text-slate-400 max-w-md mx-auto leading-relaxed">נועה מעבדת את נתוני העבר כדי לבנות מודל חיזוי רווחיות (Predictive ROI Model).</p>
                 </div>
               )}
            </main>

            {/* Floating Navigation Bar - Mobile Exclusive Interaction */}
            <div className="shrink-0 bg-white border-t-2 border-slate-100 px-8 py-5 flex justify-between items-center gap-6 z-50 shadow-[0_-15px_40px_rgba(30,58,138,0.08)]">
               {[
                 { id: 'chat', icon: Activity, label: 'צ\'אט' },
                 { id: 'insights', icon: Zap, label: 'תובנות' },
                 { id: 'performance', icon: TrendingUp, label: 'KPI' },
               ].map(nav => (
                 <button 
                   key={nav.id}
                   onClick={() => setActiveTab(nav.id as any)}
                   className={`flex-1 flex flex-col items-center gap-2 transition-all ${
                     activeTab === nav.id ? 'text-navy scale-110' : 'text-slate-200'
                   }`}
                 >
                   <div className={`w-16 h-14 rounded-2xl flex items-center justify-center transition-all ${
                     activeTab === nav.id ? 'bg-navy/5 shadow-inner' : 'bg-transparent'
                   }`}>
                     <nav.icon size={26} strokeWidth={activeTab === nav.id ? 4 : 2} />
                   </div>
                   <span className={`text-xs font-black uppercase tracking-widest ${activeTab === nav.id ? 'opacity-100' : 'opacity-0'}`}>
                     {nav.label}
                   </span>
                 </button>
               ))}
            </div>

            <footer className="hidden lg:flex items-center justify-between px-10 py-5 bg-navy text-white shrink-0">
               <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest leading-none">
                 <ShieldCheck size={18} className="text-gold" />
                 Secure Management Hub • SabanOS v6.5.0
               </div>
               <span className="text-xs font-black italic opacity-60">SABAN ENTERPRISE LOGISTICS INFRASTRUCTURE • נועה ❤️</span>
            </footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
