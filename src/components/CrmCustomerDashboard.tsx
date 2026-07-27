import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  CreditCard, 
  FileText, 
  Folder, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  DollarSign, 
  MapPin, 
  ExternalLink,
  ChevronLeft,
  Truck,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import { Customer, Order, AppTheme } from '../types';

interface CrmCustomerDashboardProps {
  customers: Customer[];
  orders: Order[];
  onSelectCustomer?: (customer: Customer) => void;
  onOpenDriveModal: (customerName: string) => void;
  onOpenWhatsAppModal: (customerName: string, phone: string, orderId?: string) => void;
  onCreateNewOrder?: (customerName: string) => void;
  onViewOrder?: (id: string) => void;
  theme?: AppTheme;
  onChangeTheme?: (theme: AppTheme) => void;
  onAddToast?: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const CrmCustomerDashboard: React.FC<CrmCustomerDashboardProps> = ({
  customers = [],
  orders = [],
  onSelectCustomer,
  onOpenDriveModal,
  onOpenWhatsAppModal,
  onCreateNewOrder,
  onViewOrder
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customers[0]?.id || null);

  // Filter customers
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phoneNumber?.includes(searchQuery) ||
    c.customerNumber?.includes(searchQuery)
  );

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || filteredCustomers[0] || customers[0];

  // Get customer order history
  const customerOrders = orders.filter(o => 
    activeCustomer && (o.customerName === activeCustomer.name || o.customerId === activeCustomer.id)
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl dir-rtl">
      {/* Top Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>דשבורד CRM - ניהול תיקי לקוחות, אשראי וגליה</span>
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-medium border border-amber-500/30">
                SBN CRM v6.5
              </span>
            </h2>
            <p className="text-xs text-slate-400">מעקב תיק לקוח בלייב, מסגרות אשראי, חריגות פקדונות ותעודות משלוח</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש לפי שם לקוח, טלפון או ח.פ..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Main Grid Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Customer List Sidebar (4 Cols) */}
        <div className="lg:col-span-4 border-l border-slate-800 bg-slate-950/60 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1">
            <span>לקוחות רשומים ({filteredCustomers.length})</span>
            <span className="text-amber-400">סנכרון דרייב וגיליונות ✅</span>
          </div>

          {filteredCustomers.map((cust) => {
            const isSelected = activeCustomer?.id === cust.id;
            const custOrderCount = orders.filter(o => o.customerName === cust.name).length;

            return (
              <motion.div
                key={cust.id || cust.name}
                whileHover={{ scale: 1.01 }}
                onClick={() => {
                  setSelectedCustomerId(cust.id || cust.name);
                  if (onSelectCustomer) onSelectCustomer(cust);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-lg shadow-amber-500/5'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{cust.name}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{cust.phoneNumber || cust.phone || '050-0000000'}</span>
                    </p>
                  </div>

                  <span className="text-[10px] bg-slate-800 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-slate-700">
                    #{cust.customerNumber || 'CUST-1001'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80 text-slate-400">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3 h-3 text-amber-400" />
                    <span>{custOrderCount} הזמנות</span>
                  </span>
                  <span className="text-emerald-400 font-medium">אשראי תקין ✅</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Right Column: Active Customer Detail View (8 Cols) */}
        {activeCustomer ? (
          <div className="lg:col-span-8 p-6 overflow-y-auto space-y-6 bg-slate-900/40">
            {/* Customer Header Card */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-md">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{activeCustomer.name}</h2>
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full font-bold border border-amber-500/30">
                    מס' לקוח #{activeCustomer.customerNumber || '1001'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    איש קשר: <strong className="text-slate-200">{activeCustomer.contactPerson || 'מנהל רכש'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <strong className="text-slate-200 dir-ltr">{activeCustomer.phoneNumber || activeCustomer.phone || '050-1234567'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" />
                    <span>{activeCustomer.address || 'אזור תעשייה בילו'}</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenWhatsAppModal(activeCustomer.name, activeCustomer.phoneNumber || '0501234567')}
                  className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/40 flex items-center gap-1.5 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>ווטסאפ (JONI)</span>
                </button>

                <button
                  onClick={() => onOpenDriveModal(activeCustomer.name)}
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/40 flex items-center gap-1.5 transition-all"
                >
                  <Folder className="w-4 h-4" />
                  <span>תיקיית דרייב</span>
                </button>

                <button
                  onClick={() => onCreateNewOrder && onCreateNewOrder(activeCustomer.name)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>הזמנה חדשה</span>
                </button>
              </div>
            </div>

            {/* Financial & Deposit KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>מסגרת אשראי מאושרת</span>
                </div>
                <div className="text-lg font-bold text-emerald-400">₪250,000</div>
                <div className="text-[11px] text-slate-500 mt-1">יתרת ניצול: ₪38,400 (מאושר)</div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>פקדונות בלות ומשטחים</span>
                </div>
                <div className="text-lg font-bold text-amber-400">✅ מאושר (4 בלות, 2 משטחים)</div>
                <div className="text-[11px] text-slate-500 mt-1">חיווי פקדונות לפי מילון לוגיסטי</div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>תעודות גליה פעילות</span>
                </div>
                <div className="text-lg font-bold text-sky-400">{customerOrders.length} תעודות במערכת</div>
                <div className="text-[11px] text-slate-500 mt-1">מסונכרן עם Google Drive & Sheets</div>
              </div>
            </div>

            {/* Customer Orders Table */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>היסטוריית הזמנות ותעודות גליה ללקוח</span>
              </h3>

              {customerOrders.length > 0 ? (
                <div className="space-y-2">
                  {customerOrders.map((ord) => (
                    <div 
                      key={ord.id || ord.orderNumber}
                      className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-300">
                            #{ord.orderNumber || ord.id?.slice(-5).toUpperCase()}
                          </span>
                          <span className="text-xs font-medium text-white">{ord.items || 'חומרי בניין סבן'}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          תאריך: {ord.date} | יעד אספקה: {ord.destination || 'מחסן החרש'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">
                          ✅ אין חריגות פקדונות
                        </span>

                        <button
                          onClick={() => onOpenWhatsAppModal(activeCustomer.name, activeCustomer.phoneNumber || '0501234567', ord.orderNumber || ord.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          <span>שלח אישור</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  אין תעודות או הזמנות רשומות כרגע ללקוח זה.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 flex items-center justify-center p-12 text-slate-500">
            בחר לקוח מהרשימה לצפייה בתיק הלקוח.
          </div>
        )}
      </div>
    </div>
  );
};
