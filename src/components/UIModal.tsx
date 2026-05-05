import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface UIModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'confirm' | 'alert';
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const UIModal: React.FC<UIModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'alert',
  onConfirm,
  confirmText = 'אישור',
  cancelText = 'ביטול'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998]"
          />
          
          {/* Modal Content */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999]" dir="rtl" pointerEvents="none">
            <motion.div
              pointerEvents="auto"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl ${type === 'confirm' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>
                    {type === 'confirm' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
                  </div>
                  <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{message}</p>
                
                <div className="mt-8 flex gap-3">
                  {type === 'confirm' && (
                    <button
                      onClick={() => {
                        onConfirm?.();
                        onClose();
                      }}
                      className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-sky-600/25 active:scale-95"
                    >
                      {confirmText}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className={`flex-1 font-black py-4 rounded-2xl transition-all active:scale-95 ${
                      type === 'confirm' 
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                        : 'bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-600/25'
                    }`}
                  >
                    {type === 'confirm' ? cancelText : confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
