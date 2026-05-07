import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  MessageSquare, 
  History, 
  Search, 
  ChevronLeft, 
  Truck, 
  CheckCircle, 
  Clock, 
  Share2, 
  ExternalLink,
  Copy,
  Check,
  User as UserIcon,
  Filter,
  Sparkles,
  MoreVertical,
  Calendar,
  Paperclip,
  Send,
  Zap,
  Mic,
  Brain,
  Info,
  Pin
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  limit, 
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, Customer } from '../types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { askNoa, executeNoaCommand, updateCustomer } from '../services/auraService';

interface ClientDesktopDashboardProps {
  orders: Order[];
  onViewOrder: (orderId: string) => void;
  onAddToast: (title: string, msg: string, type?: any) => void;
}

export const ClientDesktopDashboard: React.FC<ClientDesktopDashboardProps> = ({
  orders,
  onViewOrder,
  onAddToast
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'summary'>('chat');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPulseActive, setIsPulseActive] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [smartSummary, setSmartSummary] = useState<string>('מנתחת את העדכונים האחרונים...');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Effects and Computeds
  const selectedCustomer = useMemo(() => 
    customers.find(c => c.id === selectedCustomerId), 
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => 
    customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.customerNumber || "").includes(searchQuery)
    ), 
    [customers, searchQuery]
  );

  const customerOrders = useMemo(() => 
    orders.filter(o => o.customerName === selectedCustomer?.name)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [orders, selectedCustomer]
  );

  // Handle file/text attachment
  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCustomerId) return;

    onAddToast('מעבד קובץ...', `נועה מנתחת את ${file.name}`, 'info');
    
    // Simulate file processing and sync to bridge
    // In a real app, we'd upload to storage and call an AI analyzer
    setTimeout(async () => {
      await addDoc(collection(db, 'chats'), {
        customerId: selectedCustomerId,
        text: `📎 צורף קובץ: ${file.name} - נועה מעבדת את הנתונים...`,
        role: 'user',
        timestamp: serverTimestamp(),
        senderName: 'ראמי (מערכת)'
      });
      
      onAddToast('קובץ עובד! ✅', 'הנתונים סונכרנו ל-Noa Bridge', 'success');
    }, 1500);
  };

  // Effect to generate smart summary when customer changes
  useEffect(() => {
    if (!selectedCustomerId || !selectedCustomer) return;
    
    const generateSummary = async () => {
      try {
        const prompt = `נתח את תיק הלקוח של "${selectedCustomer.name}" וספק סיכום קצר (עד 15 מילים) על הצרכים הנוכחיים שלו, חריגות או דגשים חשובים.
        נתונים: ${JSON.stringify({
          profiles: selectedCustomer.siteProfiles,
          lastInteraction: selectedCustomer.lastInteraction,
          orders: (customerOrders || []).slice(0, 3).map(o => ({ num: o.orderNumber, status: o.status }))
        })}
        החזר רק את טקסט הסיכום.`;
        const response = await askNoa(prompt, []);
        setSmartSummary(response.answer);
      } catch (err) {
        setSmartSummary('לא ניתן לייצר סיכום כרגע.');
      }
    };

    generateSummary();
  }, [selectedCustomerId, selectedCustomer?.lastInteraction, customerOrders]);

  // Subscribe to chat history
  useEffect(() => {
    if (!selectedCustomerId) return;
    const q = query(
      collection(db, 'chats'), 
      where('customerId', '==', selectedCustomerId),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [selectedCustomerId]);

  // Subscribe to customers
  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(docs);
      if (docs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(docs[0].id!);
      }
    });
  }, []);

  const handleSmartShare = async (order: Order) => {
    setIsGenerating(true);
    try {
      const statusHebrew: Record<string, string> = {
        pending: 'ממתין',
        preparing: 'בהכנה',
        ready: 'מוכן',
        on_the_way: 'בדרך',
        delivered: 'סופק',
        cancelled: 'בוטל'
      };
      
      const emojiMap: Record<string, string> = {
        pending: '🕒',
        preparing: '🛠️',
        ready: '📦',
        on_the_way: '🚚',
        delivered: '✅',
        cancelled: '🛑'
      };

      const prompt = `צור הודעת עדכון מקצועית בווטסאפ ללקוח ${order.customerName}.
      סטטוס נוכחי: ${statusHebrew[order.status] || order.status}.
      מספר הזמנה: ${order.orderNumber || order.id?.slice(-4)}.
      יעד: ${order.destination}.
      שעה מתוכננת: ${order.time}.
      השתמש בטון של נועה: פשוט, מקצועי, חם, עם אימוג'ים רלוונטיים.
      סיים ב"באדיבות נועה ❤️".
      החזר רק את טקסט ההודעה.`;

      const response = await askNoa(prompt, []);
      const messageText = response.answer;

      try {
        await navigator.clipboard.writeText(messageText);
      } catch (clipErr) {
        // Robust Fallback for Clipboard API permissions
        const textArea = document.createElement("textarea");
        textArea.value = messageText;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopiedOrderId(order.id!);
      onAddToast('התשובה הועתקה! ✅', `שלח עכשיו בוואטסאפ של ${order.customerName}`, 'success');
      
      setTimeout(() => setCopiedOrderId(null), 3000);
    } catch (err) {
      onAddToast('שגיאה', 'לא הצלחתי לייצר תשובה חכמה', 'warning');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !selectedCustomerId || !selectedCustomer) return;

    const input = chatInput.trim();
    setChatInput('');
    setIsSending(true);

    try {
      // 1. Add message to local/Firebase chat history
      await addDoc(collection(db, 'chats'), {
        customerId: selectedCustomerId,
        text: input,
        role: 'user',
        timestamp: serverTimestamp(),
        senderName: 'ראמי'
      });

      // 2. Check for @commands
      if (input.startsWith('@')) {
        const context = {
          siteProfiles: selectedCustomer.siteProfiles || [],
          lastOrderId: customerOrders[0]?.id
        };
        const result = await executeNoaCommand(input, selectedCustomerId, context);
        
        // Add Noa response for command
        await addDoc(collection(db, 'chats'), {
          customerId: selectedCustomerId,
          text: result.message,
          role: 'model',
          timestamp: serverTimestamp(),
          senderName: 'נועה Intelligence'
        });

        if (result.success) {
          setIsPulseActive(input.split(' ')[0]);
          setTimeout(() => setIsPulseActive(null), 3000);
          onAddToast('בוצע! ✅', result.message, 'success');
        } else {
          onAddToast('שגיאה', result.message, 'warning');
        }
      } else {
        // Generic Noa analysis
        const response = await askNoa(input, chatMessages.map(m => ({ role: m.role, text: m.text })));
        await addDoc(collection(db, 'chats'), {
          customerId: selectedCustomerId,
          text: response.answer,
          role: 'model',
          timestamp: serverTimestamp(),
          senderName: 'נועה'
        });
      }
    } catch (err) {
      onAddToast('שגיאה', 'משהו השתבש בעיבוד ההודעה', 'warning');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full bg-white overflow-hidden" dir="rtl">
      {/* Client Sidebar */}
      <div className="w-80 border-l border-gray-100 flex flex-col bg-gray-50/50 shrink-0">
        <div className="p-6 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-sky-600 text-white rounded-2xl shadow-lg ring-4 ring-sky-500/10">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 leading-tight">ניהול לקוחות</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">SabanOS CRM</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="חיפוש לקוח..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 bg-gray-50 border-transparent rounded-xl pr-11 pl-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-sky-600/10 outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredCustomers.map(customer => (
            <button
              key={customer.id}
              onClick={() => setSelectedCustomerId(customer.id!)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl transition-all group",
                selectedCustomerId === customer.id 
                  ? "bg-sky-600 text-white shadow-xl shadow-sky-600/20 transform scale-[1.02]" 
                  : "bg-white border border-gray-100 text-gray-600 hover:border-sky-200 hover:shadow-md"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                selectedCustomerId === customer.id ? "bg-white/20 border-white/30" : "bg-gray-50 border-gray-100 group-hover:border-sky-100"
              )}>
                <UserIcon size={18} className={selectedCustomerId === customer.id ? "text-white" : "text-gray-400"} />
              </div>
              <div className="flex-1 text-right min-w-0">
                <p className={cn("font-black text-sm truncate", selectedCustomerId === customer.id ? "text-white" : "text-gray-900")}>
                  {customer.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-lg", selectedCustomerId === customer.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400")}>
                    #{customer.customerNumber}
                  </span>
                  {customer.lastOrderAt && (
                    <span className={cn("text-[9px] font-bold", selectedCustomerId === customer.id ? "text-white/60" : "text-gray-300")}>
                      פעילות אחרונה: {format(customer.lastOrderAt.toDate(), 'dd/MM/yy')}
                    </span>
                  )}
                </div>
              </div>
              <ChevronLeft size={16} className={cn("transition-transform", selectedCustomerId === customer.id ? "text-white rotate-0" : "text-gray-300 -rotate-180")} />
            </button>
          ))}

          {filteredCustomers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users size={32} className="text-gray-200 mb-2" />
              <p className="text-sm font-bold text-gray-400">לא נמצאו לקוחות</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-50/30 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {selectedCustomer ? (
            <motion.div 
              key={selectedCustomer.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* Real-Time Dash Layout */}
              <div className="flex-1 overflow-hidden flex flex-col p-6 lg:p-10 gap-8">
                
                {/* Top Context Summary Sticky Header */}
                <motion.div 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={cn(
                    "bg-gradient-to-r from-gray-900 to-sky-900 rounded-[2.5rem] p-8 shadow-2xl flex items-center justify-between relative overflow-hidden group border border-white/10",
                    isPulseActive === '@אתר_חדש' || isPulseActive === '@איש_קשר' ? "ring-4 ring-sky-400/50" : ""
                  )}
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-sky-400/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000" />
                  <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center text-white shadow-xl">
                      <Brain size={32} className="text-sky-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white leading-tight">סיכום הקשר לקוח</h2>
                      <p className="text-sky-300 font-bold text-sm mt-1 animate-pulse">{smartSummary}</p>
                      <p className="text-sky-300/40 text-[10px] font-bold uppercase tracking-widest mt-1">Live Intelligence Analytics</p>
                    </div>
                  </div>
                  
                  <div className="hidden lg:flex items-center gap-12 text-right">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-sky-300/60 uppercase block">Preferred Site</span>
                      <p className="text-sm font-black text-white">{selectedCustomer.address || 'לא הוגדר'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-sky-300/60 uppercase block">Special Conditions</span>
                      <p className="text-sm font-black text-white truncate max-w-[200px]">
                        {selectedCustomer.unloadingRequirements || 'פריקה רגילה'}
                      </p>
                    </div>
                    <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[11px] uppercase tracking-wider backdrop-blur-md transition-all border border-white/5">
                      Explore File
                    </button>
                  </div>
                </motion.div>

                {/* 3-Column intelligence Grid */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
                  
                  {/* Left Column: Chat History */}
                  <div className="lg:col-span-5 flex flex-col bg-white rounded-[3rem] border border-gray-100 shadow-xl shadow-gray-900/5 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <MessageSquare size={14} className="text-sky-600" />
                        Chat History & Signals
                      </h3>
                      <button className="p-2 text-gray-300 hover:text-sky-600 transition-colors">
                        <Filter size={16} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col-reverse">
                      <div className="space-y-4">
                        {chatMessages.length > 0 ? (
                          chatMessages.map((msg, i) => (
                            <motion.div 
                              key={msg.id || i}
                              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={cn("flex flex-col gap-1", msg.role === 'user' ? "items-start" : "items-end")}
                            >
                              <div className={cn(
                                "max-w-[85%] p-4 rounded-3xl text-sm font-bold shadow-sm",
                                msg.role === 'user' 
                                  ? "bg-gray-100 text-gray-800 rounded-tr-none" 
                                  : "bg-sky-600 text-white rounded-tl-none shadow-xl shadow-sky-600/10"
                              )}>
                                {msg.text}
                              </div>
                              <div className="text-[9px] font-black text-gray-300 uppercase px-2">
                                {msg.senderName} • {msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'HH:mm') : 'עכשיו'}
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <div className="h-64 flex flex-col items-center justify-center opacity-30 italic">
                            <p className="text-xs text-gray-400">אין עדיין היסטוריית שיחות</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Chat Style Input bar */}
                    <div className="p-6 bg-gray-50/50 border-t border-gray-100">
                      <form onSubmit={handleSendCommand} className="relative">
                        <input 
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="כתוב הודעה או השתמש ב-@ פקודה..."
                          className="w-full h-14 bg-white border border-gray-200 rounded-2xl pl-24 pr-12 text-sm font-bold shadow-sm focus:border-sky-500 focus:ring-4 focus:ring-sky-500/5 outline-none transition-all placeholder:text-gray-300"
                        />
                        <input 
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          onChange={handleAttachment}
                        />
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-gray-400 hover:text-sky-600 transition-colors"
                          >
                            <Paperclip size={20} />
                          </button>
                          <button 
                            type="submit"
                            disabled={!chatInput.trim() || isSending}
                            className="p-3 bg-gray-900 text-white rounded-xl shadow-lg hover:bg-sky-600 disabled:opacity-50 transition-all"
                          >
                            {isSending ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <Send size={20} />}
                          </button>
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                           <Zap size={18} className={chatInput.startsWith('@') ? "text-amber-500 animate-pulse" : "text-gray-300"} />
                        </div>
                      </form>
                      <div className="mt-3 flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
                        <span>Commands: @אתר_חדש, @איש_קשר, @עדכון</span>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Noa Active
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Order Timeline */}
                  <div className="lg:col-span-7 flex flex-col bg-white rounded-[3rem] border border-gray-100 shadow-xl shadow-gray-900/5 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <History size={14} className="text-sky-600" />
                        Strategic Order Timeline
                      </h3>
                      <div className="text-[10px] font-mono text-gray-300">REAL-TIME SYNC</div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-10 space-y-12">
                       {customerOrders.length > 0 ? (
                         customerOrders.map((order, idx) => (
                           <div key={order.id} className="flex gap-10 group relative">
                             {/* Vertical roadmap line */}
                             {idx !== customerOrders.length - 1 && (
                               <div className="absolute top-10 bottom-[-48px] right-5 w-0.5 bg-gray-100 group-hover:bg-sky-100 transition-colors" />
                             )}
                             
                             <div className="w-10 shrink-0 flex flex-col items-center pt-2">
                               <div className={cn(
                                 "w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110",
                                 order.status === 'delivered' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-sky-600 shadow-sky-600/20"
                               )}>
                                 {order.status === 'delivered' ? <CheckCircle size={20} /> : <Truck size={20} />}
                               </div>
                               <span className="text-[10px] font-black text-gray-400 mt-3 uppercase tracking-tighter">{format(new Date(order.date), 'dd/MM')}</span>
                             </div>

                             <div className="flex-1 bg-gray-50 border border-transparent group-hover:border-sky-100 group-hover:bg-white p-6 rounded-[2rem] transition-all relative overflow-hidden">
                               <div className="absolute top-0 left-0 w-2 h-full bg-sky-200 group-hover:bg-sky-500 transition-colors" />
                               
                               <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <h4 className="text-xl font-black text-gray-900">הזמנה #{order.orderNumber || order.id?.slice(-4).toUpperCase()}</h4>
                                    <p className="text-sm font-bold text-gray-500 mt-1">{order.destination}</p>
                                  </div>
                                  <div className="text-left">
                                     <div className="text-[10px] font-black text-gray-400 uppercase">Estimated arrival</div>
                                     <div className="text-lg font-black text-sky-600">{order.time}</div>
                                  </div>
                               </div>

                               <div className="flex items-center gap-4">
                                  <div className="flex -space-x-2">
                                     {[1, 2].map(i => (
                                       <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200" />
                                     ))}
                                  </div>
                                  <div className="text-[11px] font-bold text-gray-400">Project Team assigned</div>
                               </div>

                               <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                     <span className={cn(
                                       "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                       order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                     )}>
                                       {order.status}
                                     </span>
                                     <span className="text-[10px] font-bold text-gray-400">Updated {format(order.updatedAt?.toDate() || new Date(), 'HH:mm')}</span>
                                  </div>
                                  <button 
                                    onClick={() => handleSmartShare(order)}
                                    className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-900 hover:text-white transition-all shadow-sm"
                                  >
                                    <Share2 size={16} />
                                  </button>
                               </div>
                             </div>
                           </div>
                         ))
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                            <p className="text-xs text-gray-400">אין הזמנות פעילות לצפייה בלוח הזמנים</p>
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SabanOS Client Brain Engine v4.0 • System Ready</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <button className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-gray-900/10 hover:bg-sky-600 transition-all">
                        Generate EOD Report
                      </button>
                   </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
               <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-gray-100 mb-8 shadow-inner border border-gray-50">
                 <Users size={48} />
               </div>
               <h2 className="text-3xl font-black text-gray-900 mb-2 italic">בחר לקוח מרשימת הניהול</h2>
               <p className="text-sm font-bold text-gray-400 max-w-sm">צפה בהיסטוריה, סיכומי שיחות ונהל תקשורת חכמה בסינון מהיר.</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Visual Overlay Signature */}
      <div className="fixed bottom-6 left-6 z-50 pointer-events-none">
         <div className="bg-white/80 backdrop-blur-md border border-sky-100 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-xl">
           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.3)]"></div>
           <span className="text-[11px] font-black text-gray-700 italic">באדיבות נועה ❤️</span>
         </div>
      </div>
    </div>
  );
};
