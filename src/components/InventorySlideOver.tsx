import React, { useState, useEffect } from 'react';
import { 
  X,
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  Paperclip,
  FileText,
  Play,
  Video,
  PlusCircle,
  Star,
  Save,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  updateDoc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { InventoryItem } from '../types';
import { useToast } from '../providers/ToastProvider';

interface InventorySlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: InventoryItem | null;
  onSuccess?: () => void;
}

export const InventorySlideOver: React.FC<InventorySlideOverProps> = ({ 
  isOpen, 
  onClose, 
  editingItem,
  onSuccess 
}) => {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewStock, setPreviewStock] = useState<number>(0);
  const [previewMinStock, setPreviewMinStock] = useState<number>(5);

  useEffect(() => {
    if (editingItem) {
      setPreviewStock(editingItem.currentStock || 0);
      setPreviewMinStock(editingItem.minStock || 5);
    } else {
      setPreviewStock(0);
      setPreviewMinStock(5);
    }
  }, [editingItem, isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const getNum = (key: string) => {
      const val = formData.get(key);
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };
    
    const itemData: Partial<InventoryItem> = {
      sku: formData.get('sku') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      imageUrl: formData.get('imageUrl') as string,
      videoUrl: formData.get('videoUrl') as string,
      unit: formData.get('unit') as string || 'יח',
      currentStock: getNum('currentStock'),
      minStock: getNum('minStock'),
      price: getNum('price'),
      category: formData.get('category') as string,
      dryingTime: formData.get('dryingTime') as string,
      coverage: formData.get('coverage') as string,
      applicationMethod: formData.get('applicationMethod') as string,
      noaInsight: formData.get('noaInsight') as string,
      demandTrend: formData.get('demandTrend') as any || 'stable',
      relatedProducts: (formData.get('relatedProducts') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
      upsellItems: (formData.get('upsellItems') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
      updatedAt: serverTimestamp() as any,
    };

    try {
      const sku = formData.get('sku') as string;
      if (editingItem?.id) {
        await updateDoc(doc(db, 'inventory', editingItem.id), itemData);
        addToast('המוצר עודכן', `המוצר ${itemData.name} עודכן בהצלחה! ✅`, 'success');
      } else {
        // Use SKU as document ID for new products
        (itemData as any).createdAt = serverTimestamp();
        await setDoc(doc(db, 'inventory', sku), itemData);
        addToast('המוצר נוסף', `המוצר ${itemData.name} נוסף בהצלחה! ✅`, 'success');
      }
      onSuccess?.();
      onClose();
    } catch (error: any) {
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col"
            dir="rtl"
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {editingItem ? 'ניהול מוצר במאגר' : 'הוספת מוצר חדש'}
                </h3>
                <p className="text-slate-400 text-sm font-medium mt-1">SabanOS v3.5 Enterprise UI</p>
              </div>
              <button 
                onClick={onClose} 
                className="p-3 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              <form id="productForm" onSubmit={handleSubmit} className="space-y-10 pb-20">
                
                {/* Dynamic Image Preview Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-1">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">תצוגה מקדימה וקישור</label>
                    <div className="flex items-center gap-2">
                      {previewStock <= 0 ? (
                        <span className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-rose-100">
                          <AlertTriangle size={12} />
                          חסר במלאי
                        </span>
                      ) : previewStock <= previewMinStock ? (
                        <span className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-amber-100">
                          <AlertTriangle size={12} />
                          מלאי נמוך
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-emerald-100">
                          <CheckCircle2 size={12} />
                          במלאי
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="aspect-square w-full max-w-[280px] mx-auto bg-slate-100 rounded-[3rem] border-4 border-white shadow-2xl shadow-slate-200 overflow-hidden relative group/hero">
                    {editingItem?.imageUrl && editingItem.imageUrl.trim() !== "" ? (
                      <img 
                        id="heroImagePreview"
                        src={editingItem.imageUrl} 
                        alt="Product Preview" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/hero:scale-110"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const placeholder = document.getElementById('heroPlaceholder');
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      id="heroPlaceholder" 
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-300 ${editingItem?.imageUrl && editingItem.imageUrl.trim() !== "" ? 'hidden' : 'flex'}`}
                    >
                      <div className="p-6 bg-white rounded-3xl shadow-sm">
                        <ImageIcon size={48} strokeWidth={1.5} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">ממתין לתמונה</p>
                    </div>
                  </div>

                  <div className="relative group">
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                      <Paperclip size={20} />
                    </div>
                    <input 
                      name="imageUrl" 
                      type="url"
                      defaultValue={editingItem?.imageUrl}
                      placeholder="הדבק כאן קישור לתמונה (URL)..."
                      autoComplete="off"
                      onChange={(e) => {
                        const img = document.getElementById('heroImagePreview') as HTMLImageElement;
                        if (img) {
                          img.src = e.target.value;
                          img.style.display = e.target.value ? 'block' : 'none';
                        }
                      }}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] pr-12 pl-4 py-4 text-sm font-medium text-slate-600 focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300" 
                    />
                  </div>
                </div>

                {/* Core Fields Vertical Stack */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">שם מוצר רשמי</label>
                    <input 
                      name="name" 
                      required 
                      defaultValue={editingItem?.name}
                      placeholder="למשל: חול ים מסונן"
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">מק"ט מערכת</label>
                      <input 
                        name="sku" 
                        required 
                        disabled={!!editingItem}
                        defaultValue={editingItem?.sku}
                        placeholder="Unique ID"
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base font-mono font-black text-indigo-600 focus:bg-white focus:border-indigo-500 outline-none transition-all disabled:opacity-50" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">קטגוריה</label>
                      <input 
                        name="category" 
                        defaultValue={editingItem?.category}
                        placeholder="למשל: חומרי מחצבה"
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">תיאור מוצר (מידע נוסף)</label>
                    <textarea 
                      name="description" 
                      rows={3}
                      defaultValue={editingItem?.description}
                      placeholder="הכנס כאן פרטים נוספים על המוצר, מידות, סוג, או הנחיות מיוחדות..."
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-medium text-slate-600 focus:bg-white focus:border-indigo-500 outline-none transition-all resize-none" 
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">מחיר ₪</label>
                      <input 
                        name="price" 
                        type="number" 
                        step="0.01"
                        defaultValue={editingItem?.price}
                        className="w-full bg-transparent border-none p-0 text-lg font-black text-emerald-600 outline-none" 
                      />
                    </div>
                    <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">מלאי</label>
                      <input 
                        name="currentStock" 
                        type="number" 
                        required 
                        defaultValue={editingItem?.currentStock || 0}
                        onChange={(e) => setPreviewStock(Number(e.target.value))}
                        className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-800 outline-none" 
                      />
                    </div>
                    <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">יחידה</label>
                        <input 
                        name="unit" 
                        defaultValue={editingItem?.unit || 'יח'}
                        className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-800 outline-none" 
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">סף מינימום</label>
                    <input 
                      name="minStock" 
                      type="number" 
                      required 
                      defaultValue={editingItem?.minStock || 5}
                      onChange={(e) => setPreviewMinStock(Number(e.target.value))}
                      className="w-full bg-transparent border-none p-0 text-lg font-black text-rose-500 outline-none" 
                    />
                  </div>
                </div>

                {/* Technical Specifications Grid */}
                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <FileText size={16} />
                    </div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">מפרט טכני</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">זמן ייבוש</label>
                      <input 
                        name="dryingTime" 
                        defaultValue={editingItem?.dryingTime}
                        placeholder="למשל: 24 שעות"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">כושר כיסוי (מ"ר/יח')</label>
                      <input 
                        name="coverage" 
                        defaultValue={editingItem?.coverage}
                        placeholder='למשל: 15 מ"ר'
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">שיטת יישום</label>
                    <input 
                      name="applicationMethod" 
                      defaultValue={editingItem?.applicationMethod}
                      placeholder="למשל: מריחה במאלג' / התזה"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Multimedia - Video Link */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Play size={16} />
                    </div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">מדיה והדרכות</h4>
                  </div>
                  <div className="relative group">
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors">
                      <Video size={18} />
                    </div>
                    <input 
                      name="videoUrl" 
                      type="url"
                      defaultValue={editingItem?.videoUrl}
                      placeholder="קישור לסרטון הדרכה (YouTube/Direct)..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pr-12 pl-4 py-4 text-sm font-medium text-slate-600 focus:bg-white focus:border-rose-500 outline-none transition-all placeholder:text-slate-300" 
                    />
                  </div>
                </div>

                {/* Product Ecosystem */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <PlusCircle size={16} />
                    </div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">אקו-סיסטם ומוצרים משלימים</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">מוצרים קשורים (מופרדים בפסיק)</label>
                      <input 
                        name="relatedProducts" 
                        defaultValue={editingItem?.relatedProducts?.join(', ')}
                        placeholder='הזן מק"טים של מוצרים משלימים...'
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-slate-600 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">אפסייל / שדרוגים (מופרדים בפסיק)</label>
                      <input 
                        name="upsellItems" 
                        defaultValue={editingItem?.upsellItems?.join(', ')}
                        placeholder='הזן מק"טים של מוצרי פרימיום...'
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-slate-600 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* AI Intelligence Hub */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
                      <Star size={16} />
                    </div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">התובנות של נועה (AI)</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">מגמת ביקוש</label>
                      <select 
                        name="demandTrend"
                        defaultValue={editingItem?.demandTrend || 'stable'}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-sky-500 transition-all appearance-none shadow-sm"
                      >
                        <option value="rising">📈 ביקוש בעלייה</option>
                        <option value="stable">↔️ יציב</option>
                        <option value="falling">📉 ביקוש בירידה</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">תובנה אינטליגנטית (Noa's Insight)</label>
                      <textarea 
                        name="noaInsight" 
                        rows={3}
                        defaultValue={editingItem?.noaInsight}
                        placeholder="נועה מנתחת צריכה... (למשל: ביקוש גבוה בתקופת החורף עקב ריבוי עבודות גמר)"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-xs font-bold text-slate-600 focus:bg-white focus:border-sky-500 outline-none transition-all resize-none italic shadow-inner" 
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer Buttons */}
            <div className="p-8 border-t border-slate-100 bg-white flex gap-4">
              <button 
                type="submit" 
                form="productForm"
                disabled={isSubmitting}
                className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-sky-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Save size={24} />
                )}
                {isSubmitting ? 'שומר שינויים...' : editingItem ? 'עדכן מוצר' : 'שמור מוצר חדש'}
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                ביטול
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
