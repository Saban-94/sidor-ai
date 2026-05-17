import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  Search, 
  Truck, 
  Clock, 
  AlertCircle, 
  X,
  Sparkles,
  FileUp,
  Paperclip,
  Loader2,
  Copy,
  Check,
  Send,
  MessageSquare,
  Zap,
  Tag,
  AlertTriangle,
  History,
  CornerDownLeft,
  Bell,
  Trash2,
  Pencil,
  ChevronRight,
  Database,
  ArrowRightCircle,
  Pin,
  Save,
  FileSpreadsheet,
  TrendingDown,
  Activity,
  Layers,
  Menu,
  Users,
  Smartphone,
  Calendar,
  Info,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  processNoaBridge, 
  createOrder, 
  getCustomerByNumber, 
  updateCustomer,
  updateOrder,
  generate1700Report
} from '../services/auraService';
import { GasService } from '../services/gasService';
import { useToast } from '../providers/ToastProvider';
import { InventoryItem, Order, Customer } from '../types';
import { format, subHours } from 'date-fns';
import { he } from 'date-fns/locale';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  limit, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UIModal } from './UIModal';

interface NoaBridgeGatewayProps {
  onBack: () => void;
}

interface BridgeAnalysis {
  customer: { 
    id: string; 
    customerNumber: string; 
    name: string; 
    isNew: boolean;
    recallNote?: string;
  };
  site?: string;
  items: { 
    raw: string; 
    sku: string; 
    name: string; 
    qty: number; 
    unit: string; 
    status: 'validated' | 'missing_specs' | 'delay_warning';
    notes?: string;
  }[];
  warnings: string[];
  whatsappResponse: string;
}

export const NoaBridgeGateway: React.FC<NoaBridgeGatewayProps> = ({ onBack }) => {
  const { addToast } = useToast();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<BridgeAnalysis | null>(null);
  const [copied, setCopied] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showClientMenu, setShowClientMenu] = useState(false);
  const [clients, setClients] = useState<Customer[]>([]);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const q = query(collection(db, 'customers'), orderBy('name', 'asc'), limit(20));
      const snap = await getDocs(q);
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setAnalysis(null);
    setChatHistory([]);
    try {
      const result = await processNoaBridge(inputText);
      setAnalysis(result);
      
      if (result.customer?.id) {
        fetchChatHistory(result.customer.id);
      }
      
      addToast('נועה ניתחה!', 'הזיהוי הושלם בהצלחה ✅', 'success');
    } catch (error: any) {
      addToast('שגיאה', error.message || 'לא הצלחתי לנתח את זה...', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchChatHistory = async (customerId: string) => {
    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'chat_history'),
        where('customerId', '==', customerId),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      setChatHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.warn('Failed to fetch chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handle1700Report = async () => {
    setIsGeneratingReport(true);
    try {
      const yesterday = subHours(new Date(), 24);
      const historyQ = query(collection(db, 'chat_history'), where('timestamp', '>=', Timestamp.fromDate(yesterday)), limit(50));
      const historySnap = await getDocs(historyQ);
      const history = historySnap.docs.map(d => d.data());

      const ordersQ = query(collection(db, 'orders'), where('createdAt', '>=', Timestamp.fromDate(yesterday)), limit(50));
      const ordersSnap = await getDocs(ordersQ);
      const orders = ordersSnap.docs.map(d => d.data());

      const report = await generate1700Report(history, orders);
      setReportResult(report);
      
      await GasService.logBlackBox({
        type: 'DAILY_1700_REPORT',
        timestamp: new Date().toISOString(),
        content: report
      });

      addToast('סגירת יום!', 'דוח 17:00 הופק וסונכרן ל-BlackBox ✅', 'success');
    } catch (error: any) {
      addToast('שגיאה בהפקה', error.message, 'warning');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleInjectOrder = async () => {
    if (!analysis) return;
    setIsInjecting(true);
    try {
      const itemsString = analysis.items
        .map(it => `${it.qty} x ${it.name}${it.sku ? ` (${it.sku})` : ''}`)
        .join('\n');

      const result = await createOrder({
        customerName: analysis.customer.name,
        customerId: analysis.customer.id,
        items: itemsString,
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        destination: analysis.site || 'עודכן משדה הקרב',
        status: 'pending',
        warehouse: 'החרש',
        driverId: 'לא שובץ'
      });

      if (analysis.customer.id) {
        const currentCustomer = clients.find(c => c.id === analysis.customer.id);
        const updateData: any = {
          lastOrderAt: serverTimestamp() as any
        };

        // Auto-learn new sites
        if (analysis.site && currentCustomer && !currentCustomer.siteProfiles?.some(s => s.name === analysis.site)) {
          updateData.siteProfiles = [
            ...(currentCustomer.siteProfiles || []), 
            { name: analysis.site, notes: 'נוסף אוטומטית ע"י נועה במהלך הזרקת הזמנה' }
          ];
        }

        await updateCustomer(analysis.customer.id, updateData);
      }

      await GasService.syncWhatsApp({
        customer: analysis.customer.name,
        items: itemsString,
        response: analysis.whatsappResponse,
        orderId: result.id
      });

      await addDoc(collection(db, 'bridge_sessions'), {
        customerId: analysis.customer.id,
        customerName: analysis.customer.name,
        itemCount: analysis.items.length,
        createdAt: serverTimestamp()
      });

      addToast('הוזרק בהצלחה!', 'ההזמנה בלוח והתשובה ב-whatsapp ✅', 'success');
    } catch (error: any) {
      addToast('שגיאת הזרקה', error.message || 'שגיאת מערכת', 'warning');
    } finally {
      setIsInjecting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });

      const result = await processNoaBridge({
        fileBase64: base64.split(',')[1],
        mimeType: file.type
      });
      setAnalysis(result);
      if (result.customer?.id) fetchChatHistory(result.customer.id);
      addToast('הקובץ נותח!', 'נועה זיהתה את ההזמנה ✅', 'success');
    } catch (error: any) {
      addToast('שגיאה בניתוח קובץ', error.message, 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden" dir="rtl">
      {/* Dynamic Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between shadow-sm border-b border-gray-100 z-[60]">
        <div className="flex items-center gap-3">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowClientMenu(true)}
            className="p-2.5 bg-gray-50 rounded-2xl text-gray-700 active:bg-sky-50 transition-colors lg:hidden"
          >
            <Menu size={24} />
          </motion.button>
          <div onClick={onBack} className="cursor-pointer group flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-600/30 group-hover:scale-105 transition-transform">
              <Zap size={24} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 leading-none">SabanOS Dashboard</h1>
              <p className="text-[10px] font-bold text-sky-600 uppercase tracking-tighter mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                Adaptive Intelligence Center v4.0
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-6 text-[10px] font-black uppercase text-gray-400 border-l border-gray-100 pl-6 h-10">
            <div className="flex flex-col items-end">
              <span>Status</span>
              <span className="text-emerald-500">Connected</span>
            </div>
            <div className="flex flex-col items-end">
              <span>Region</span>
              <span className="text-gray-900">Hod HaSharon</span>
            </div>
          </div>

          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={handle1700Report}
            disabled={isGeneratingReport}
            className="bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-lg shadow-gray-900/10 flex items-center gap-3 disabled:opacity-50 hover:bg-black transition-colors"
          >
            {isGeneratingReport ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
            <span className="text-xs font-black">דוח 17:00</span>
          </motion.button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden lg:p-4 gap-4">
        {/* Left Pane: Client Library (Desktop Only) */}
        <aside className="hidden lg:flex flex-col w-[320px] bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-900/5 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} className="text-sky-600" />
              Client Library
            </h3>
            <Plus size={16} className="text-gray-300" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {clients.map(client => (
              <motion.button 
                key={client.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedClient(client);
                  fetchChatHistory(client.id!);
                }}
                className={`w-full p-4 rounded-2xl flex items-center justify-between text-right transition-all group ${
                  selectedClient?.id === client.id 
                    ? 'bg-sky-50 shadow-sm border border-sky-100' 
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="text-right">
                  <div className="font-black text-gray-900 text-sm">{client.name}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-tighter">#{client.customerNumber}</div>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedClient?.id === client.id ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-white'}`}>
                  <ArrowRightCircle size={16} />
                </div>
              </motion.button>
            ))}
          </div>
          {selectedClient && (
            <div className="p-6 bg-gray-50 border-t border-gray-100">
               <div className="flex items-center gap-2 mb-3">
                 <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                   <Info size={14} className="text-sky-600" />
                 </div>
                 <span className="text-[10px] font-black uppercase text-gray-400">Context Active</span>
               </div>
               <p className="text-xs font-black text-gray-800 leading-relaxed">{selectedClient.name}</p>
               <button className="mt-4 w-full py-3 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:border-sky-200 hover:text-sky-600 transition-colors shadow-sm">
                 Entry to Client File
               </button>
            </div>
          )}
        </aside>

        {/* Center Pane: Operational Analysis */}
        <main className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 border border-gray-100 shadow-xl shadow-sky-900/5 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <MessageSquare size={20} />
                </div>
                ניתוח קלט חכם
              </h2>
              <div className="flex gap-2">
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-sky-50 hover:text-sky-600 transition-all border border-transparent hover:border-sky-100"
                >
                  <Paperclip size={20} />
                </motion.button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              </div>
            </div>

            <div 
              style={{ marginRight: '77.5625px', marginLeft: '77.5px' }}
              className="flex-1 flex flex-col gap-6 overflow-hidden"
            >
              <div className="relative group">
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="הדבק טקסט (ווטסאפ, מייל, רשימה)..."
                  className="w-full h-40 lg:h-56 bg-gray-50/50 border-2 border-transparent rounded-[2rem] p-6 text-lg font-medium text-gray-800 placeholder:text-gray-300 focus:bg-white focus:border-sky-500 focus:ring-0 transition-all"
                />
                <div className="absolute bottom-4 left-4">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={handleProcess}
                    disabled={!inputText.trim() || isProcessing}
                    className="px-8 py-4 bg-sky-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-sky-600/20 flex items-center gap-3 hover:bg-sky-700 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} fill="currentColor" />}
                    <span>Smart Analysis</span>
                  </motion.button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {analysis ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key="analysis-results"
                    className="flex-1 overflow-y-auto space-y-6 pr-1"
                  >
                    <div className="grid lg:grid-cols-2 gap-6">
                      {/* Analysis Left: Data Grid */}
                      <div className="space-y-4">
                        <div className="p-5 bg-gray-50 rounded-[2rem] border border-gray-100">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Database size={14} className="text-sky-600" />
                            Entity Identification
                          </h4>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-gray-50">
                              <span className="text-xs font-bold text-gray-500">Client</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${analysis.customer.isNew ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {analysis.customer.isNew ? 'New Detected' : 'Existing Match'}
                                </span>
                                <span className="text-sm font-black text-gray-900">{analysis.customer.name}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-gray-50">
                              <span className="text-xs font-bold text-gray-500">Site/Link</span>
                              <span className="text-sm font-black text-sky-600 truncate max-w-[150px]">{analysis.site || 'TBD'}</span>
                            </div>
                            {analysis.customer.recallNote && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3 mt-2"
                              >
                                <Brain size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                                <div className="text-xs font-bold text-indigo-900 leading-relaxed italic">
                                  {analysis.customer.recallNote}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </div>

                        <div className="p-5 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
                           <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                             <span>Matched Items</span>
                             <span className="text-sky-600">{analysis.items.length} units</span>
                           </h4>
                           <div className="space-y-2">
                             {analysis.items.map((item, i) => (
                               <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-transparent hover:border-sky-50 transition-colors">
                                 <div className="flex flex-col">
                                   <span className="text-xs font-black text-gray-800">{item.name}</span>
                                   <span className="text-[9px] text-gray-400 font-mono">{item.sku || 'N/A'}</span>
                                 </div>
                                 <div className="flex items-center gap-3">
                                   <span className="text-xs font-black text-gray-900">{item.qty} {item.unit}</span>
                                   {item.status === 'validated' ? <Check size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-amber-500" />}
                                 </div>
                               </div>
                             ))}
                           </div>
                        </div>
                      </div>

                      {/* Analysis Right: Output/Concierge */}
                      <div className="space-y-4">
                         <div className="p-6 bg-sky-600 text-white rounded-[2rem] shadow-xl shadow-sky-600/20 relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                           <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-2">
                               <MessageSquare size={16} className="text-sky-200" />
                               <span className="text-[10px] font-black uppercase text-sky-100">WhatsApp Concierge</span>
                             </div>
                             <motion.button 
                               whileTap={{ scale: 0.9 }}
                               onClick={() => {
                                 navigator.clipboard.writeText(analysis.whatsappResponse);
                                 setCopied(true);
                                 setTimeout(() => setCopied(false), 2000);
                                 addToast('בוצע!', 'התגובה הועתקה. זמין להדבקה.', 'success');
                               }}
                               className="bg-white/20 p-2.5 rounded-xl hover:bg-white/30 transition-colors backdrop-blur-md"
                             >
                               {copied ? <Check size={18} /> : <Copy size={18} />}
                             </motion.button>
                           </div>
                           <p className="text-lg font-black leading-relaxed whitespace-pre-wrap text-right">
                             {analysis.whatsappResponse}
                           </p>
                           <div className="mt-8 flex items-center justify-between">
                             <span className="text-[9px] font-black text-sky-200 uppercase">Status: Ready for broadcast</span>
                             <div className="flex gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:-0.3s]" />
                               <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:-0.15s]" />
                               <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" />
                             </div>
                           </div>
                         </div>

                         <motion.button 
                           whileTap={{ scale: 0.98 }}
                           onClick={handleInjectOrder}
                           disabled={isInjecting}
                           className="w-full py-5 bg-gray-900 text-white rounded-3xl font-black shadow-2xl shadow-gray-900/20 flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-black transition-all"
                         >
                           {isInjecting ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                           הזרקת הזמנה ללוח (Inject & Log)
                         </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                    <div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                      <Smartphone size={48} className="text-gray-300" />
                    </div>
                    <h3 className="text-xl font-black text-gray-400">הזינו קלט לניתוח מהיר</h3>
                    <p className="text-sm font-bold text-gray-300 mt-2">נועה תזהה לקוחות, תחשב מלאי ותכין תשובה</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Right Pane: Client Brain & Real-time Tracking (Desktop Only) */}
        <aside 
          style={{ width: '80px' }}
          className="hidden xl:flex flex-col gap-4 overflow-hidden"
        >
          {/* Customer Brain Profile */}
          <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-xl shadow-gray-900/5">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Activity size={14} className="text-sky-600" />
              Customer Brain (Live Feed)
            </h3>

            {selectedClient ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 font-black text-2xl shadow-inner uppercase">
                    {selectedClient.name[0]}
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-lg leading-tight">{selectedClient.name}</h4>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Verified VIP Customer</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-sky-100 transition-colors group cursor-pointer">
                    <Pin size={14} className="text-gray-300 mb-2 group-hover:text-sky-500" />
                    <div className="text-[9px] font-black text-gray-400 uppercase">Primary Site</div>
                    <div className="text-xs font-black text-gray-800 truncate">{selectedClient.address || 'לא הוגדר'}</div>
                  </div>
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-transparent hover:border-emerald-100 transition-colors group cursor-pointer">
                    <TrendingDown size={14} className="text-gray-300 mb-2 group-hover:text-emerald-500" />
                    <div className="text-[9px] font-black text-gray-400 uppercase">Avg. Volume</div>
                    <div className="text-xs font-black text-gray-800">4.5 Ton/Mo</div>
                  </div>
                </div>

                <div className="space-y-3">
                   <div className="text-[10px] font-black text-gray-400 uppercase flex items-center justify-between">
                     <span>Last Interactions</span>
                     <History size={12} />
                   </div>
                   <div className="space-y-2">
                     {chatHistory.slice(0, 3).map((chat, i) => (
                       <div key={i} className="p-3 bg-gray-50 rounded-xl relative group">
                          <p className="text-[11px] font-bold text-gray-600 leading-relaxed pr-2">{chat.text}</p>
                          <div className="absolute top-3 left-3 text-[8px] font-mono text-gray-300">{chat.timestamp?.toDate ? format(chat.timestamp.toDate(), 'HH:mm') : ''}</div>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center opacity-30 italic">
                <p className="text-xs text-gray-400">בחר לקוח להצגת תובנות</p>
              </div>
            )}
          </div>

          {/* Real-time Order Tracking (Mini-Log) */}
          <div 
            style={{ marginRight: '99px', width: '281.009px' }}
            className="flex-1 bg-gray-900 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000" />
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-6 relative">
              <Layers size={14} className="text-sky-400" />
              Live Order Pulse
            </h3>

            <div className="space-y-4 relative">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-sky-200 uppercase">Active Shipments</span>
                <span className="text-[9px] font-mono text-sky-400">LIVE FEED</span>
              </div>
              <div className="space-y-3">
                 {[1, 2, 3].map(i => (
                   <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors backdrop-blur-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-black text-white text-xs">הזמנה #00{i}</div>
                        <div className="px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded-full text-[8px] font-black">EN ROUTE</div>
                      </div>
                      <div className="text-[10px] text-gray-400">יעד: הוד השרון, סולאנג'</div>
                      <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: i === 1 ? '75%' : i === 2 ? '40%' : '15%' }}
                          className="h-full bg-sky-500" 
                        />
                      </div>
                   </div>
                 ))}
                 <button className="w-full py-4 mt-2 border border-white/10 rounded-2xl text-[10px] font-black text-gray-400 uppercase hover:bg-white/5 transition-colors">
                   View Full Kanban Board
                 </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile-Only Client Search Drawer */}
      <AnimatePresence>
        {showClientMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClientMenu(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] lg:hidden"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed inset-y-0 right-0 w-[85%] max-w-sm bg-white shadow-2xl z-[101] flex flex-col lg:hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-900">Client Engine</h3>
                <button onClick={() => setShowClientMenu(false)} className="p-3 text-gray-400 hover:bg-gray-50 rounded-2xl">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search clients..."
                    className="w-full pr-12 pl-4 py-4 bg-white rounded-2xl border-transparent focus:border-sky-500 focus:ring-0 text-sm font-bold shadow-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {clients.map(client => (
                  <motion.button 
                    key={client.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedClient(client);
                      fetchChatHistory(client.id!);
                      setShowClientMenu(false);
                      addToast('Focus Switched', `Context set to: ${client.name}`, 'info');
                    }}
                    className={`w-full p-5 rounded-3xl flex items-center justify-between text-right border transition-all ${
                      selectedClient?.id === client.id 
                        ? 'bg-sky-600 border-sky-400 text-white shadow-xl shadow-sky-600/20' 
                        : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-900 shadow-sm'
                    }`}
                  >
                    <div>
                      <div className={`font-black text-sm text-right ${selectedClient?.id === client.id ? 'text-white' : 'text-gray-900'}`}>{client.name}</div>
                      <div className={`text-[10px] text-right mt-0.5 ${selectedClient?.id === client.id ? 'text-sky-100' : 'text-gray-400'}`}>ID: {client.customerNumber}</div>
                    </div>
                    <ArrowRightCircle size={20} className={selectedClient?.id === client.id ? 'text-white' : 'text-gray-200'} />
                  </motion.button>
                ))}
              </div>
              
              <div className="p-6 bg-gray-50 border-t border-gray-100">
                <div className="flex gap-3">
                  <button className="flex-1 py-4 bg-white border border-gray-200 rounded-2xl font-black text-[10px] uppercase text-gray-500 shadow-sm">
                    New Client
                  </button>
                  <button className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">
                    Full Library
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Report Summary Modal */}
      <UIModal isOpen={!!reportResult} onClose={() => setReportResult(null)} title="Operational Summary (17:00)">
        <div className="p-8 space-y-6">
          <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 whitespace-pre-wrap font-bold text-gray-800 leading-relaxed text-right max-h-[60vh] overflow-y-auto" dir="rtl">
            {reportResult}
          </div>
          <div className="flex gap-4">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                navigator.clipboard.writeText(reportResult || '');
                addToast('Copied Successfully! ✅', 'Ready to broadcast via WhatsApp', 'success');
              }}
              className="flex-1 py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 hover:bg-emerald-700 transition-colors"
            >
              <Copy size={22} />
              Copy for WhatsApp
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setReportResult(null)}
              className="px-10 py-5 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition-colors"
            >
              Close
            </motion.button>
          </div>
        </div>
      </UIModal>
    </div>
  );
};
