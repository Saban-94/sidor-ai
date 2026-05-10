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
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
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
      <div className="flex items-center justify-center h-screen w-screen bg-[#0b1426] text-white">
        <Loader2 className="animate-spin text-[#22c55e]" size={48} />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8 font-sans" dir="rtl">
      {/* Header Panel */}
      <header className="bg-[#1e293b]/40 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/5 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-8">
          <div className="bg-[#22c55e]/10 p-6 rounded-[2rem] border border-[#22c55e]/20 shadow-[0_0_40px_rgba(34,197,94,0.1)]">
            <Box size={42} className="text-[#22c55e]" />
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic text-white leading-none">
              SabanOS Order Engine 
              <span className="text-[11px] bg-white/5 px-4 py-1.5 rounded-full border border-white/10 font-mono tracking-widest text-[#22c55e] uppercase mr-4">PRO-MATCH v5.5</span>
            </h1>
            <p className="text-slate-400 mt-3 font-medium italic text-lg opacity-80">ניתוח לוגיסטי חכם • {items.length} פריטים במחסנית</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => setInputMode(!inputMode)}
            className="px-8 py-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-black flex items-center gap-3 text-white active:scale-95"
          >
            <Edit3 size={20} />
            {inputMode ? 'צפה במנוע הדינמי' : 'ערוך רשימת פקודות'}
          </button>
          
          <div className="bg-black/30 p-2 rounded-[2rem] border border-white/5 flex items-center gap-3">
            <StatCard label="סה״כ" value={items.length} color="white" />
            <div className="w-px h-10 bg-white/10" />
            <StatCard label="מאומת" value={items.filter(i => i.isVerified).length} color="#22c55e" />
            <div className="w-px h-10 bg-white/10" />
            <StatCard label="חסר" value={items.filter(i => i.matchType === 'none').length} color="#ef4444" />
          </div>
        </div>
      </header>

      {/* Main Analysis Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {inputMode ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 bg-[#1e293b]/60 backdrop-blur-2xl rounded-[3.5rem] border border-white/5 p-12 flex flex-col gap-8 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-white flex items-center gap-4 italic underline decoration-[#22c55e] decoration-4 underline-offset-8">
                COMMAND INPUT BUFFER
              </h2>
            </div>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="הזן פריטים (למשל: דבק חוץ - 20)..."
              className="flex-1 bg-black/40 rounded-[2.5rem] p-10 text-3xl font-black text-[#22c55e] focus:outline-none border border-white/5 resize-none custom-scrollbar placeholder:text-slate-800 tracking-tight"
            />
            <button 
              onClick={() => setInputMode(false)}
              className="w-full bg-[#22c55e] text-[#0b1426] py-8 rounded-[2.5rem] font-black text-3xl hover:scale-[1.01] active:scale-95 transition-all shadow-[0_20px_60px_rgba(34,197,94,0.3)]"
            >
              RUN ANALYZER • הפעל ניתוח
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-[24px] pb-32">
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
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-8 bg-[#0b1426]/90 backdrop-blur-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-5xl bg-[#1e293b] rounded-[4rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[80vh]"
            >
              <div className="p-10 border-b border-white/5 flex items-center justify-between bg-black/20">
                <div>
                  <h2 className="text-4xl font-black text-white italic tracking-tighter">SEARCH & SWAP</h2>
                  <p className="text-slate-500 font-bold uppercase mt-1">איתור והחלפת מוצר במלאי הרשמי</p>
                </div>
                <button 
                  onClick={() => setActiveSwapItem(null)}
                  className="p-4 bg-white/5 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all border border-white/5"
                >
                  <XCircle size={32} />
                </button>
              </div>

              <div className="p-10 flex-1 overflow-hidden flex flex-col gap-8">
                <div className="relative">
                  <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="חפש מוצר במלאי לפי שם או מק״ט..."
                    className="w-full bg-black/40 border border-white/10 rounded-[2rem] py-6 px-16 text-2xl font-bold text-[#22c55e] focus:outline-none focus:border-[#22c55e]/50 transition-all shadow-inner"
                    autoFocus
                  />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredInventory.map((invItem) => (
                    <button
                      key={invItem.id}
                      onClick={() => handleSwap(invItem)}
                      className="flex items-center gap-6 p-6 bg-white/5 hover:bg-sky-500/10 rounded-[2rem] border border-white/5 hover:border-sky-500/30 transition-all text-right group"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center shrink-0">
                        <PackageCheck size={28} className="text-sky-500 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{invItem.sku || 'NO SKU'}</span>
                        <h4 className="text-xl font-black text-white leading-tight group-hover:text-sky-400 transition-colors">{invItem.name}</h4>
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
      <footer className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[400] w-full max-w-7xl px-8 pointer-events-none">
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white/10 backdrop-blur-3xl p-6 rounded-[3rem] border border-white/20 shadow-[0_30px_100px_rgba(0,0,0,0.5)] flex items-center justify-between pointer-events-auto"
        >
          <div className="flex items-center gap-10 mr-4">
             <div className="flex flex-col">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em]">System Health</span>
              <span className="text-sm font-black text-[#22c55e] flex items-center gap-2 italic">
                GAS PIPELINE: STABLE ✅
              </span>
             </div>
             <div className="w-px h-10 bg-white/10" />
             <div className="flex items-center gap-4">
                <span className="text-xs font-black text-white opacity-60">Verified Units: {items.filter(i => i.isVerified).length} / {items.length}</span>
             </div>
          </div>

          <button 
            disabled={items.length === 0}
            className="bg-[#22c55e] text-[#0b1426] px-16 py-6 rounded-[2rem] font-black text-2xl flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-[#22c55e]/30 disabled:opacity-50 disabled:grayscale"
          >
            <Save size={28} />
            CONFIRM & REDEPLOY • אפור ושלח
          </button>
        </motion.div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; border: 2px solid rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSwap();
        }
      }}
      className={`bg-[#1e293b]/40 backdrop-blur-xl rounded-[3.5rem] border border-white/5 overflow-hidden group hover:border-white/20 transition-all cursor-pointer shadow-2xl relative flex flex-col hover:scale-[1.01] active:scale-[0.99] ${item.isVerified ? 'border-[#22c55e]/20' : ''}`}
      onClick={onSwap}
    >
      <div className="p-8 pb-4 flex-1">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-500">
                {item.sku || 'SKU UNKNOWN'}
              </span>
              {item.confidence && item.confidence > 0 && item.confidence < 100 && (
                <span className="text-[10px] font-black text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-md border border-[#f59e0b]/20">
                  {item.confidence}% Match
                </span>
              )}
            </div>
            <h3 className="text-3xl font-black text-white leading-tight mb-1">{item.name}</h3>
            {item.matchType !== 'full' && (
              <p className="text-xs font-bold text-slate-500 italic">Original: {item.originalName}</p>
            )}
          </div>
          
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
            {item.matchType === 'full' ? <PackageCheck size={32} className="text-[#22c55e]" /> :
             item.matchType === 'partial' ? <AlertTriangle size={32} className="text-[#f59e0b]" /> :
             <PackageX size={32} className="text-[#ef4444]" />}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: item.color }} />
          <span className="text-[11px] font-black tracking-widest uppercase italic" style={{ color: item.color }}>
            {item.status}
          </span>
        </div>
      </div>

      <div className="p-8 pt-0 mt-auto">
        <div className="bg-black/40 p-6 rounded-[2.5rem] border border-white/10 flex items-center justify-between group-hover:border-[#22c55e]/30 transition-all">
          <button 
            type="button"
            onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation(); 
                onUpdateQty(item.id, -1); 
            }}
            className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white text-2xl font-black transition-all z-10"
          >
            -
          </button>
          
          <div className="flex flex-col items-center select-none">
            <span className="text-[9px] font-black text-slate-600 uppercase mb-1">Quantity</span>
            <span className="text-4xl font-black text-[#22c55e]">{item.quantity}</span>
          </div>

          <button 
            type="button"
            onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation(); 
                onUpdateQty(item.id, 1); 
            }}
            className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white text-2xl font-black transition-all z-10"
          >
            +
          </button>
        </div>
        
        {item.matchType !== 'full' && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full"
          >
            <button 
              onClick={(e) => { e.stopPropagation(); onSwap(); }}
              className="w-full mt-4 py-3 bg-white/5 hover:bg-[#22c55e]/20 border border-white/10 hover:border-[#22c55e]/40 rounded-2xl text-[10px] font-black text-white transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Search size={14} />
              MANUAL SWAP / REPLACE
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const StatCard = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="px-6 py-3 flex flex-col items-center min-w-[100px]">
    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</span>
    <span className="text-3xl font-black leading-none" style={{ color }}>{value}</span>
  </div>
);
