import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

interface ToastContextType {
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      
      <div className="fixed bottom-6 left-6 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: -100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-white rounded-2xl p-4 shadow-2xl border border-gray-100 flex gap-4 w-80 items-start relative overflow-hidden"
              dir="rtl"
            >
              <div className={`absolute top-0 right-0 bottom-0 w-1 ${
                toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
              }`} />
              
              <div className={`p-2 rounded-xl shrink-0 ${
                toast.type === 'success' ? 'bg-emerald-50' : toast.type === 'warning' ? 'bg-amber-50' : 'bg-sky-50'
              }`}>
                {toast.type === 'success' && <CheckCircle size={20} className="text-emerald-600" />}
                {toast.type === 'warning' && <AlertTriangle size={20} className="text-amber-600" />}
                {toast.type === 'info' && <Info size={20} className="text-sky-600" />}
              </div>

              <div className="flex-1">
                <p className="text-sm font-black text-gray-900">{toast.title}</p>
                <p className="text-xs text-gray-500 font-medium">{toast.message}</p>
              </div>

              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
