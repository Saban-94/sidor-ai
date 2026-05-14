import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Box, 
  Search, 
  Edit3, 
  Save, 
  Loader2,
  PackageCheck,
  PackageX,
  PackageOpen,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InventoryItem } from '../types';

interface SabanOrderEngineProps {
  rawItems?: string;
  onProcessed?: (items: ProcessedItem[]) => void;
}

interface ProcessedItem {
  id: string;
  name: string;
  originalName: string;
  quantity: number;
  sku: string | null;
  matchType: 'full' | 'partial' | 'none';
  status: string;
  color: string;
  confidence?: number;
  isVerified: boolean;
}

export const SabanOrderEngine: React.FC<SabanOrderEngineProps> = ({ 
  rawItems = "",
  onProcessed 
}) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [items, setItems] = useState<ProcessedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMode, setInputMode] = useState(!rawItems);
  const [manualText, setManualText] = useState(rawItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSwapItem, setActiveSwapItem] = useState<string | null>(null);

  // Sync manual text if prop changes
  useEffect(() => {
    if (rawItems) {
      setManualText(rawItems);
      setInputMode(false);
    }
  }, [rawItems]);

  // Fetch Inventory for Matching
  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[];
      setInventory(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Advanced Matching Algorithm
  const calculateConfidence = (str1: string, str2: string) => {
    const s1 = (str1 || "").toLowerCase();
    const s2 = (str2 || "").toLowerCase();
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 100;
    if (s1.includes(s2) || s2.includes(s1)) {
      const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
      return Math.round(ratio * 90);
    }
    return 0;
  };

  useEffect(() => {
    if (loading || !manualText) {
      setItems([]);
      return;
    }

    const lines = manualText.split('\n').filter(l => l.trim() !== "");
    const processed: ProcessedItem[] = lines.map((line, idx) => {
      const parts = line.split(/[-,x*]/);
      const rawName = (parts[0] || "").trim() || "מוצר ללא שם";
      const rawQty = (parts[1] || "").trim() || "1";
      const quantity = parseInt(rawQty) || 1;

      // 1. EXACT MATCH
      const exactMatch = inventory.find(i => 
        i.name.toLowerCase() === rawName.toLowerCase() || 
        (i.sku && i.sku.toLowerCase() === rawName.toLowerCase())
      );

      if (exactMatch) {
        return {
          id: `item-${idx}`,
          name: exactMatch.name,
          originalName: rawName,
          quantity,
          sku: exactMatch.sku,
          matchType: 'full',
          status: 'EXACT MATCH',
          color: '#22c55e',
          confidence: 100,
          isVerified: true
        };
      }

      // 2. FUZZY MATCH
      let bestMatch: InventoryItem | null = null;
      let maxConfidence = 0;

      inventory.forEach(invItem => {
        const conf = calculateConfidence(rawName, invItem.name);
        if (invItem.sku) {
          const skuConf = calculateConfidence(rawName, invItem.sku);
          if (skuConf > conf) {
            if (skuConf > maxConfidence) {
              maxConfidence = skuConf;
              bestMatch = invItem;
            }
          } else if (conf > maxConfidence) {
            maxConfidence = conf;
            bestMatch = invItem;
          }
        } else if (conf > maxConfidence) {
          maxConfidence = conf;
          bestMatch = invItem;
        }
      });

      if (bestMatch && maxConfidence > 30) {
        return {
          id: `item-${idx}`,
          name: rawName,
          originalName: rawName,
          quantity,
          sku: (bestMatch as InventoryItem).sku,
          matchType: 'partial',
          status: 'SUGGESTED MATCH',
          color: '#f59e0b',
          confidence: maxConfidence,
          isVerified: false
        };
      }

      // 3. NO MATCH
      return {
        id: `item-${idx}`,
        name: rawName,
        originalName: rawName,
        quantity,
        sku: null,
        matchType: 'none',
        status: 'SPECIAL ORDER / NO MATCH',
        color: '#ef4444',
        confidence: 0,
        isVerified: false
      };
    });

    setItems(processed);
    onProcessed?.(processed);
  }, [manualText, inventory, loading]);

  const updateQuantity = (id: string, delta: number) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    ));
  };

  const handleSwap = (invItem: InventoryItem) => {
    if (!activeSwapItem) return;
    setItems(prev => prev.map(item => 
      item.id === activeSwapItem ? {
        ...item,
        name: invItem.name,
        sku: invItem.sku,
        matchType: 'full',
        status: 'MANUALLY VERIFIED',
        color: '#22c55e',
        confidence: 100,
        isVerified: true
      } : item
    ));
    setActiveSwapItem(null);
    setSearchQuery("");
  };

  const filteredInventory = useMemo(() => {
    if (!searchQuery) return inventory.slice(0, 50);
    return inventory.filter(i => 
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (i.sku && i.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 50);
  }, [inventory, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-slate-900" size={48} />
          <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">SabanOS Booting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-6 font-sans bg-[#F8FAFC]" dir="rtl">
      {/* Header Panel - Management Consulting Style */}
      <header className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center gap-6">
          <div className="bg-[#22c55e]/5 p-4 rounded-2xl border border-[#22c55e]/10">
            <Box size={32} className="text-[#22c55e]" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase text-slate-900 leading-none">
              SabanOS Order Engine 
              <span className="text-[9px] bg-slate-100 px-3 py-1 rounded-full border border-slate-200 font-mono tracking-widest text-slate-500 uppercase mr-3">v6.0 Enterprise</span>
            </h1>
            <p className="text-slate-500 mt-2 font-medium text-sm">ניתוח לוגיסטי ובקרת מלאי מתקדמת • ממשק ניהול מרכזי</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setInputMode(!inputMode)}
            className="px-6 py-3 rounded-xl bg-white border border-[#E2E8F0] hover:bg-slate-50 transition-all text-xs font-bold flex items-center gap-2 text-slate-700 active:scale-95"
          >
            <Edit3 size={16} />
            {inputMode ? 'צפה בלוח הבקרה' : 'עריכת פקודות'}
          </button>
          
          <div className="bg-slate-50 p-1.5 rounded-2xl border border-[#E2E8F0] flex items-center gap-1">
            <StatCard label="סה״כ" value={items.length} color="#0f172a" />
            <div className="w-px h-8 bg-slate-200 mx-1" />
            <StatCard label="מאומת" value={items.filter(i => i.isVerified).length} color="#16a34a" />
            <div className="w-px h-8 bg-slate-200 mx-1" />
            <StatCard label="חסר" value={items.filter(i => i.matchType === 'none').length} color="#dc2626" />
          </div>
        </div>
      </header>

      {/* Main Analysis Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {inputMode ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 bg-white rounded-3xl border border-[#E2E8F0] p-8 flex flex-col gap-6 shadow-sm"
          >
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="הזן פריטים (למשל: דבק חוץ - 20)..."
              className="flex-1 bg-slate-50 rounded-2xl p-8 text-xl font-bold text-slate-800 focus:outline-none border border-[#E2E8F0] resize-none custom-scrollbar placeholder:text-slate-400 tracking-tight"
            />
            <button 
              onClick={() => setInputMode(false)}
              className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xl hover:bg-slate-800 active:scale-95 transition-all shadow-lg"
            >
              הפעל ניתוח מערכת • EXECUTE ANALYZER
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 pb-32">
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => (
                <OrderItemCard 
                  key={item.id} 
                  item={item} 
                  index={index} 
                  onUpdateQty={updateQuantity} 
                  onSwap={() => setActiveSwapItem(item.id)} 
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* SWAP MODAL */}
      <AnimatePresence>
        {activeSwapItem && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-white rounded-[2.5rem] border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col h-[70vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">החלפת מוצר במלאי</h2>
                  <p className="text-slate-500 font-bold text-xs uppercase mt-1">חיפוש והצלבה מול דאטה-בייס המחסן</p>
                </div>
                <button 
                  onClick={() => setActiveSwapItem(null)}
                  className="p-3 bg-white rounded-full hover:bg-slate-100 text-slate-400 transition-all border border-slate-200"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8 flex-1 overflow-hidden flex flex-col gap-6">
                <div className="relative">
                  <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="חפש לפי שם או מק״ט..."
                    className="w-full bg-slate-50 border border-[#E2E8F0] rounded-xl py-4 px-14 text-lg font-bold text-slate-900 focus:outline-none focus:border-slate-400 transition-all shadow-inner"
                    autoFocus
                  />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 gap-3">
                  {filteredInventory.map((invItem) => (
                    <button
                      key={invItem.id}
                      onClick={() => handleSwap(invItem)}
                      className="flex items-center gap-5 p-5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all text-right group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <PackageCheck size={24} className="text-slate-400 group-hover:text-[#22c55e] transition-colors" />
                      </div>
                      <div className="flex-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{invItem.sku || 'NO SKU'}</span>
                        <h4 className="text-lg font-bold text-slate-800 leading-tight block mt-1">{invItem.name}</h4>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Actions */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[400] w-full max-w-5xl px-8 pointer-events-none">
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white p-5 rounded-3xl border border-[#E2E8F0] shadow-xl flex items-center justify-between pointer-events-auto"
        >
          <div className="flex items-center gap-8 mr-4">
             <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline Status</span>
              <span className="text-xs font-black text-[#16a34a] flex items-center gap-2 italic">
                SYSTEM OPERATIONAL ✅
              </span>
             </div>
             <div className="w-px h-6 bg-slate-100" />
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-600">Verified: {items.filter(i => i.isVerified).length} / {items.length}</span>
             </div>
          </div>

          <button 
            disabled={items.length === 0}
            className="bg-slate-900 text-white px-10 py-4 rounded-xl font-black text-lg flex items-center gap-3 hover:bg-slate-800 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:grayscale"
          >
            <Save size={20} />
            אישור ושידור למערכת
          </button>
        </motion.div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

// SMART ITEM CARD COMPONENT
const OrderItemCard: React.FC<{
  item: ProcessedItem;
  index: number;
  onUpdateQty: (id: string, delta: number) => void;
  onSwap: () => void;
}> = ({ item, index, onUpdateQty, onSwap }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      tabIndex={0}
      className={`bg-white rounded-[2rem] border border-[#E2E8F0] overflow-hidden group hover:border-slate-400 transition-all cursor-pointer shadow-sm relative flex flex-col hover:-translate-y-1 active:scale-[0.98] ${item.isVerified ? 'border-[#22c55e]/30 bg-[#22c55e]/[0.02]' : ''}`}
      onClick={onSwap}
    >
      <div className="p-6 pb-4 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold uppercase bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md text-slate-400">
                {item.sku || 'SKU UNKNOWN'}
              </span>
              {item.confidence && item.confidence > 0 && item.confidence < 100 && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                  {item.confidence}% Match
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-slate-900 leading-tight mb-0.5">{item.name}</h3>
            {item.matchType !== 'full' && (
              <p className="text-[10px] font-bold text-slate-400 italic">Input: {item.originalName}</p>
            )}
          </div>
          
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-white transition-colors">
            {item.matchType === 'full' ? <PackageCheck size={20} className="text-[#22c55e]" /> :
             item.matchType === 'partial' ? <AlertTriangle size={20} className="text-amber-500" /> :
             <PackageX size={20} className="text-red-500" />}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-[9px] font-black tracking-widest uppercase italic" style={{ color: item.color }}>
            {item.status}
          </span>
        </div>
      </div>

      <div className="p-6 pt-0 mt-auto">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between group-hover:border-slate-200 transition-all">
          <button 
            type="button"
            onClick={(e) => { 
                e.stopPropagation(); 
                onUpdateQty(item.id, -1); 
            }}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 text-xl font-bold transition-all"
          >
            -
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">QTY</span>
            <span className="text-2xl font-black text-slate-900">{item.quantity}</span>
          </div>

          <button 
            type="button"
            onClick={(e) => { 
                e.stopPropagation(); 
                onUpdateQty(item.id, 1); 
            }}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 text-xl font-bold transition-all"
          >
            +
          </button>
        </div>
        
        {item.matchType !== 'full' && (
          <button 
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
            className="w-full mt-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[9px] font-black text-slate-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Search size={12} />
            ידני / החלף מוצר
          </button>
        )}
      </div>
    </motion.div>
  );
};

const StatCard = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="px-5 py-2.5 flex flex-col items-center min-w-[80px]">
    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</span>
    <span className="text-xl font-black leading-none" style={{ color }}>{value}</span>
  </div>
);
