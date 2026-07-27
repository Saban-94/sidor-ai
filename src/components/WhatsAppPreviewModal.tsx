import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  Smartphone, 
  UserCheck, 
  Truck, 
  FileText, 
  AlertTriangle, 
  Sparkles,
  RefreshCw,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { GasService } from '../services/gasService';

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
  recipientPhone?: string;
  recipientName?: string;
  customerName?: string;
  recipientRole?: 'driver' | 'customer' | 'siddur' | 'management';
  orderId?: string;
  onSentSuccess?: () => void;
  onAddToast?: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({
  isOpen,
  onClose,
  initialMessage = '',
  recipientPhone = '0501234567',
  recipientName,
  customerName,
  recipientRole = 'customer',
  orderId,
  onSentSuccess,
  onAddToast
}) => {
  const activeName = recipientName || customerName || 'ראמי / לקוח סבן';
  const [messageText, setMessageText] = useState<string>('');
  const [phone, setPhone] = useState<string>(recipientPhone);
  const [targetRole, setTargetRole] = useState<'driver' | 'customer' | 'siddur' | 'management'>(recipientRole);
  const [targetName, setTargetName] = useState<string>(activeName);
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sentResult, setSentResult] = useState<{ status: 'idle' | 'success' | 'error'; msg?: string }>({ status: 'idle' });

  useEffect(() => {
    setTargetName(recipientName || customerName || 'ראמי / לקוח סבן');
    setPhone(recipientPhone || '0501234567');
    setMessageText(initialMessage || getDefaultTemplate(recipientRole, recipientName || customerName || 'ראמי / לקוח סבן'));
  }, [isOpen, initialMessage, recipientPhone, recipientName, customerName, recipientRole]);

  if (!isOpen) return null;

  function getDefaultTemplate(role: string, name: string) {
    const today = new Date().toLocaleDateString('he-IL');
    if (role === 'driver') {
      return `🚚 *סידור עבודה ומשלוח לנהג - SBN Logistics*\nשלום *${name}*,\nלהלן תעודת המשלוח להיום (${today}):\n• הזמנה: #${orderId || '6214480'}\n• יעד: פרויקט בילו / לירן\n• ציוד: 2 בלות חול + 1 משטח בלוקים\n• דרישת פקדונות: ✅ מאושר\n\n_באדיבות נועה ❤️_`;
    } else if (role === 'siddur') {
      return `📅 *סידור עבודה יומי מרוכז - ח.סבן*\nתאריך: ${today}\n• נהגים פעילים: עלי (משאית 1), חכמת (מנוף 2)\n• סה"כ משלוחים מתוכננים: 8\n• חריגות פקדונות פתוחות: 0 ⚠️\n\nנא לאשר קבלה בלחיצה. _נועה | מחוברת ✅_`;
    } else if (role === 'management') {
      return `📊 *דוח בוקר ניהולי - SBN Logistics*\nתאריך: ${today}\n• הזמנות בטיפול: 12\n• לקוחות פעילים: 28\n• סטטוס מנוע: פעיל ומחובר ✅\n\nבאדיבות נועה ❤️`;
    }
    return `🏗️ *אישור הזמנה וגליה - ח.סבן חומרי בניין*\nשלום *${name}*,\nהזמנתך #${orderId || '6214480'} נקלטה במערכת בהצלחה!\n• סטטוס: בטיפול לוגיסטי\n• אספקה משוערת: היום בשעה 10:30\n• פקדונות: ✅ אין חריגות\n\nלשאלות ועדכונים השיבו להודעה זו.\n_באדיבות נועה ❤️_`;
  }

  const handleApplyTemplate = (role: 'driver' | 'customer' | 'siddur' | 'management') => {
    setTargetRole(role);
    setMessageText(getDefaultTemplate(role, targetName));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    setIsSending(true);
    setSentResult({ status: 'idle' });

    try {
      const payload = {
        phone,
        recipientName: targetName,
        recipientRole: targetRole,
        message: messageText,
        orderId,
        sentAt: new Date().toISOString()
      };

      // Direct call via JONI Pipe & GAS WhatsApp Sync
      const joniRes = await GasService.syncWhatsApp(payload);
      
      setSentResult({
        status: 'success',
        msg: 'ההודעה שוגרה בהצלחה לצינור JONI ולמערכת הווטסאפ!'
      });

      if (onSentSuccess) onSentSuccess();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setSentResult({
        status: 'error',
        msg: err.message || 'שגיאה בשליחת ההודעה'
      });
    } finally {
      setIsSending(false);
    }
  };

  const insertFormat = (prefix: string, suffix: string = prefix) => {
    setMessageText(prev => `${prev} ${prefix}טקסט מודגש${suffix}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 dir-rtl">
      <motion.div 
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-100"
      >
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>קנבס תצוגה מקדימה להודעות WhatsApp</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium border border-emerald-500/30">
                  JONI Pipe
                </span>
              </h2>
              <p className="text-xs text-slate-400">תצוגת SIM נעה, עריכה בזמן אמת ושליחה ישירה לנהגים וללקוחות</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Split Screen Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Control Form Panel (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Recipient Setup */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <span>פרטי הנמען ויעד השליחה</span>
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">שם הנמען</label>
                  <input 
                    type="text" 
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">מספר טלפון (WhatsApp)</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 text-left dir-ltr"
                  />
                </div>
              </div>

              {/* Quick Role Preset Selector */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">תבניות מהירות לפי תפקיד:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApplyTemplate('customer')}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                      targetRole === 'customer' 
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>אישור הזמנה (לקוח)</span>
                  </button>

                  <button
                    onClick={() => handleApplyTemplate('driver')}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                      targetRole === 'driver' 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>תעודת נהג</span>
                  </button>

                  <button
                    onClick={() => {
                      setTargetRole('siddur');
                      setPhone('120363428842730390@g.us');
                      setTargetName('עדכונים סידור (קבוצת WhatsApp)');
                      setMessageText(getDefaultTemplate('siddur', 'עדכונים סידור'));
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                      phone === '120363428842730390@g.us' 
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>קבוצת עדכונים סידור</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Message Textarea Editor */}
            <div className="flex flex-col flex-1 bg-slate-950/60 p-4 rounded-xl border border-slate-800 gap-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>עריכת תוכן ההודעה</span>
                </label>
                <div className="flex items-center gap-1 text-xs">
                  <button onClick={() => insertFormat('*', '*')} className="px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700 font-bold" title="מודגש">*B*</button>
                  <button onClick={() => insertFormat('_', '_')} className="px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700 italic" title="נטוי">_I_</button>
                  <button onClick={() => insertFormat('~', '~')} className="px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700 line-through" title="קו חוצה">~S~</button>
                </div>
              </div>

              <textarea 
                rows={8}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none font-sans leading-relaxed"
                placeholder="הקלד כאן את תוכן ההודעה..."
              />

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>*מודגש* | _נטוי_ | ~קו חוצה~</span>
                <span>{messageText.length} תווים</span>
              </div>
            </div>
          </div>

          {/* Right / Live Phone Mockup Preview (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="w-full max-w-sm bg-slate-950 border-4 border-slate-800 rounded-[2.5rem] p-3 shadow-2xl relative overflow-hidden flex flex-col h-[460px]">
              {/* Phone Notch */}
              <div className="w-32 h-4 bg-slate-800 rounded-b-xl mx-auto mb-2 flex items-center justify-center">
                <div className="w-12 h-1 bg-slate-900 rounded-full" />
              </div>

              {/* WhatsApp Header Mock */}
              <div className="bg-[#075e54] text-white p-3 rounded-t-xl flex items-center gap-2.5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-amber-400 border border-amber-400/40">
                  {targetName ? targetName.charAt(0) : 'S'}
                </div>
                <div className="flex-1 min-w-0 dir-rtl">
                  <div className="text-xs font-bold truncate">{targetName}</div>
                  <div className="text-[10px] text-emerald-200">מחובר/ת | SBN WhatsApp</div>
                </div>
              </div>

              {/* WhatsApp Chat Body */}
              <div className="flex-1 bg-[#0b141a] p-3 overflow-y-auto space-y-2 relative dir-rtl text-right">
                {/* Simulated Bubble */}
                <div className="bg-[#005c4b] text-white p-3 rounded-xl rounded-tr-none max-w-[90%] mr-auto shadow text-xs leading-relaxed font-sans whitespace-pre-wrap border border-emerald-600/30">
                  {messageText}
                  <div className="text-[9px] text-emerald-200 text-left mt-1 flex items-center justify-end gap-1">
                    <span>{new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                    <Check className="w-3 h-3 text-sky-400" />
                  </div>
                </div>
              </div>

              {/* Phone Bottom Footer Bar */}
              <div className="bg-slate-900 p-2 rounded-b-xl text-center text-[10px] text-slate-500">
                SBN Logistics JONI WhatsApp Channel
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center gap-2 border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'הועתק!' : 'העתק תוכן'}</span>
            </button>

            {sentResult.status === 'success' && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-4 h-4" /> {sentResult.msg}
              </span>
            )}
            {sentResult.status === 'error' && (
              <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> {sentResult.msg}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 dir-rtl">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
            >
              ביטול
            </button>

            <button
              onClick={handleSend}
              disabled={isSending || !messageText.trim()}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
            >
              {isSending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>שיגור בווטסאפ (JONI Pipe)</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
