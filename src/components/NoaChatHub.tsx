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
  History,
  Settings as SettingsIcon,
  Plus
} from 'lucide-react';
import { NoaChat } from './NoaChat';
import { NoaChatHistory } from './NoaChatHistory';
import { Order, ChatSession } from '../types';
import { getLogisticsInsight, getTrafficRefinedRoute } from '../services/auraService';

interface NoaChatHubProps {
  isOpen: boolean;
  onClose: () => void;
  chatHistory: any[];
  onAction: (action: string, file?: File | string) => void;
  onClearHistory?: () => void;
  orders: Order[];
  onOrderView?: (order: Order) => void;
  sessions?: ChatSession[];
  currentSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onNewChat?: () => void;
  onDeleteSession?: (id: string) => void;
}

export const NoaChatHub = ({
  isOpen,
  onClose,
  chatHistory,
  onAction,
  onClearHistory,
  orders,
  onOrderView,
  sessions = [],
  currentSessionId = null,
  onSelectSession = () => {},
  onNewChat = () => {},
  onDeleteSession = () => {}
}: NoaChatHubProps) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'performance'>('chat');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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
          <header className="shrink-0 h-[32px] bg-blue-900 text-white flex items-center justify-between px-3 border-b border-blue-800 shadow-sm z-[60]">
             <div className="flex items-center gap-2">
                <button 
                  onClick={onClose}
                  className="w-6 h-6 flex items-center justify-center bg-blue-950 text-white rounded-md border border-blue-700 active:scale-90 transition-all"
                >
                  <X size={14} />
                </button>
                <div className="flex flex-col">
                   <h1 className="text-[10px] font-black italic tracking-tight leading-none text-white">SabanOS Precision • Noa Gen 7</h1>
                   <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[6px] font-black text-blue-200 uppercase tracking-widest leading-none opacity-80">Operational Brain Active ✅</span>
                   </div>
                </div>
             </div>

             <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex items-center gap-1.5 bg-blue-800/50 hover:bg-blue-700/50 px-2 py-0.5 rounded-md border border-blue-600/30 transition-all active:scale-95 group"
                  title="היסטוריית שיחות"
                >
                  <History size={10} className="text-blue-200 group-hover:text-white transition-colors" />
                  <span className="text-[8px] font-black text-blue-100 uppercase tracking-widest">History</span>
                </button>
                
                <button 
                  onClick={onNewChat}
                  className="hidden md:flex items-center gap-1.5 bg-gold/10 hover:bg-gold/20 px-2 py-0.5 rounded-md border border-gold/30 transition-all active:scale-95 group"
                  title="שיחה חדשה"
                >
                  <Plus size={10} className="text-gold group-hover:text-white transition-colors" />
                  <span className="text-[8px] font-black text-gold group-hover:text-white uppercase tracking-widest">New</span>
                </button>
             </div>
             
             <div className="flex items-center gap-2">
                <div className="hidden md:flex flex-col text-left items-end opacity-60">
                   <span className="text-[7px] font-black uppercase tracking-widest leading-none mb-0.5">Commander Protocol</span>
                   <span className="text-[8px] font-bold leading-none">ראמי אהובי | המפקד המורשה</span>
                </div>
                <img 
                  src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                  alt="Noa" 
                  className="w-6 h-6 rounded-md object-cover border border-blue-400/30"
                />
             </div>
          </header>

          {/* Full-Width AI Canvas */}
          <main className="flex-1 overflow-hidden relative bg-[#F8FAFC]">
             <AnimatePresence>
               {isHistoryOpen && (
                 <NoaChatHistory 
                   sessions={sessions}
                   currentSessionId={currentSessionId || undefined}
                   onSelectSession={(id) => {
                     onSelectSession(id);
                     setIsHistoryOpen(false);
                   }}
                   onDeleteSession={onDeleteSession}
                   onClose={() => setIsHistoryOpen(false)}
                 />
               )}
             </AnimatePresence>
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
                  <div className="h-full overflow-y-auto px-4 py-6 space-y-6 bg-white">
                     <div className="max-w-none grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                          { title: 'ניתוח עומסי תנועה', icon: Globe, desc: 'חיזוי זמני הגעה בזמן אמת (Real-time ETA Monitor)', action: handleTrafficAudit },
                          { title: 'אימות היסטוריית מיקומים', icon: ShieldCheck, desc: 'סריקת צמתים לוגיסטיים ומאגרי מידע (GPS Validation)', action: () => onAction("נתחי את אמינות הנתונים בסידור") },
                          { title: 'אופטימיזציית משאבים', icon: Cpu, desc: 'חישוב נצילות משאיות מול קריאות מנוף (Resource Efficiency)', action: () => onAction("בצעי אופטימיזציית משאבים להיום") },
                        ].map((card, i) => (
                          <button 
                            key={i}
                            onClick={card.action}
                            className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm hover:border-blue-900 transition-all text-right group flex flex-col items-start min-h-[120px]"
                          >
                            <div className="w-8 h-8 bg-blue-900 text-white rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-all">
                              <card.icon size={18} />
                            </div>
                            <h4 className="text-sm font-black text-blue-900 mb-1 leading-tight">{card.title}</h4>
                            <p className="text-[10px] font-bold text-slate-500 leading-tight">{card.desc}</p>
                          </button>
                        ))}
                     </div>

                     <div className="p-6 rounded-2xl bg-blue-950 text-white relative overflow-hidden border border-blue-900">
                        <div className="relative z-10 lg:pr-10">
                           <h3 className="text-lg font-black italic mb-4 tracking-tight">Intelligence Consumption Analysis</h3>
                           <div className="space-y-4 mb-8">
                              {loadingInsight ? (
                                <div className="flex gap-2 py-2">
                                   {[1, 2, 3].map(d => <div key={d} className="w-2 h-2 bg-gold/50 rounded-full animate-bounce" />)}
                                </div>
                              ) : (
                                <p className="text-sm font-bold text-white/90 leading-relaxed italic max-w-5xl">
                                   "{smartInsight || 'המערכת ממתינה לפקודה ממך, המפקד ראמי. מה ברצונך לבצע?'}"
                                 </p>
                              )}
                           </div>
                           <div className="flex flex-wrap gap-3">
                              <button 
                                onClick={() => { setActiveTab('chat'); onAction("תכיני דוח בוקר HTML מעוצב"); }}
                                className="bg-gold text-blue-950 px-6 py-3 rounded-lg font-black hover:bg-white transition-all text-xs shadow-lg"
                              >
                                הפק דוח בוקר Enterprise
                              </button>
                              <button 
                                onClick={generateTopInsight}
                                className="bg-white/10 text-white px-6 py-3 rounded-lg font-black hover:bg-white/20 transition-all text-xs border border-white/20"
                              >
                                רענן ניתוח בינה מלאכותית
                              </button>
                           </div>
                        </div>
                        <Brain size={200} className="absolute -bottom-20 -left-20 text-white/5 rotate-12 pointer-events-none" />
                     </div>
                  </div>
                )}

                {activeTab === 'performance' && (
                  <div className="p-8 flex flex-col items-center justify-center h-full text-center space-y-4 bg-white">
                     <div className="w-16 h-16 bg-blue-900/5 rounded-2xl flex items-center justify-center text-blue-900 mb-2 shadow-inner">
                        <TrendingUp size={32} />
                     </div>
                     <h3 className="text-lg font-black text-blue-950 italic">ניתוח ביצועים בבנייה</h3>
                     <p className="text-xs font-bold text-slate-400 max-w-md mx-auto leading-tight">נועה מעבדת את נתוני העבר כדי לבנות מודל חיזוי רווחיות (Predictive ROI Model) עבור המפקד ראמי.</p>
                  </div>
                )}
             </div>
          </main>

          {/* Streamlined SabanOS 6.0 Footer Navigation */}
          <footer className="shrink-0 bg-blue-950 flex flex-col z-[60] border-t border-blue-800 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">
             <div className="flex h-10 w-full divide-x divide-x-reverse divide-blue-800/30">
               {[
                 { id: 'chat', icon: Activity, label: 'CHAT HUB', style: { height: '32px' } },
                 { id: 'insights', icon: Zap, label: 'ANALYTICS', style: { height: '32px' } },
                 { id: 'performance', icon: TrendingUp, label: 'LOGIX KPI', style: { height: '32px' } },
               ].map((nav) => (
                 <button 
                   key={nav.id}
                   onClick={() => setActiveTab(nav.id as any)}
                   className={`flex-1 flex items-center justify-center gap-2 transition-all ${
                     activeTab === nav.id 
                      ? 'bg-blue-900 text-white' 
                      : 'text-white/40 hover:bg-blue-900/40 hover:text-white'
                   }`}
                   style={nav.style}
                 >
                   <nav.icon size={14} strokeWidth={activeTab === nav.id ? 3 : 2} className={activeTab === nav.id ? 'text-blue-400' : 'text-white/20'} />
                   <span className={`text-[10px] font-black tracking-widest ${activeTab === nav.id ? 'opacity-100' : 'opacity-70'}`}>
                     {nav.label}
                   </span>
                 </button>
               ))}
             </div>
             <div className="bg-blue-950/90 py-1 px-4 flex justify-center text-center">
                <span className="text-[7px] font-black italic opacity-30 uppercase tracking-widest text-white">
                  SABAN ENTERPRISE LOGISTICS INFRASTRUCTURE • נועה ❤️
                </span>
             </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
