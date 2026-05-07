import React, { useState, useRef } from 'react';
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
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  processNoaBridge, 
  createOrder, 
  getCustomerByNumber, 
  updateCustomer,
  updateOrder
} from '../services/auraService';
import { GasService } from '../services/gasService';
import { useToast } from '../providers/ToastProvider';
import { InventoryItem, Order } from '../types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface NoaBridgeGatewayProps {
  onBack: () => void;
}

interface BridgeAnalysis {
  customer: { id: string; name: string; isNew: boolean };
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
  const [isUpdatingInventory, setIsUpdatingInventory] = useState(false);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inventoryInputRef = useRef<HTMLInputElement>(null);

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setAnalysis(null);
    try {
      const result = await processNoaBridge(inputText);
      setAnalysis(result);
      addToast('נועה ניתחה!', 'הזיהוי הושלם בהצלחה ✅', 'success');
    } catch (error: any) {
      addToast('שגיאה', error.message || 'לא הצלחתי לנתח את הדרעק הזה...', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateItem = (idx: number, updates: any) => {
    if (!analysis) return;
    const newItems = [...analysis.items];
    newItems[idx] = { ...newItems[idx], ...updates };
    setAnalysis({ ...analysis, items: newItems });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setAnalysis(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await processNoaBridge({ fileBase64: base64, mimeType: file.type });
      setAnalysis(result);
      addToast('הקובץ פוענח!', 'נועה חילצה את כל הפריטים ✅', 'success');
    } catch (error: any) {
      addToast('שגיאה בסריקה', error.message || 'הקובץ כנראה מסובך מדי אפילו בשבילי', 'warning');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInventoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUpdatingInventory(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

      let updatedCount = 0;
      for (const row of rows) {
        const sku = row.SKU || row['מק"ט'] || row.sku;
        const name = row.Name || row['שם'] || row.name;
        const stock = parseFloat(row.Stock || row['מלאי'] || row.stock || 0);

        if (sku) {
          const q = query(collection(db, 'inventory'), where('sku', '==', sku.toString()), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(db, 'inventory', snap.docs[0].id), {
              currentStock: stock,
              updatedAt: serverTimestamp()
            });
          } else {
            await addDoc(collection(db, 'inventory'), {
              sku: sku.toString(),
              name: name || 'מוצר חדש',
              currentStock: stock,
              minStock: 0,
              unit: 'יחידה',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          updatedCount++;
        }
      }
      addToast('מלאי מעודכן', `עודכנו ${updatedCount} פריטים במערכת ✅`, 'success');
    } catch (error: any) {
      addToast('שגיאה במלאי', error.message || 'לא הצלחתי לעדכן את המלאי', 'warning');
    } finally {
      setIsUpdatingInventory(false);
      if (inventoryInputRef.current) inventoryInputRef.current.value = '';
    }
  };

  const generateEODReport = async () => {
    try {
      addToast('מפיק דוח EOD', 'מתעדת פעילות ב-BlackBox...', 'info');
      const sessionsQ = query(collection(db, 'bridge_sessions'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(sessionsQ);
      const totalProcessed = snap.size;

      await GasService.logBlackBox({
        type: 'EOD_SUMMARY',
        totalProcessed,
        timestamp: new Date().toISOString(),
        summary: `סיכום יום: נועה גשר עיבדה ${totalProcessed} בקשות מהשטח.`
      });

      addToast('דוח בוצע', 'הסיכום נשלח ל-BlackBox_Logs ✅', 'success');
    } catch (error: any) {
      addToast('שגיאה בדוח', error.message, 'warning');
    }
  };

  const handleCopyResponse = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis.whatsappResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('הועתק!', 'התשובה ממתינה בלוח שלך 📋', 'success');
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

      // Sync to WhatsApp sheet as well
      await GasService.syncWhatsApp({
        customer: analysis.customer.name,
        items: itemsString,
        response: analysis.whatsappResponse,
        orderId: result.id
      });

      // Log session for EOD
      await addDoc(collection(db, 'bridge_sessions'), {
        customerId: analysis.customer.id,
        customerName: analysis.customer.name,
        itemCount: analysis.items.length,
        createdAt: serverTimestamp()
      });

      addToast('הוזרק בהצלחה!', 'ההזמנה בלוח והתשובה ב-whatsap ✅', 'success');
    } catch (error: any) {
      addToast('שגיאת הזרקה', error.message || 'משהו נתקע בצינורות...', 'warning');
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 p-6 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2.5 hover:bg-gray-100 rounded-2xl transition-all text-gray-500"
            >
              <ChevronRight size={24} />
            </button>
            <div className="flex items-center gap-4">
              <div className="bg-sky-600/10 p-3 rounded-2xl">
                <Sparkles size={28} className="text-sky-600" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Noa-Bridge Gateway</h1>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">SabanOS Operational Concierge</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={generateEODReport}
               className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg hover:bg-sky-600 transition-all active:scale-95"
             >
               <Activity size={14} />
               הפק EOD (BlackBox)
             </button>
             <div className="h-8 w-px bg-gray-100 mx-2" />
             <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black text-emerald-600 uppercase">System Ready</span>
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full grid lg:grid-cols-12">
          {/* LEFT Sidebar / Menu */}
          <div className="lg:col-span-1 border-l border-gray-100 flex flex-col items-center py-8 gap-6 bg-white shrink-0">
             <input type="file" ref={inventoryInputRef} onChange={handleInventoryUpload} className="hidden" accept=".xls,.xlsx" />
             <button 
               onClick={() => inventoryInputRef.current?.click()}
               className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-sky-50 hover:text-sky-600 transition-all border border-transparent hover:border-sky-100 relative group"
               title="Update Inventory Master"
             >
               {isUpdatingInventory ? <Loader2 size={24} className="animate-spin text-sky-600" /> : <FileSpreadsheet size={24} />}
               <span className="absolute right-full mr-4 px-3 py-1.5 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Update Master Inventory</span>
             </button>
             <button className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-sky-50 hover:text-sky-600 transition-all group relative">
               <Tag size={24} />
               <span className="absolute right-full mr-4 px-3 py-1.5 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Law Book</span>
             </button>
             <button className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-sky-50 hover:text-sky-600 transition-all group relative">
               <Layers size={24} />
               <span className="absolute right-full mr-4 px-3 py-1.5 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">History Logs</span>
             </button>
          </div>

          {/* CENTER: Input Pane */}
          <div className="lg:col-span-5 flex flex-col border-l border-gray-100 bg-white/50 p-6 gap-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <MessageSquare size={20} className="text-sky-600" />
                  קלט גולמי (WhatsApp / PDF)
                </h3>
                <div className="flex items-center gap-1.5">
                   <button 
                    onClick={() => setInputText("")}
                    className="text-[10px] font-black text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg"
                   >
                     נקה הכל
                   </button>
                </div>
              </div>

              <div className="relative group">
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="הדבק כאן את הטקסט מהוואטסאפ או פשוט תגרור קובץ..."
                  className="w-full h-[60vh] bg-white border-2 border-gray-100 rounded-[2.5rem] p-8 text-lg font-medium text-gray-800 placeholder:text-gray-300 focus:border-sky-500 focus:ring-0 transition-all resize-none shadow-sm"
                />
                <div className="absolute bottom-8 left-8 flex items-center gap-3">
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden" 
                    accept=".pdf,.xls,.xlsx,image/*"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="p-5 bg-gray-100 text-gray-500 rounded-3xl hover:bg-sky-50 hover:text-sky-600 transition-all border border-transparent hover:border-sky-100"
                    title="העלאת קובץ"
                  >
                    <Paperclip size={24} />
                  </button>
                  <button 
                    onClick={handleProcess}
                    disabled={!inputText.trim() || isProcessing}
                    className="px-10 py-5 bg-sky-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-sky-600/20 hover:bg-sky-700 active:scale-95 transition-all flex items-center gap-4 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isProcessing ? (
                      <Loader2 size={28} className="animate-spin" />
                    ) : (
                      <>
                        <Zap size={26} fill="currentColor" />
                        <span>נתחי מהר!</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-3xl bg-amber-50/50 border border-amber-100/50">
                  <div className="flex items-center gap-2 mb-2 text-amber-600 font-black text-[10px] uppercase tracking-widest">
                    <AlertTriangle size={14} />
                    Accuracy Law
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-bold">זיהוי מפרטים חסרים.</p>
                </div>
                <div className="p-5 rounded-3xl bg-indigo-50/50 border border-indigo-100/50">
                  <div className="flex items-center gap-2 mb-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
                    <TrendingDown size={14} />
                    Delay Items
                  </div>
                  <p className="text-[11px] text-indigo-700 leading-relaxed font-bold">סימון פריטי חנות קטנים.</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Output Pane */}
          <div className="lg:col-span-6 p-6 overflow-y-auto bg-gray-50/30">
            <AnimatePresence mode="wait">
              {analysis ? (
                <motion.div 
                  key="analysis"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-6"
                >
                  {/* Customer Block */}
                  <div className="relative">
                    <div className="bg-white rounded-[2.5rem] p-8 border border-sky-100 shadow-xl overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className="w-16 h-16 bg-sky-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg">
                            <Database size={32} />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-2xl font-black text-gray-900">{analysis.customer.name}</h3>
                              {analysis.customer.isNew ? (
                                <span className="bg-amber-100 text-amber-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">New Client</span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Identified</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-gray-400 font-bold text-sm tracking-wider">ID: {analysis.customer.id}</p>
                              {analysis.site && (
                                <>
                                  <div className="w-1 h-1 bg-gray-200 rounded-full" />
                                  <p className="text-sky-600 font-black text-sm">{analysis.site}</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button 
                          className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:text-sky-600 hover:bg-sky-50 transition-all border border-transparent hover:border-sky-100"
                        >
                          <Pin size={22} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Validated Items ({analysis.items.length})</h4>
                    </div>
                    <div className="space-y-3">
                      {analysis.items.map((item, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`bg-white p-5 rounded-3xl border shadow-sm flex items-center justify-between group hover:shadow-md transition-all ${
                            item.status === 'validated' ? 'border-gray-100' : 'border-amber-100 bg-amber-50/20'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                              item.status === 'validated' ? 'bg-sky-50 text-sky-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                              {item.qty}
                            </div>
            <div>
                               <div className="flex items-center gap-2">
                                  {editingItemIdx === idx ? (
                                    <input 
                                      type="text" 
                                      value={item.name} 
                                      onChange={(e) => handleUpdateItem(idx, { name: e.target.value })}
                                      onBlur={() => setEditingItemIdx(null)}
                                      autoFocus
                                      className="text-lg font-bold bg-sky-50 border-none p-0 focus:ring-0 w-full rounded"
                                    />
                                  ) : (
                                    <span className="font-bold text-gray-800 text-lg leading-tight">{item.name}</span>
                                  )}
                                  {item.status !== 'validated' && <AlertCircle size={14} className="text-amber-500" />}
                               </div>
                               <div className="flex items-center gap-3">
                                  {editingItemIdx === idx ? (
                                    <div className="flex gap-2">
                                      <input 
                                        type="text" 
                                        value={item.sku} 
                                        onChange={(e) => handleUpdateItem(idx, { sku: e.target.value })}
                                        className="text-[10px] w-20 bg-gray-50 border-none p-1 rounded"
                                      />
                                      <input 
                                        type="text" 
                                        value={item.unit} 
                                        onChange={(e) => handleUpdateItem(idx, { unit: e.target.value })}
                                        className="text-[10px] w-12 bg-gray-50 border-none p-1 rounded"
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SKU: {item.sku || 'UNKNOWN'}</span>
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">UNIT: {item.unit}</span>
                                    </>
                                  )}
                               </div>
                               {item.notes && <p className="text-[10px] font-black text-amber-600 mt-1 italic">{item.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={() => setEditingItemIdx(editingItemIdx === idx ? null : idx)}
                               className={`p-2.5 rounded-xl transition-all ${
                                 editingItemIdx === idx ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-300 hover:text-sky-600 hover:bg-sky-50'
                               }`}
                             >
                               {editingItemIdx === idx ? <Check size={18} /> : <Pencil size={18} />}
                             </button>
                             <button 
                               onClick={() => {
                                 const newItems = analysis.items.filter((_, i) => i !== idx);
                                 setAnalysis({ ...analysis, items: newItems });
                               }}
                               className="p-2.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                             >
                               <Trash2 size={18} />
                             </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Actions & Response */}
                  <div className="space-y-4 pt-4 pb-12">
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl p-8 space-y-6">
                       <div className="flex items-center justify-between">
                          <h4 className="text-xl font-black text-gray-900 flex items-center gap-3">
                            <div className="bg-sky-600 p-2 rounded-xl text-white">
                              <Send size={18} />
                            </div>
                            WhatsApp Concierge Output
                          </h4>
                          <button 
                            onClick={handleCopyResponse}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all ${
                              copied ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'
                            }`}
                          >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'הועתק!' : 'העתקת תגובה'}
                          </button>
                       </div>

                       <div className="bg-gray-50/50 rounded-3xl p-8 relative border border-gray-100">
                          <p className="text-gray-700 leading-relaxed font-bold text-lg whitespace-pre-wrap text-right" dir="rtl">{analysis.whatsappResponse}</p>
                       </div>

                       <div className="pt-4 flex gap-4">
                          <button 
                            onClick={handleInjectOrder}
                            disabled={isInjecting}
                            className="flex-1 bg-gray-900 text-white py-6 rounded-3xl font-black text-xl shadow-2xl hover:bg-sky-600 transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
                          >
                            {isInjecting ? (
                              <Loader2 size={24} className="animate-spin" />
                            ) : (
                              <>
                                <ArrowRightCircle size={26} />
                                הזרקת הזמנה לסלון!
                              </>
                            )}
                          </button>
                       </div>
                    </div>
                    
                    <div className="text-center py-6">
                       <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">באדיבות נועה ❤️ (Operations Bridge v1.0)</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                   <div className="w-40 h-40 bg-gray-100 rounded-[3rem] flex items-center justify-center text-gray-300 mb-8 border-2 border-dashed border-gray-200">
                      <Sparkles size={80} />
                   </div>
                   <h3 className="text-3xl font-black text-gray-400">ממתינה לנתונים...</h3>
                   <p className="max-w-xs text-gray-400 font-bold mt-4 leading-relaxed">הדבק טקסט או העלה קובץ משמאל כדי שנועה תוכל לגשר בין השטח למערכת.</p>
                   
                   <div className="mt-16 w-full max-w-sm space-y-4">
                      <div className="p-6 rounded-3xl bg-white border border-gray-100 flex items-center gap-5 opacity-40">
                        <div className="w-14 h-14 bg-gray-50 rounded-2xl" />
                        <div className="space-y-2">
                           <div className="h-2.5 w-40 bg-gray-100 rounded-full" />
                           <div className="h-2 w-24 bg-gray-100 rounded-full opacity-50" />
                        </div>
                      </div>
                      <div className="p-6 rounded-3xl bg-white border border-gray-100 flex items-center gap-5 opacity-20">
                        <div className="w-14 h-14 bg-gray-50 rounded-2xl" />
                        <div className="space-y-2">
                           <div className="h-2.5 w-32 bg-gray-100 rounded-full" />
                           <div className="h-2 w-20 bg-gray-100 rounded-full opacity-50" />
                        </div>
                      </div>
                   </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
