import React, { useState } from 'react';
import { 
  Folder, 
  FileText, 
  ChevronRight, 
  Upload, 
  Search, 
  X, 
  ExternalLink, 
  CheckCircle2, 
  File, 
  Plus, 
  User, 
  Download,
  Eye,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, DriveSimItem } from '../types';

interface DriveSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers?: Customer[];
  selectedCustomerName?: string;
  customerName?: string;
  onLinkDocumentToOrder?: (file: DriveSimItem, customerName: string) => void;
}

export const DriveSimulationModal: React.FC<DriveSimulationModalProps> = ({
  isOpen,
  onClose,
  customers = [],
  selectedCustomerName,
  customerName,
  onLinkDocumentToOrder
}) => {
  const activeCustomerName = selectedCustomerName || customerName;
  const [currentFolderPath, setCurrentFolderPath] = useState<string[]>(['ח.סבן דרייב ראשי']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<DriveSimItem | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');

  if (!isOpen) return null;

  // Build simulated drive hierarchy based on customers
  const defaultCustomerFolders: DriveSimItem[] = customers.map(cust => {
    const custName = cust.name || 'לקוח מזדמן';
    return {
      id: `folder-cust-${cust.id || custName}`,
      name: `תיק_לקוח_${custName}`,
      type: 'folder',
      customerName: custName,
      updatedAt: new Date().toLocaleDateString('he-IL'),
      children: [
        {
          id: `f-orders-${custName}`,
          name: 'הזמנות',
          type: 'folder',
          category: 'orders',
          customerName: custName,
          updatedAt: new Date().toLocaleDateString('he-IL'),
          children: [
            {
              id: `doc-ord-6214480-${custName}`,
              name: `הזמנה_6214480_${custName}.pdf`,
              type: 'file',
              category: 'orders',
              mimeType: 'application/pdf',
              size: '340 KB',
              customerName: custName,
              orderNumber: '6214480',
              updatedAt: new Date().toLocaleDateString('he-IL'),
              url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            }
          ]
        },
        {
          id: `f-deliv-${custName}`,
          name: 'תעודות_משלוח_וגליה',
          type: 'folder',
          category: 'delivery_notes',
          customerName: custName,
          updatedAt: new Date().toLocaleDateString('he-IL'),
          children: [
            {
              id: `doc-galia-901-${custName}`,
              name: `תעודת_גליה_9012_${custName}.pdf`,
              type: 'file',
              category: 'delivery_notes',
              mimeType: 'application/pdf',
              size: '410 KB',
              customerName: custName,
              orderNumber: '6214480',
              updatedAt: new Date().toLocaleDateString('he-IL')
            }
          ]
        },
        {
          id: `f-inv-${custName}`,
          name: 'חשבוניות',
          type: 'folder',
          category: 'invoices',
          customerName: custName,
          updatedAt: new Date().toLocaleDateString('he-IL'),
          children: []
        },
        {
          id: `f-cred-${custName}`,
          name: 'אישורי_אשראי',
          type: 'folder',
          category: 'credit_approvals',
          customerName: custName,
          updatedAt: new Date().toLocaleDateString('he-IL'),
          children: [
            {
              id: `doc-credit-approval-${custName}`,
              name: `אישור_אשראי_סבן_${custName}.pdf`,
              type: 'file',
              category: 'credit_approvals',
              mimeType: 'application/pdf',
              size: '180 KB',
              customerName: custName,
              updatedAt: new Date().toLocaleDateString('he-IL')
            }
          ]
        }
      ]
    };
  });

  // Folder navigation logic
  const getItemsAtCurrentPath = (): DriveSimItem[] => {
    if (currentFolderPath.length === 1) {
      // Root level: Return Customer Folders
      let items = defaultCustomerFolders;
      if (activeCustomerName) {
        items = items.filter(i => i.customerName?.includes(activeCustomerName) || i.name.includes(activeCustomerName));
      }
      if (searchQuery.trim()) {
        items = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      return items;
    }

    // Deep level
    const targetCustomerFolderName = currentFolderPath[1];
    const customerFolder = defaultCustomerFolders.find(f => f.name === targetCustomerFolderName);
    if (!customerFolder || !customerFolder.children) return [];

    if (currentFolderPath.length === 2) {
      // Return Sub-folders (Orders, Delivery Notes, Invoices, Credit)
      return customerFolder.children;
    }

    if (currentFolderPath.length === 3) {
      // Return Files inside sub-folder
      const subFolderName = currentFolderPath[2];
      const subFolder = customerFolder.children.find(f => f.name === subFolderName);
      let files = subFolder?.children || [];
      if (searchQuery.trim()) {
        files = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      return files;
    }

    return [];
  };

  const handleOpenFolder = (item: DriveSimItem) => {
    if (item.type === 'folder') {
      setCurrentFolderPath([...currentFolderPath, item.name]);
    } else {
      setSelectedFile(item);
    }
  };

  const handleNavigatePath = (index: number) => {
    setCurrentFolderPath(currentFolderPath.slice(0, index + 1));
  };

  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadSuccessMsg(`הקובץ "${file.name}" הועלה וסונכרן בהצלחה לדרייב SBN!`);
    setTimeout(() => setUploadSuccessMsg(''), 4000);
  };

  const activeItems = getItemsAtCurrentPath();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 dir-rtl">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-100"
      >
        {/* Header Bar */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>סימולציית Google Drive - SBN Logistics</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-medium border border-amber-500/30">
                  Drive API Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">ניווט במבנה תיקיות דרייב דינמי, סריקת תעודות גליה ושיוך לתיק לקוח</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Path Breadcrumbs & Search Bar */}
        <div className="bg-slate-900/90 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300 overflow-x-auto">
            {currentFolderPath.map((folderName, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-500 rotate-180" />}
                <button
                  onClick={() => handleNavigatePath(idx)}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    idx === currentFolderPath.length - 1
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {folderName}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Search Input & Upload Action */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש קובץ או תיקייה..."
                className="bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 w-48 sm:w-64"
              />
            </div>

            <label className="cursor-pointer px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all">
              <Upload className="w-4 h-4" />
              <span>העלה קובץ לדרייב</span>
              <input type="file" onChange={handleSimulatedUpload} className="hidden" accept=".pdf,.doc,.docx,.png,.jpg" />
            </label>
          </div>
        </div>

        {/* Alert Notification */}
        {uploadSuccessMsg && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-6 py-2 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{uploadSuccessMsg}</span>
          </div>
        )}

        {/* Folder Content Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {activeItems.map((item) => {
            const isFolder = item.type === 'folder';

            return (
              <motion.div
                key={item.id}
                whileHover={{ y: -2 }}
                onClick={() => handleOpenFolder(item)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isFolder
                    ? 'bg-slate-950/70 border-slate-800 hover:border-amber-500/50 hover:bg-slate-950'
                    : 'bg-slate-800/60 border-slate-700 hover:border-sky-500/50 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`p-2.5 rounded-xl border ${
                    isFolder 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                      : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                  }`}>
                    {isFolder ? <Folder className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>

                  {!isFolder && item.category && (
                    <span className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                      {item.category === 'orders' ? 'הזמנה' : item.category === 'delivery_notes' ? 'תעודת גליה' : 'מסמך'}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white truncate" title={item.name}>
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>{item.updatedAt}</span>
                    <span>{item.size || (isFolder ? `${item.children?.length || 0} פריטים` : 'PDF')}</span>
                  </p>
                </div>

                {!isFolder && onLinkDocumentToOrder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLinkDocumentToOrder(item, item.customerName || 'לקוח מזדמן');
                    }}
                    className="w-full mt-1 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-bold rounded-lg border border-sky-500/40 flex items-center justify-center gap-1 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>שייך להזמנת לקוח</span>
                  </button>
                )}
              </motion.div>
            );
          })}

          {activeItems.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
              <Folder className="w-12 h-12 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">התיקייה ריקה כעת</p>
              <p className="text-xs text-slate-500 mt-1">תוכל להעלות מסמכים ותעודות גליה חדשות באמצעות הכפתור למעלה</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <User className="w-4 h-4 text-amber-400" />
            <span>
              {selectedCustomerName ? `תיק ממוקד: ${selectedCustomerName}` : 'סנכרון מלא לדרייב SBN'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
          >
            סגור תצוגת דרייב
          </button>
        </div>
      </motion.div>
    </div>
  );
};
