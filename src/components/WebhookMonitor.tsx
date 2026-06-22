import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Database,
  ExternalLink,
  Trash2,
  Lock,
  MessageCircle,
  Mail,
  FileText,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GasService } from '../services/gasService';
import { cn } from '../lib/utils';

interface LogEntry {
  id: string;
  triggerType: string;
  timestamp: string;
  payload: any;
  status: 'success' | 'failed' | 'skipped';
}

interface WebhookMonitorProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToast?: (title: string, message: string, type: 'success' | 'info' | 'warning') => void;
}

export const WebhookMonitor: React.FC<WebhookMonitorProps> = ({ isOpen, onClose, onAddToast }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadLogs = () => {
    setIsRefreshing(true);
    const joniLogs = GasService.getJoniHistory();
    setLogs(joniLogs);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const clearLogs = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את כל היסטוריית הניטור המקומית?')) {
      localStorage.removeItem('saban_os_joni_history');
      setLogs([]);
      if (onAddToast) onAddToast('היסטוריה נמחקה', 'יומן הפעילות המקומי של JONI אופס.', 'success');
    }
  };

  const getTriggerBadge = (type: string) => {
    switch(type) {
      case 'order':
        return <span className="bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded text-xs font-bold font-mono">סנכרון הזמנה</span>;
      case 'order_created':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-xs font-bold font-mono">הזמנה חדשה</span>;
      case 'whatsapp':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-xs font-bold font-mono">וואטסאפ לנהג</span>;
      case 'email':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded text-xs font-bold font-mono">מייל לקוח</span>;
      default:
        return <span className="bg-gray-50 text-gray-700 border border-gray-200 px-1.5 py-0.5 rounded text-xs font-bold font-mono">{type}</span>;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      JSON.stringify(log.payload || {}).toLowerCase().includes(searchQuery.toLowerCase()) || 
      log.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || log.triggerType === selectedType;
    
    return matchesSearch && matchesType;
  });

  const successCount = logs.filter(l => l.status === 'success').length;
  const failureCount = logs.filter(l => l.status === 'failed').length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9999]"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl z-[10000] flex flex-col h-full text-slate-100 select-none pb-0"
            dir="rtl"
          >
            {/* Header / Brand Status */}
            <div className="p-3 bg-gradient-to-l from-slate-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                  <Activity className="text-amber-400 animate-pulse" size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-white tracking-wide">מרכז בקרה וניטור Webhooks</span>
                  <span className="text-[10px] text-emerald-400 leading-none font-bold">נועה | מחוברת ✅</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={loadLogs} 
                  disabled={isRefreshing}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all disabled:opacity-50"
                  title="רענן יומן"
                >
                  <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
                </button>
                <button 
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Micro Dashboard Stats */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-2 border-b border-slate-800">
              <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-lg flex flex-col items-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">סה״כ אירועים</span>
                <span className="text-md font-black text-sky-400 mt-0.5">{logs.length}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-lg flex flex-col items-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">שוגרו בהצלחה</span>
                <span className="text-md font-black text-emerald-400 mt-0.5">{successCount}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-lg flex flex-col items-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">שגיאות שידור</span>
                <span className="text-md font-black text-red-400 mt-0.5">{failureCount}</span>
              </div>
            </div>

            {/* Context Filters */}
            <div className="p-2 bg-slate-900 border-b border-slate-800 flex flex-col gap-1.5">
              <div className="relative">
                <Search className="absolute right-2 top-2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="חיפוש קטלוג, הזמנה או לקוח..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-lg pl-3 pr-7 py-1.5 focus:border-amber-500/50 outline-none"
                />
              </div>

              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {[
                  { id: 'all', label: 'הכל' },
                  { id: 'order', label: 'סנכרון' },
                  { id: 'order_created', label: 'חדשות' },
                  { id: 'whatsapp', label: 'וואטסאפ' },
                  { id: 'email', label: 'מייל' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedType(tab.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-black transition-all whitespace-nowrap",
                      selectedType === tab.id 
                        ? "bg-amber-500 text-slate-950 shadow-sm" 
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}

                {logs.length > 0 && (
                  <button
                    onClick={clearLogs}
                    className="mr-auto px-2 py-1 text-red-400 hover:text-red-300 bg-red-950/20 rounded-md border border-red-900/30 text-[10px] flex items-center gap-1 transition-all"
                  >
                    <Trash2 size={10} />
                    איפוס
                  </button>
                )}
              </div>
            </div>

            {/* List log messages */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-950Scroll">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-950/30 rounded-xl p-4 border border-slate-800/40">
                  <Database size={24} className="text-slate-600 mb-2" />
                  <span className="text-xs font-bold text-slate-400">אין אירועים תואמים ביומן</span>
                  <span className="text-[10px] text-slate-500 mt-1">יומן הדפדפן ריק או שלא הופעל סנכרון עדיין</span>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dateFormatted = new Date(log.timestamp).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <div 
                      key={log.id} 
                      className={cn(
                        "transition-all rounded-lg border bg-slate-900",
                        log.status === 'success' 
                          ? "border-emerald-950/40 hover:border-emerald-900/60" 
                          : "border-red-950/40 hover:border-red-900/60",
                        isExpanded && "border-slate-700"
                      )}
                    >
                      {/* Log Row Header */}
                      <div 
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-2 flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="mt-0.5">
                            {log.status === 'success' ? (
                              <CheckCircle2 size={14} className="text-emerald-400" />
                            ) : (
                              <AlertTriangle size={14} className="text-red-400" />
                            )}
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-white leading-tight">
                              {log.payload?.customerName || log.payload?.customer || 'מערכת'}
                            </span>
                            <span className="text-[9px] text-slate-400 leading-none mt-0.5">
                              הזמנה #{log.payload?.orderNumber || log.payload?.id || 'ללא'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getTriggerBadge(log.triggerType)}
                          <span className="text-[9px] font-mono text-slate-400">{dateFormatted}</span>
                          {isExpanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                        </div>
                      </div>

                      {/* Expanded Payload Detail */}
                      {isExpanded && (
                        <div className="px-2 pb-2 pt-1 border-t border-slate-800 bg-slate-950/80 rounded-b-lg font-mono text-[10px] space-y-1 text-right">
                          <div className="flex justify-between border-b border-slate-900 pb-1 text-slate-400">
                            <span>זמן שידור:</span>
                            <span className="text-white">{new Date(log.timestamp).toLocaleString('he-IL')}</span>
                          </div>
                          
                          <div className="flex justify-between border-b border-slate-900 pb-1 text-slate-400">
                            <span>מזהה אירוע:</span>
                            <span className="text-white select-all">{log.id}</span>
                          </div>

                          <div className="flex justify-between border-b border-slate-900 pb-1 text-slate-400">
                            <span>מצב שידור:</span>
                            <span className={log.status === 'success' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {log.status === 'success' ? 'נשלח בהצלחה ✅' : `כושל ❌`}
                            </span>
                          </div>

                          {log.payload?.error && (
                            <div className="bg-red-950/30 text-red-400 border border-red-900/30 rounded p-1.5 text-xs">
                              <strong>שגיאה:</strong> {log.payload.error}
                            </div>
                          )}

                          {/* Render items matched (SKU) if present */}
                          <div className="pt-1 select-text">
                            <span className="text-indigo-400 font-bold text-[9px] uppercase tracking-wider block mb-1">Payload JSON:</span>
                            <pre className="p-1 px-1.5 bg-slate-900 rounded overflow-x-auto text-[9px] text-slate-300 max-h-48 text-left" dir="ltr">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Signature */}
            <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-center flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400 mb-1">
                מערכת הניטור עוקבת אחר קריאות Webhook ומספקת שקיפות מלאה מול Make.com
              </span>
              <div className="signature text-xs text-amber-400 font-black tracking-wide">
                באדיבות נועה ❤️
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
