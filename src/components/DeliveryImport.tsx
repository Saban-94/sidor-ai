import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileUp, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Info, 
  FileSpreadsheet, 
  ArrowRight,
  Database,
  FolderOpen,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  createCustomer, 
  getCustomerByNumber, 
  createOrder,
  askNoa 
} from '../services/auraService';
import { uploadFileToDrive, findSubfolderByName } from '../services/driveService';
import { Customer } from '../types';

interface ImportSummary {
  customerName: string;
  customerNumber: string;
  contactPerson: string;
  items: { sku: string; name: string; qty: number }[];
  isNewCustomer: boolean;
  type: 'order' | 'delivery_note';
}

export const DeliveryImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'order' | 'delivery_note'>('order');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noaFeedback, setNoaFeedback] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSummary(null);
      setError(null);
      setNoaFeedback(null);
    }
  };

  const processImport = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress('קורא את קובץ האקסל...');
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Parse as array of arrays to handle specific line numbers
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (rows.length < 13) {
        throw new Error('הקובץ אינו בפורמט הנכון. חסרים נתונים.');
      }

      // Logic Extraction:
      // Row 1 (index 0): Customer Name
      // Row 6 (index 5): Customer Number
      // Row 11 (index 10): Contact Person
      // Table from Row 13 (index 12): SKU, Name, Qty
      const customerName = rows[0]?.[0]?.toString().trim();
      const customerNumber = rows[5]?.[0]?.toString().trim();
      const contactPerson = rows[10]?.[0]?.toString().trim();

      if (!customerName || !customerNumber) {
        throw new Error('לא נמצא שם לקוח או מספר לקוח בשורות הצפויות.');
      }

      const items: any[] = [];
      for (let i = 12; i < rows.length; i++) {
        const row = rows[i];
        const sku = row[0]?.toString().trim();
        const itemName = row[1]?.toString().trim();
        const qty = parseFloat(row[2]);

        if (sku && itemName && !isNaN(qty)) {
          items.push({ sku, name: itemName, qty });
        }
      }

      if (items.length === 0) {
        throw new Error('לא נמצאו פריטים בטבלה החל משורה 13.');
      }

      setProgress('בודק אם הלקוח קיים במערכת...');
      let customer = await getCustomerByNumber(customerNumber);
      let isNew = false;

      if (!customer) {
        isNew = true;
        setProgress(`מקים לקוח חדש: ${customerName}...`);
        customer = await createCustomer({
          name: customerName,
          customerNumber: customerNumber,
          contactPerson: contactPerson || '',
          phoneNumber: '' // We might not have phone in this specific Excel format
        });
      }

      setProgress('מעלה את הקובץ לדרייב ומתייק...');
      let fileId = '';
      if (customer.driveFolderId) {
        const subfolderName = importType === 'order' ? 'Orders' : 'Delivery Notes';
        const targetSubfolderId = await findSubfolderByName(customer.driveFolderId, subfolderName);
        
        // Use subfolder if found, otherwise main folder
        const uploadFolderId = targetSubfolderId || customer.driveFolderId;
        const uploadResult = await uploadFileToDrive(file, uploadFolderId);
        fileId = uploadResult.fileId;
      }

      setProgress(`מזריק ${importType === 'order' ? 'הזמנה' : 'תעודת משלוח'} ללוח...`);
      const itemsString = items.map(it => `${it.qty} x ${it.name} (${it.sku})`).join('\n');
      
      const newOrder = await createOrder({
        customerName: customer.name,
        orderNumber: `XLS-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        items: itemsString,
        destination: 'עודכן מהאקסל',
        driverId: 'לא שובץ',
        warehouse: 'החרש',
        status: importType === 'order' ? 'pending' : 'ready',
        orderFormId: importType === 'order' ? fileId : undefined,
        deliveryNoteId: importType === 'delivery_note' ? fileId : undefined,
      });

      setSummary({
        customerName: customer.name,
        customerNumber: customer.customerNumber,
        contactPerson: customer.contactPerson,
        items,
        isNewCustomer: isNew,
        type: importType
      });

      setProgress('מבקש מנועה לסכם את הפעולה...');
      const noaMsg = `ראמי, הקובץ עובד! שייכתי את ה${importType === 'order' ? 'הזמנה' : 'תעודה'} ללקוח ${customer.name}, ${isNew ? 'פתחתי לו תיקייה חדשה בדרייב' : 'תייקתי בתיקייה הקיימת'} ותייקתי את האקסל בתיקיית ה${importType === 'order' ? 'הזמנות' : 'תעודות'}. הכל מעודכן.`;
      setNoaFeedback(noaMsg);
      
    } catch (err: any) {
      setError(err.message || 'קרתה תקלה בעיבוד הקובץ.');
      console.error(err);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-xl border border-sky-100 overflow-hidden"
      >
        <div className="bg-sky-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
              <FileSpreadsheet size={32} />
              יבוא הזמנות ותעודות (Export.xls)
            </h2>
            <p className="text-sky-100 font-medium opacity-90">סריקה חכמה, הקמת לקוחות ותיוק אוטומטי בדרייב.</p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Toggle Type */}
          <div className="flex p-1 bg-gray-100 rounded-2xl w-fit">
            <button 
              onClick={() => setImportType('order')}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
                importType === 'order' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              יצירת הזמנה חדשה
            </button>
            <button 
              onClick={() => setImportType('delivery_note')}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
                importType === 'delivery_note' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              יצירת תעודת משלוח
            </button>
          </div>

          {/* Upload Area */}
          <div className="relative">
            <input 
              type="file" 
              accept=".xls,.xlsx" 
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={isProcessing}
            />
            <div className={`border-3 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center transition-all ${
              file ? 'border-sky-400 bg-sky-50/50' : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50/30'
            }`}>
              <div className={`p-6 rounded-full mb-4 ${file ? 'bg-sky-100 text-sky-600' : 'bg-gray-100 text-gray-400'}`}>
                <FileUp size={48} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">
                {file ? file.name : 'גרור את הקובץ לכאן'}
              </h3>
              <p className="text-gray-400 font-bold">תומך בפורמט Export.xls המקורי של המערכת</p>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 font-bold"
            >
              <AlertTriangle size={20} />
              {error}
            </motion.div>
          )}

          <div className="flex justify-center">
            <button
              onClick={processImport}
              disabled={!file || isProcessing}
              className={`px-12 py-4 rounded-[2rem] font-black text-lg shadow-lg flex items-center gap-3 transition-all ${
                !file || isProcessing 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-sky-600 text-white hover:bg-sky-700 hover:-translate-y-1 active:scale-95'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  <span>{progress}</span>
                </>
              ) : (
                <>
                  <Sparkles size={24} />
                  <span>הפעל את נועה לסריקת הקובץ</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success Results */}
        <AnimatePresence>
          {summary && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="border-t border-sky-100 bg-sky-50/30 p-8"
            >
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-gray-400 font-black text-xs uppercase tracking-widest mb-4">זיהוי לקוח</h4>
                  <div className="bg-white p-6 rounded-3xl border border-sky-100 shadow-sm flex items-start gap-4">
                    <div className="bg-sky-600 p-3 rounded-xl text-white">
                      <Database size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-gray-900 text-lg">{summary.customerName}</span>
                        {summary.isNewCustomer && (
                          <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full">לקוח חדש!</span>
                        )}
                      </div>
                      <p className="text-gray-500 font-bold text-sm">מס' לקוח: {summary.customerNumber}</p>
                      <p className="text-gray-500 font-bold text-sm">איש קשר: {summary.contactPerson}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-gray-400 font-black text-xs uppercase tracking-widest mb-4">פריטים שחולצו ({summary.items.length})</h4>
                  <div className="bg-white p-6 rounded-3xl border border-sky-100 shadow-sm max-h-40 overflow-y-auto">
                    {summary.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <span className="font-bold text-gray-800">{item.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-400 font-bold">מק"ט: {item.sku}</span>
                          <span className="bg-sky-50 text-sky-600 px-2 py-0.5 rounded-lg font-black text-xs">x{item.qty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {noaFeedback && (
                <div className="mt-8 bg-sky-600 rounded-[2rem] p-6 text-white flex gap-4 items-start shadow-xl animate-in slide-in-from-bottom-4">
                  <div className="bg-white/20 p-3 rounded-2xl">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h5 className="font-black text-lg mb-1 italic">נועה אומרת:</h5>
                    <p className="font-medium text-sky-50">{noaFeedback}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Database, label: 'בדיקת לקוח', desc: 'חיפוש אוטומטי לפי מספר לקוח' },
          { icon: FolderOpen, label: 'ניהול תיקיות', desc: 'הקמת עץ תיקיות בדרייב' },
          { icon: ArrowRight, label: 'הזרמת מידע', desc: 'יצירת ההזמנה ישר בלוח' }
        ].map((feat, i) => (
          <div key={i} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="bg-gray-100 p-2 rounded-xl text-gray-400">
              <feat.icon size={18} />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm">{feat.label}</p>
              <p className="text-[10px] text-gray-400 font-bold">{feat.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
