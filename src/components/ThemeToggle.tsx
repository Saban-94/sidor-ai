import React from 'react';
import { Sun, Moon, Shield } from 'lucide-react';
import { AppTheme } from '../types';

interface ThemeToggleProps {
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ currentTheme, onThemeChange }) => {
  return (
    <div className="flex items-center bg-slate-900/80 dark:bg-slate-900 border border-slate-700/60 rounded-full p-1 shadow-inner text-xs font-medium">
      <button
        onClick={() => onThemeChange('light')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all ${
          currentTheme === 'light'
            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="ערכת נושא בהירה נקייה"
      >
        <Sun className="w-3.5 h-3.5" />
        <span>בהיר</span>
      </button>

      <button
        onClick={() => onThemeChange('slate')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all ${
          currentTheme === 'slate'
            ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="ערכת נושא אנטרפרייז (סלייט)"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>אנטרפרייז</span>
      </button>

      <button
        onClick={() => onThemeChange('dark')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all ${
          currentTheme === 'dark'
            ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="ערכת נושא כהה (אובסידיאן וזהב)"
      >
        <Moon className="w-3.5 h-3.5" />
        <span>כהה</span>
      </button>
    </div>
  );
};
