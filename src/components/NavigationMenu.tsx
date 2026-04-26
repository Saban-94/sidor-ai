import React from 'react';
import { 
  MessageSquare, 
  LayoutList, 
  Trello, 
  CalendarDays, 
  FileSpreadsheet, 
  FileText, 
  Table, 
  Users, 
  Settings, 
  LogOut, 
  X,
  Truck,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { Avatar } from './Avatar';
import { User } from 'firebase/auth';

interface NavigationMenuProps {
  user: User;
  viewMode: string;
  setViewMode: (mode: string) => void;
  onLogout: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  user,
  viewMode,
  setViewMode,
  onLogout,
  onClose,
  isMobile = false
}) => {
  const menuItems = [
    { id: 'chat_full', label: "צא'ט חכם (SabanOS)", icon: MessageSquare, accent: 'text-emerald-500' },
    { id: 'list', label: 'לוח הזמנות', icon: LayoutList },
    { id: 'kanban', label: 'לוח קנבן', icon: Trello },
    { id: 'calendar', label: 'סידור שבועי', icon: CalendarDays },
    { id: 'import', label: 'יבוא אקסל', icon: FileSpreadsheet },
    { id: 'reports', label: 'דוחות בוקר', icon: FileText },
    { id: 'table', label: 'ניהול מלאי', icon: Table },
    { id: 'admin_users', label: 'ניהול משתמשים', icon: Users },
  ];

  const content = (
    <div className={`h-full flex flex-col bg-[#0a0a0a] text-slate-300 border-l border-slate-800/50 relative overflow-hidden ${!isMobile ? 'w-72' : 'w-full'}`} dir="rtl">
      {/* Glassmorphic Background Accent */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-800/50 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Truck size={20} className="text-black" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight leading-none italic">SabanOS</h1>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-0.5">Smart Systems</p>
          </div>
        </div>
        {isMobile && onClose && (
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* User Profile */}
      <div className="p-6">
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm group hover:border-emerald-500/30 transition-all">
          <div className="relative">
            <Avatar src={user.photoURL} name={user.displayName || 'User'} size="md" className="ring-2 ring-emerald-500/20 group-hover:ring-emerald-500/50 transition-all" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0a0a] shadow-sm" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="font-bold text-white truncate">{user.displayName || 'ראמי סבן'}</p>
            <p className="text-[10px] text-slate-500 font-bold truncate uppercase">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Menu Body */}
      <div className="flex-1 px-4 overflow-y-auto space-y-1 py-4">
        <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">תפריט ראשי</p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = viewMode === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setViewMode(item.id);
                if (isMobile && onClose) onClose();
              }}
              className={`w-full flex items-center gap-4 p-3.5 rounded-xl transition-all relative overflow-hidden group ${
                isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-xl' 
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-white border border-transparent'
              }`}
            >
              {isActive && (
                <motion.div 
                  layoutId="nav-glow" 
                  className="absolute inset-0 bg-emerald-500/5 pointer-events-none" 
                />
              )}
              <Icon size={20} className={isActive ? 'text-emerald-500' : 'group-hover:text-emerald-400 transition-colors'} />
              <span className={`text-sm font-bold ${isActive ? 'text-white' : ''}`}>{item.label}</span>
              {item.id === 'chat_full' && (
                <div className="mr-auto">
                  <Sparkles size={12} className="text-emerald-500 animate-pulse" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-800/50 bg-black/20">
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all font-bold text-sm border border-red-500/20"
        >
          <LogOut size={18} />
          <span>התנתק מהמערכת</span>
        </button>
        <div className="mt-4 flex items-center justify-center gap-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
          <span>SabanOS v4.0.1</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span>Hyper-Modern Glass</span>
        </div>
      </div>
    </div>
  );

  return content;
};
