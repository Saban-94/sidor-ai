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
          className="fixed inset-0 z-[2000] bg-white flex flex-col overflow-hidden"
          dir="rtl"
        >
          {/* Main Visual Component - Optimizing for Mobile */}
          <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden" dir="rtl">
            {/* Mobile/Desktop Integrated Header */}
            <header className="flex items-center justify-between px-6 py-5 border-b-2 border-slate-100 bg-white sticky top-0 z-50 shrink-0">
               <div className="flex items-center gap-5">
                 <button 
                  onClick={onClose}
                  className="w-14 h-14 flex items-center justify-center bg-navy text-white rounded-2xl border-2 border-navy active:scale-90 transition-all shadow-lg"
                 >
                   <X size={28} />
                 </button>
                 <div className="flex flex-col">
                   <h2 className="text-xl font-black text-navy italic leading-snug">נועה | SabanOS Intelligence</h2>
                   <div className="flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-200" />
                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Core Node Active</span>
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
            <main className="flex-1 overflow-hidden w-full relative bg-slate-50/10">
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
                 <div className="h-full overflow-y-auto px-5 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {[
                        { title: 'ניתוח עומסי תנועה', icon: Globe, desc: 'חיזוי זמני הגעה בזמן אמת (Real-time ETA)', action: handleTrafficAudit },
                        { title: 'אימות היסטוריית מיקומים', icon: ShieldCheck, desc: 'סריקת צמתים לוגיסטיים ומאגרי מידע', action: () => onAction("נתחי את אמינות הנתונים בסידור") },
                        { title: 'אופטימיזציית משאבים', icon: Cpu, desc: 'חישוב נצילות משאיות מול קריאות מנוף', action: () => onAction("בצעי אופטימיזציית משאבים להיום") },
                      ].map((card, i) => (
                        <button 
                          key={i}
                          onClick={card.action}
                          className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-navy/5 hover:border-navy/20 transition-all text-right group flex flex-col items-start"
                        >
                          <div className="w-14 h-14 bg-navy/5 rounded-2xl flex items-center justify-center text-navy mb-5 group-hover:bg-navy group-hover:text-white transition-all shadow-sm">
                            <card.icon size={26} />
                          </div>
                          <h4 className="text-lg font-black text-navy mb-2 leading-tight">{card.title}</h4>
                          <p className="text-sm font-bold text-slate-400 leading-relaxed">{card.desc}</p>
                        </button>
                      ))}
                    </div>

                    <div className="p-8 rounded-[2.5rem] bg-navy text-white relative overflow-hidden shadow-2xl shadow-navy/20">
                       <div className="relative z-10">
                          <h3 className="text-2xl font-black italic mb-4 leading-tight">Enterprise Logistics Insight</h3>
                          <div className="space-y-4 mb-8">
                             {loadingInsight ? (
                               <div className="flex gap-2.5 py-4">
                                  <div className="w-2.5 h-2.5 bg-gold/50 rounded-full animate-bounce" />
                                  <div className="w-2.5 h-2.5 bg-gold/50 rounded-full animate-bounce delay-100" />
                                  <div className="w-2.5 h-2.5 bg-gold/50 rounded-full animate-bounce delay-200" />
                               </div>
                             ) : (
                               <p className="text-lg font-bold text-white/90 leading-relaxed italic max-w-2xl">
                                  "{smartInsight || 'המערכת ממתינה לפקודה ממך, המפקד ראמי. מה ברצונך לבצע?'}"
                                </p>
                             )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:flex">
                             <button 
                              onClick={() => { setActiveTab('chat'); onAction("תכיני דוח בוקר HTML מעוצב"); }}
                              className="bg-gold text-navy px-8 py-4 rounded-2xl font-black hover:scale-[1.02] active:scale-95 transition-all text-base shadow-lg shadow-gold/20"
                             >
                               הפק דוח בוקר חכם
                             </button>
                             <button 
                              onClick={generateTopInsight}
                              className="bg-white/10 text-white px-8 py-4 rounded-2xl font-black hover:bg-white/20 active:scale-95 transition-all text-base border border-white/10"
                             >
                               רענן ניתוח אלגוריתמי
                             </button>
                          </div>
                       </div>
                       <Brain size={300} className="absolute -bottom-20 -left-20 text-white/5 rotate-12" />
                    </div>
                 </div>
               )}

               {activeTab === 'performance' && (
                 <div className="p-10 flex flex-col items-center justify-center h-full text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-2">
                       <TrendingUp size={48} />
                    </div>
                    <h3 className="text-2xl font-black text-navy italic">ניתוח ביצועים בבנייה</h3>
                    <p className="text-base font-bold text-slate-400 max-w-xs mx-auto leading-relaxed">נועה מעבדת את נתוני העבר כדי לבנות מודל חיזוי רווחיות (Predictive ROI).</p>
                 </div>
               )}
            </main>

            {/* Floating Navigation Bar - Mobile Exclusive */}
            <div className="lg:hidden shrink-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center gap-4 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
               {[
                 { id: 'chat', icon: Activity, label: 'צ\'אט' },
                 { id: 'insights', icon: Zap, label: 'תובנות' },
                 { id: 'performance', icon: TrendingUp, label: 'מדדים' },
               ].map(nav => (
                 <button 
                   key={nav.id}
                   onClick={() => setActiveTab(nav.id as any)}
                   className={`flex-1 flex flex-col items-center gap-1.5 transition-all ${
                     activeTab === nav.id ? 'text-navy scale-105' : 'text-slate-300'
                   }`}
                 >
                   <div className={`w-14 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                     activeTab === nav.id ? 'bg-navy/5' : 'bg-transparent'
                   }`}>
                     <nav.icon size={22} strokeWidth={activeTab === nav.id ? 3 : 2} />
                   </div>
                   <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === nav.id ? 'opacity-100' : 'opacity-0'}`}>
                     {nav.label}
                   </span>
                 </button>
               ))}
            </div>

            <footer className="hidden lg:flex items-center justify-between px-8 py-4 bg-slate-50 border-t border-slate-100 shrink-0">
               <div className="flex items-center gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                 <ShieldCheck size={14} className="text-emerald-500" />
                 Secure Management Node • H. Saban Enterprise
               </div>
               <span className="text-[9px] font-black text-slate-400 italic">SabanOS v6.2.0 • נועה ❤️</span>
            </footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
