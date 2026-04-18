import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  History, 
  Send, 
  CheckCircle2, 
  Clock, 
  Truck, 
  ArrowLeft,
  Share2,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  PlusCircle,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, DRIVERS } from '../services/auraService';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface MorningReport {
  id?: string;
  date: string;
  orderIds: string[];
  reportText: string;
  createdAt: any;
}

export default function MorningReportSystem({ onBack }: { onBack: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<MorningReport[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeReport, setActiveReport] = useState<MorningReport | null>(null);

  useEffect(() => {
    // Listen for active orders (not delivered)
    const qOrders = query(
      collection(db, 'orders'), 
      where('status', '!=', 'delivered'),
      orderBy('status'),
      orderBy('time', 'asc')
    );
    
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(ordersList);
    });

    // Listen for report history
    const qReports = query(
      collection(db, 'morning_reports'), 
      orderBy('createdAt', 'desc')
    );
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      const reportsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MorningReport[];
      setReports(reportsList);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeReports();
    };
  }, []);

  const generateReportText = (selectedIds: string[]) => {
    const reportDate = format(new Date(), 'dd/MM/yyyy');
    const selectedOrdersData = orders.filter(o => selectedIds.includes(o.id!));
    
    let text = `📅 *דוח בוקר - ח. סבן | ${reportDate}*\n\n`;

    DRIVERS.forEach(driver => {
      const driverOrders = selectedOrdersData.filter(o => o.driverId === driver.id);
      if (driverOrders.length > 0) {
        text += `👤 *${driver.name}:*\n`;
        driverOrders.forEach(o => {
          const idStr = o.orderNumber ? `#${o.orderNumber}` : `#${o.id?.slice(-4).toUpperCase()}`;
          text += `• ${o.time} | ${idStr} ${o.customerName} - ${o.destination} (${o.warehouse})\n`;
        });
        text += `\n`;
      }
    });

    // Stats
    const total = selectedOrdersData.length;
    const harashCount = selectedOrdersData.filter(o => o.warehouse === 'החרש').length;
    const talmidCount = selectedOrdersData.filter(o => o.warehouse === 'התלמיד').length;
    const craneCount = selectedOrdersData.filter(o => DRIVERS.find(d => d.id === o.driverId)?.type === 'crane').length;
    const truckCount = total - craneCount;

    text += `📊 *סיכום לוגיסטי:*\n`;
    text += `סה"כ הזמנות: ${total}\n`;
    text += `📦 מהמחסנים: החרש (${harashCount}) | התלמיד (${talmidCount})\n`;
    text += `🚛 סוגי הובלה: מנוף (${craneCount}) | משאית (${truckCount})\n`;
    text += `\nסידור נעים, שיהיה לנו בוקר טוב! ✨`;

    return text;
  };

  const handleSaveReport = async () => {
    if (selectedOrders.length === 0) return;
    
    setIsGenerating(true);
    const reportText = generateReportText(selectedOrders);
    
    try {
      await addDoc(collection(db, 'morning_reports'), {
        date: format(new Date(), 'yyyy-MM-dd'),
        orderIds: selectedOrders,
        reportText,
        createdAt: serverTimestamp()
      });
      setSelectedOrders([]);
      alert('הדוח נשמר בהצלחה בארכיון! ✅');
    } catch (error) {
      console.error('Error saving report:', error);
      alert('אופס, הייתה שגיאה בשמירה אחי 😕');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('הדוח הועתק! עכשיו אפשר להדביק בוואטסאפ 🚀');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white rounded-full transition-colors shadow-sm"
          >
            <ArrowLeft className="text-gray-600 rotate-180" size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <FileText className="text-sky-600" />
              ארכיון דוחות בוקר
            </h1>
            <p className="text-sm text-gray-400 font-medium italic">ריכוז סידור עבודה ושיתוף מהיר</p>
          </div>
        </div>
        <div className="hidden md:flex bg-white/80 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-sky-100">
           <div className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-500">
             <Layers size={14} />
             {orders.length} הזמנות פעילות
           </div>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-8">
        {/* Creation Section */}
        <div className="md:col-span-12 lg:col-span-7 space-y-6">
          <div className="bg-white/80 backdrop-blur-md rounded-[32px] shadow-sm border border-sky-100 overflow-hidden">
            <div className="p-6 border-b border-sky-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                <PlusCircle size={20} className="text-sky-600" />
                יצירת דוח חדש
              </h2>
              <span className="text-xs font-bold text-gray-400">בחר הזמנות לסידור</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-gray-50/30 text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                    <th className="px-6 py-4 w-12 text-center text-gray-900 italic">#</th>
                    <th className="px-6 py-4">לקוח</th>
                    <th className="px-6 py-4">נהג</th>
                    <th className="px-6 py-4">זמן</th>
                    <th className="px-6 py-4">מחסן</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center opacity-30 select-none">
                        <Clock size={48} className="mx-auto mb-4" />
                        <p className="font-bold text-lg">אין הזמנות פתוחות כרגע אחי</p>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const isSelected = selectedOrders.includes(order.id!);
                      return (
                        <tr 
                          key={order.id} 
                          onClick={() => {
                            if (isSelected) {
                              setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                            } else {
                              setSelectedOrders([...selectedOrders, order.id!]);
                            }
                          }}
                          className={`cursor-pointer transition-colors group ${isSelected ? 'bg-sky-50/30' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-6 py-4 text-center">
                            {isSelected ? (
                              <div className="w-5 h-5 bg-sky-600 rounded-lg flex items-center justify-center mx-auto text-white">
                                <CheckSquare size={14} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 border-2 border-gray-200 rounded-lg mx-auto group-hover:border-sky-200" />
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-[10px] font-black bg-gray-900 text-white px-1.5 py-0.5 rounded-md">
                              #{order.orderNumber || order.id?.slice(-4).toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 text-sm">{order.customerName}</div>
                            <div className="text-[10px] text-gray-400 font-medium truncate max-w-[150px]">{order.destination}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs font-bold text-gray-600">
                              {DRIVERS.find(d => d.id === order.driverId)?.name.split(' ')[0]}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-black text-sky-600">{order.time}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg font-bold">{order.warehouse}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-gray-50/50">
              <button
                disabled={selectedOrders.length === 0 || isGenerating}
                onClick={handleSaveReport}
                className="w-full bg-sky-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-sky-700 transition-colors shadow-lg shadow-sky-600/20 disabled:opacity-50 disabled:shadow-none"
              >
                {isGenerating ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Share2 size={20} />
                    צור ושמור דוח לארכיון
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* History Section */}
        <div className="md:col-span-12 lg:col-span-5 space-y-6">
          <div className="bg-white/80 backdrop-blur-md rounded-[32px] shadow-sm border border-sky-100 p-6">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg mb-6">
              <History size={20} className="text-blue-500" />
              היסטוריית דוחות
            </h2>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {reports.length === 0 ? (
                <div className="text-center py-10 opacity-30 select-none">
                  <p className="text-sm font-bold">טרם נוצרו דוחות</p>
                </div>
              ) : (
                reports.map((report) => (
                  <div 
                    key={report.id}
                    className="p-4 rounded-3xl border border-gray-100 hover:border-sky-100 hover:bg-sky-50/10 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-sky-50 text-sky-500 p-2 rounded-xl">
                          <Calendar size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-gray-900">{format(new Date(report.createdAt?.toDate() || new Date()), 'dd/MM/yyyy')}</div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase">{report.orderIds.length} הזמנות בדוח</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(report.reportText)}
                        className="p-2 text-sky-500 hover:bg-sky-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                        title="העתק לוואטסאפ"
                      >
                        <Share2 size={18} />
                      </button>
                    </div>
                    <div className="bg-gray-50/50 p-3 rounded-2xl text-[10px] text-gray-500 font-medium whitespace-pre-wrap line-clamp-3 italic">
                      {report.reportText}
                    </div>
                    <button 
                      onClick={() => setActiveReport(report)}
                      className="mt-3 w-full text-center text-[10px] font-black text-sky-600 hover:underline uppercase tracking-tight"
                    >
                      פתיחה מלאה ועריכה
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {activeReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden overflow-y-auto max-h-[90vh]"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-gray-900 italic">תצוגת דוח מלאה</h3>
                  <button onClick={() => setActiveReport(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={24} className="text-gray-400" />
                  </button>
                </div>
                
                <div className="bg-gray-900 text-green-400 p-6 rounded-3xl font-mono text-sm leading-relaxed mb-6 overflow-x-auto whitespace-pre-wrap">
                  {activeReport.reportText}
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <button 
                    onClick={() => {
                      copyToClipboard(activeReport.reportText);
                      setActiveReport(null);
                    }}
                    className="bg-green-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
                   >
                     <Share2 size={20} />
                     העתק לוואטסאפ
                   </button>
                   <button 
                    onClick={() => setActiveReport(null)}
                    className="bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                   >
                     סגירה
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const X = ({ size, className }: { size: number, className: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
