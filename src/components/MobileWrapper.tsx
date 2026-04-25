import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutList, 
  Trello, 
  CalendarDays, 
  MessageSquare, 
  User, 
  Settings,
  Plus,
  Home,
  Users
} from 'lucide-react';

interface MobileWrapperProps {
  children: React.ReactNode;
  viewMode: string;
  setViewMode: (v: any) => void;
  onAddClick: () => void;
  user: any;
}

export const MobileWrapper: React.FC<MobileWrapperProps> = ({ 
  children, 
  viewMode, 
  setViewMode, 
  onAddClick,
  user
}) => {
  const tabs = [
    { id: 'list', icon: LayoutList, label: 'הזמנות' },
    { id: 'kanban', icon: Trello, label: 'קנבן' },
    { id: 'chat_full', icon: MessageSquare, label: 'צ׳אט צוות', isCenter: true },
    { id: 'calendar', icon: CalendarDays, label: 'סידור' },
    { id: 'admin_users', icon: Users, label: 'VIP' },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50 overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-32">
        {children}
      </div>

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pointer-events-none z-[50]">
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="max-w-md mx-auto bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-between p-2 pointer-events-auto"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = viewMode === tab.id;
            
            if (tab.isCenter) {
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className="relative group px-1"
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${
                    isActive 
                      ? 'bg-sky-600 text-white scale-110 rotate-[360deg]' 
                      : 'bg-gray-900 text-white group-hover:bg-sky-600'
                  }`}>
                    <Icon size={24} strokeWidth={2.5} />
                  </div>
                  {isActive && (
                    <motion.div 
                       layoutId="active-dot"
                       className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-600 rounded-full"
                    />
                  )}
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-all duration-300 ${
                  isActive ? 'text-sky-600' : 'text-gray-400'
                }`}
              >
                <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? 'bg-sky-50' : 'bg-transparent'}`}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[9px] font-black mt-1 uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-0 scale-50'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </motion.div>
      </div>

      {/* Floating Add Button for Mobile (Bottom Right above nav) */}
      <div className="fixed bottom-32 left-6 z-[40]">
         <motion.button
           whileTap={{ scale: 0.9 }}
           onClick={onAddClick}
           className="w-14 h-14 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-600 transition-colors"
         >
           <Plus size={32} />
         </motion.button>
      </div>
    </div>
  );
};
