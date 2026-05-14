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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[5000] bg-white flex flex-col overflow-hidden w-screen h-screen touch-none"
          dir="rtl"
        >
          {/* Elite Operations Header - SabanOS High-Density Architecture */}
          <header className="shrink-0 h-[88px] bg-blue-900 text-white flex items-center justify-between px-8 border-b-4 border-blue-800 shadow-2xl z-[60]">
             <div className="flex items-center gap-6">
                <button 
                  onClick={onClose}
                  className="w-[60px] h-[60px] flex items-center justify-center bg-blue-950 text-white rounded-2xl border-2 border-blue-700 active:scale-90 transition-all shadow-lg"
                >
                  <X size={32} />
                </button>
                <div className="flex flex-col">
                   <h1 className="text-2xl font-black italic tracking-tight leading-none mb-1 text-white">SabanOS Precision • Noa Gen 7</h1>
                   <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                      <span className="text-xs font-black text-blue-200 uppercase tracking-[0.2em] leading-none opacity-80">Operational Brain Active ✅</span>
                   </div>
                </div>
             </div>
             
             <div className="flex items-center gap-5">
                <div className="hidden md:flex flex-col text-left items-end opacity-60">
                   <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Commander Protocol</span>
                   <span className="text-xs font-bold leading-none">ראמי אהובי | המפקד המורשה</span>
                </div>
                <img 
                  src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                  alt="Noa" 
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-400/30 shadow-2xl"
                />
             </div>
          </header>

          {/* Full-Width AI Canvas */}
          <main className="flex-1 overflow-hidden relative bg-[#F8FAFC]">
             <div className="absolute inset-0">
                {activeTab === 'chat' && (
                  <NoaChat 
                    chatHistory={chatHistory}
                    onBack={onClose}
                    onAction={onAction}
                    onClearHistory={onClearHistory}
                    orders={orders}
                    onOrderView={onOrderView}
                    isPopup={true}
                  />
                )}

                {activeTab === 'insights' && (
                  <div className="h-full overflow-y-auto px-8 py-12 space-y-12 bg-white">
                     <div className="max-w-none grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                          { title: 'ניתוח עומסי תנועה', icon: Globe, desc: 'חיזוי זמני הגעה בזמן אמת (Real-time ETA Monitor)', action: handleTrafficAudit },
                          { title: 'אימות היסטוריית מיקומים', icon: ShieldCheck, desc: 'סריקת צמתים לוגיסטיים ומאגרי מידע (GPS Validation)', action: () => onAction("נתחי את אמינות הנתונים בסידור") },
                          { title: 'אופטימיזציית משאבים', icon: Cpu, desc: 'חישוב נצילות משאיות מול קריאות מנוף (Resource Efficiency)', action: () => onAction("בצעי אופטימיזציית משאבים להיום") },
                        ].map((card, i) => (
                          <button 
                            key={i}
                            onClick={card.action}
                            className="bg-slate-50 p-10 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:border-blue-900 transition-all text-right group flex flex-col items-start min-h-[220px]"
                          >
                            <div className="w-[60px] h-[60px] bg-blue-900 text-white rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-all shadow-xl">
                              <card.icon size={32} />
                            </div>
                            <h4 className="text-2xl font-black text-blue-900 mb-2 leading-tight">{card.title}</h4>
                            <p className="text-lg font-bold text-slate-500 leading-relaxed">{card.desc}</p>
                          </button>
                        ))}
                     </div>

                     <div className="p-12 rounded-[3.5rem] bg-blue-950 text-white relative overflow-hidden shadow-3xl border-2 border-blue-900">
                        <div className="relative z-10 lg:pr-20">
                           <h3 className="text-3xl font-black italic mb-8 tracking-tight">Intelligence Consumption Analysis</h3>
                           <div className="space-y-6 mb-12">
                              {loadingInsight ? (
                                <div className="flex gap-4 py-6">
                                   {[1, 2, 3].map(d => <div key={d} className="w-4 h-4 bg-gold/50 rounded-full animate-bounce" />)}
                                </div>
                              ) : (
                                <p className="text-2xl font-bold text-white/90 leading-relaxed italic max-w-5xl">
                                   "{smartInsight || 'המערכת ממתינה לפקודה ממך, המפקד ראמי. מה ברצונך לבצע?'}"
                                 </p>
                              )}
                           </div>
                           <div className="flex flex-wrap gap-6">
                              <button 
                                onClick={() => { setActiveTab('chat'); onAction("תכיני דוח בוקר HTML מעוצב"); }}
                                className="bg-gold text-blue-950 px-12 py-6 rounded-2xl font-black hover:bg-white transition-all text-xl shadow-2xl min-h-[64px]"
                              >
                                הפק דוח בוקר Enterprise
                              </button>
                              <button 
                                onClick={generateTopInsight}
                                className="bg-white/10 text-white px-12 py-6 rounded-2xl font-black hover:bg-white/20 transition-all text-xl border-2 border-white/20 min-h-[64px]"
                              >
                                רענן ניתוח בינה מלאכותית
                              </button>
                           </div>
                        </div>
                        <Brain size={500} className="absolute -bottom-40 -left-60 text-white/5 rotate-12 pointer-events-none" />
                     </div>
                  </div>
                )}

                {activeTab === 'performance' && (
                  <div className="p-16 flex flex-col items-center justify-center h-full text-center space-y-8 bg-white">
                     <div className="w-32 h-32 bg-blue-900/5 rounded-[3rem] flex items-center justify-center text-blue-900 mb-6 shadow-inner">
                        <TrendingUp size={64} />
                     </div>
                     <h3 className="text-4xl font-black text-blue-950 italic">ניתוח ביצועים בבנייה</h3>
                     <p className="text-2xl font-bold text-slate-400 max-w-xl mx-auto leading-relaxed">נועה מעבדת את נתוני העבר כדי לבנות מודל חיזוי רווחיות (Predictive ROI Model) עבור המפקד ראמי.</p>
                  </div>
                )}
             </div>
          </main>

          {/* Global Precision Navigation */}
          <nav className="shrink-0 h-[100px] bg-white border-t-4 border-slate-100 flex items-center px-10 gap-8 z-[60] shadow-[0_-20px_60px_rgba(30,58,138,0.08)]">
             {[
               { id: 'chat', icon: Activity, label: 'Chat Hub' },
               { id: 'insights', icon: Zap, label: 'Analytics' },
               { id: 'performance', icon: TrendingUp, label: 'Logix KPI' },
             ].map(nav => (
               <button 
                 key={nav.id}
                 onClick={() => setActiveTab(nav.id as any)}
                 className={`flex-1 h-[70px] flex items-center justify-center gap-4 rounded-2xl transition-all border-2 ${
                   activeTab === nav.id 
                    ? 'bg-blue-900 border-blue-800 text-white shadow-xl scale-[1.02]' 
                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-900/20'
                 }`}
               >
                 <nav.icon size={28} strokeWidth={activeTab === nav.id ? 4 : 2} />
                 <span className="text-xl font-black uppercase tracking-tighter hidden sm:block">
                   {nav.label}
                 </span>
               </button>
             ))}
          </nav>

          <footer className="hidden lg:flex items-center justify-between px-10 py-5 bg-blue-950 text-white shrink-0 border-t border-blue-900/30">
             <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest leading-none">
               <ShieldCheck size={18} className="text-gold" />
               Secure Management Hub • SabanOS v7.0.0
             </div>
             <span className="text-xs font-black italic opacity-60">SABAN ENTERPRISE LOGISTICS INFRASTRUCTURE • נועה ❤️</span>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
