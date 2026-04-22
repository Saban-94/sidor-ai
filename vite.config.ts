import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // טעינת משתני סביבה מהקובץ המקומי או מהמערכת (Vercel)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    // הגדרת קידומות מותרות - חשוב מאוד!
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    
    // תיקון: Vite חושף משתנים דרך import.meta.env ולא process.env כברירת מחדל.
    // הקוד הבא מבטיח שהמפתח יהיה זמין גם אם תקרא לו בשיטה הישנה.
    define: {
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // שינוי ל-./src כמקובל
      },
    },
    
    server: {
      // HMR הגדרות עבור סביבות פיתוח
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    
    // תוספת קריטית למניעת שגיאות MIME ב-Build
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
    }
  };
});
