import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend, 
  BarChart, 
  Bar 
} from 'recharts';
import { 
  collection, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { Order, Driver } from '../types';
import { 
  format, 
  subDays, 
  parseISO, 
  isValid, 
  eachDayOfInterval 
} from 'date-fns';
import { he } from 'date-fns/locale';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  Warehouse, 
  Users, 
  Calendar,
  Activity,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

const COLORS = ['#C5A059', '#34D399', '#3b82f6', '#ef4444', '#a855f7'];

export const SummaryAnalyticsDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Define date-range for past 7 days strictly to optimize Firebase queries
  const dateParams = useMemo(() => {
    const today = new Date();
    const start = subDays(today, 6);
    return {
      startDateStr: format(start, 'yyyy-MM-dd'),
      endDateStr: format(today, 'yyyy-MM-dd'),
      interval: { start, end: today }
    };
  }, []);

  // 1. Firebase Query Optimization - strictly fetch last 7 days
  useEffect(() => {
    setLoading(true);
    
    // Precise order query
    const ordersQuery = query(
      collection(db, 'orders'),
      where('date', '>=', dateParams.startDateStr)
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Order);
      setOrders(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    // Drivers listing to resolve IDs to Names
    const driversQuery = query(collection(db, 'drivers'));
    const unsubscribeDrivers = onSnapshot(driversQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Driver);
      setDrivers(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'drivers');
    });

    return () => {
      unsubscribeOrders();
      unsubscribeDrivers();
    };
  }, [dateParams.startDateStr]);

  // 2. Wrap all data aggregations & chart formatters in useMemo (Memoization)
  const stats = useMemo(() => {
    const total = orders.length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    const inProgress = total - delivered - cancelled - pending;

    const denominator = total - cancelled;
    const successRate = denominator > 0 ? Math.round((delivered / denominator) * 100) : 100;

    return {
      total,
      delivered,
      pending,
      cancelled,
      inProgress,
      successRate
    };
  }, [orders]);

  // Dynamic weekly chart values mapped to exact calendar days within the last 7 days
  const chartDataWeekly = useMemo(() => {
    const days = eachDayOfInterval(dateParams.interval);
    
    return days.map(day => {
      const formattedDate = format(day, 'yyyy-MM-dd');
      const dayNameHebrew = format(day, 'EEEE', { locale: he });
      
      const dayOrders = orders.filter(o => o.date === formattedDate);
      const deliveredCount = dayOrders.filter(o => o.status === 'delivered').length;
      const delayedCount = dayOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;

      return {
        שם_היום: dayNameHebrew,
        תאריך: format(day, 'dd/MM'),
        נפח_משלוחים: dayOrders.length,
        סופקו: deliveredCount,
        בעבודה: delayedCount
      };
    });
  }, [orders, dateParams.interval]);

  // Warehouse breakdown aggregation
  const warehouseStats = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      const wh = o.warehouse || 'החרש';
      counts[wh] = (counts[wh] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value
    }));
  }, [orders]);

  // Driver breakdown aggregation
  const driverPerformanceStats = useMemo(() => {
    const driverCounts: Record<string, { name: string; total: number; delivered: number }> = {};
    
    // Seed driver dictionary
    drivers.forEach(d => {
      driverCounts[d.id] = { name: d.name, total: 0, delivered: 0 };
    });

    // Fallbacks
    driverCounts['self'] = { name: 'איסוף עצמי', total: 0, delivered: 0 };
    driverCounts['unassigned'] = { name: 'לא שויך', total: 0, delivered: 0 };

    orders.forEach(o => {
      const drId = o.driverId || 'unassigned';
      if (!driverCounts[drId]) {
        driverCounts[drId] = { name: drId === 'unassigned' ? 'לא שויך' : 'נהג חיצוני', total: 0, delivered: 0 };
      }
      driverCounts[drId].total += 1;
      if (o.status === 'delivered') {
        driverCounts[drId].delivered += 1;
      }
    });

    return Object.values(driverCounts)
      .filter(item => item.total > 0)
      .map(item => ({
        name: item.name,
        נפח_כולל: item.total,
        בוצעו: item.delivered
      }))
      .sort((a, b) => b.נפח_כולל - a.נפח_כולל);
  }, [orders, drivers]);

  // 4. Skeleton Loader Layout corresponding exactly to charts while Firebase Promise resolves
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen" dir="rtl">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-slate-100 shadow-lg animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="space-y-2">
              <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-32 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
          <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>

        {/* KPIs Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-slate-100 shadow-md animate-pulse space-y-3">
              <div className="flex justify-between items-center">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                <div className="w-12 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="w-16 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="w-24 h-6 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Area Chart Skeleton */}
          <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] p-5 rounded-[2.5rem] border border-slate-100 shadow-lg animate-pulse flex flex-col justify-between h-[360px]">
            <div className="space-y-2">
              <div className="w-48 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-64 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
            <div className="flex-1 flex items-end gap-3 px-4 py-6">
              {[...Array(7)].map((_, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-100 dark:bg-slate-800 w-full rounded-t-lg" 
                  style={{ height: `${20 + idx * 10}%` }} 
                />
              ))}
            </div>
          </div>

          {/* Pie Chart Skeleton */}
          <div className="bg-white dark:bg-[#1E293B] p-5 rounded-[2.5rem] border border-slate-100 shadow-lg animate-pulse flex flex-col justify-between h-[360px]">
            <div className="space-y-2">
              <div className="w-32 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-44 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-36 h-36 rounded-full border-[16px] border-slate-100 dark:border-slate-800 flex items-center justify-center" />
            </div>
          </div>
        </div>

        {/* Bottom Driver Chart Skeleton */}
        <div className="bg-white dark:bg-[#1E293B] p-5 rounded-[2.5rem] border border-slate-100 shadow-lg animate-pulse flex flex-col justify-between h-[280px]">
          <div className="w-44 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="flex-1 flex items-end gap-4 px-6 py-4">
            {[...Array(4)].map((_, idx) => (
              <div 
                key={idx} 
                className="bg-slate-100 dark:bg-slate-800 w-full rounded-t-xl" 
                style={{ height: `${40 + (idx % 2) * 20}%` }} 
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen font-sans" dir="rtl">
      
      {/* 3. Luxury UI/UX Header Overlay (Status bar & Avatar/Precise Brand Overlay) */}
      <div 
        className="relative bg-gradient-to-r from-slate-900 to-sky-950 p-4 rounded-3xl border border-white/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-hidden"
        style={{ padding: '16px', margin: '0 0 12px 0' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A059]/10 rounded-full blur-3xl" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative shrink-0">
            <img 
              src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
              alt="Noa" 
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full object-cover border-2 border-[#C5A059] shadow-md"
            />
            <div className="absolute -bottom-1 -left-1 bg-emerald-500 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white leading-none">נועה | מחוברת ✅</h2>
              <span className="bg-[#C5A059] text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                Performance Master
              </span>
            </div>
            <p className="text-[12px] text-white mt-1 leading-none font-medium">
              ניתוח ביצועים ולוגיסטיקה בזמן אמת עבור סניפי ח.סבן
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0 self-end md:self-center">
          <div className="bg-white/10 p-2.5 rounded-2xl border border-white/15 flex items-center gap-2 text-white">
            <Calendar size={16} className="text-[#C5A059]" />
            <span className="text-xs font-black">
              7 הימים האחרונים ({format(parseISO(dateParams.startDateStr), 'dd/MM/yy')} - {format(new Date(), 'dd/MM/yy')})
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards section (Fluid Grid with no transparency text rules) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 m-0" style={{ marginBottom: '12px' }}>
        
        {/* SUCCESS RATE */}
        <motion.div 
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="bg-white dark:bg-slate-900 border border-slate-100 p-4 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between"
          style={{ padding: '16px' }}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black tracking-widest text-[#1E293B] dark:text-white uppercase leading-none">
              שיעור כח אדם והצלחה
            </span>
            <div className="p-2 bg-[#34D399]/15 text-emerald-600 rounded-xl">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-bold text-slate-500 leading-none mb-1">הצלחת מסלוחים השבוע</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#34D399] leading-none">
                {stats.successRate}%
              </span>
              <span className="text-xs font-bold text-[#34D399] flex items-center">
                <ArrowUpRight size={12} className="ml-0.5" /> מעל היעד
              </span>
            </div>
          </div>
        </motion.div>

        {/* TOTAL FLOW */}
        <motion.div 
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="bg-white dark:bg-slate-900 border border-slate-100 p-4 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between"
          style={{ padding: '16px' }}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black tracking-widest text-[#1E293B] dark:text-white uppercase leading-none">
              נפח הזמנות כולל
            </span>
            <div className="p-2 bg-[#C5A059]/15 text-[#C5A059] rounded-xl">
              <Activity size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-bold text-slate-500 leading-none mb-1">סה״כ הזמנות השבוע</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#1E293B] dark:text-white leading-none">
                {stats.total}
              </span>
              <span className="text-xs font-black text-slate-400">הזמנות רשומות</span>
            </div>
          </div>
        </motion.div>

        {/* DELIVERED */}
        <motion.div 
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="bg-white dark:bg-slate-900 border border-slate-100 p-4 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between"
          style={{ padding: '16px' }}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black tracking-widest text-[#1E293B] dark:text-white uppercase leading-none">
              בוצע בהצלחה
            </span>
            <div className="p-2 bg-blue-500/15 text-blue-600 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-bold text-slate-500 leading-none mb-1">משלוחים שסופקו</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {stats.delivered}
              </span>
              <span className="text-xs font-bold text-emerald-500">
                ({Math.round(stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0)}%) סופקו
              </span>
            </div>
          </div>
        </motion.div>

        {/* IN GENERAL PROGRESS */}
        <motion.div 
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="bg-white dark:bg-slate-900 border border-slate-100 p-4 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between"
          style={{ padding: '16px' }}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black tracking-widest text-[#1E293B] dark:text-white uppercase leading-none">
              פעיל בצנרת
            </span>
            <div className="p-2 bg-amber-500/15 text-amber-600 rounded-xl">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-bold text-slate-500 leading-none mb-1">בהכנה ובדרך</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {stats.inProgress + stats.pending}
              </span>
              <span className="text-xs font-bold text-amber-500">
                {stats.pending} בהמתנה
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main content grid - Recharts with fluid layout & absolute high-end visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 m-0" style={{ marginBottom: '12px' }}>
        
        {/* Flow Area Chart Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col justify-between h-[380px]">
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-[#C5A059]" />
              <h3 className="font-black text-slate-900 dark:text-white text-md leading-none">
                נפח משלוחים שבועי
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-bold uppercase mt-1 leading-none">
              השוואה של כמות הזמנות מול משלוחים שסופקו בפועל ב-7 הימים האחרונים
            </p>
          </div>

          <div className="flex-1 min-h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C5A059" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#C5A059" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34D399" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#34D399" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="תאריך" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 11, className: 'font-black text-slate-500 fill-slate-500' }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 11, className: 'font-black text-slate-500 fill-slate-500' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    direction: 'rtl', 
                    borderRadius: '16px', 
                    border: '1px solid #f1f5f9', 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px'
                  }} 
                />
                <Area 
                  name="הזמנות כולו" 
                  type="monotone" 
                  dataKey="נפח_משלוחים" 
                  stroke="#C5A059" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
                <Area 
                  name="סופקו" 
                  type="monotone" 
                  dataKey="סופקו" 
                  stroke="#34D399" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorDelivered)" 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Warehouse Pie Chart Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col justify-between h-[380px]">
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <Warehouse size={18} className="text-[#C5A059]" />
              <h3 className="font-black text-slate-900 dark:text-white text-md leading-none">
                התפלגות משלוחים לפי מחסן
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-bold uppercase mt-1 leading-none">
              סיווג הזמנות בין מחסן החרש למחסן התלמיד
            </p>
          </div>

          <div className="flex-1 relative flex items-center justify-center min-h-[220px]">
            {warehouseStats.length === 0 ? (
              <p className="text-slate-400 font-bold text-sm">אין נתונים השבוע</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={warehouseStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {warehouseStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      direction: 'rtl', 
                      borderRadius: '12px', 
                      fontSize: '11px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }} 
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Success center badge overlay */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-black text-slate-400 leading-none">
                מחסן מוביל
              </span>
              <span className="text-md font-black text-[#C5A059] leading-none mt-1">
                {warehouseStats.length > 0 ? warehouseStats.sort((a,b)=>b.value-a.value)[0]?.name : 'ח. סבן'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Performance Chart Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col justify-between h-[300px]">
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#C5A059]" />
            <h3 className="font-black text-slate-900 dark:text-white text-md leading-none">
              ביצועי משלוחים של נהגים
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-bold uppercase mt-1 leading-none">
            חתך נפח מול סיומי משלוח מוצלחים לפי משויכים
          </p>
        </div>

        <div className="flex-1 w-full min-h-[180px]">
          {driverPerformanceStats.length === 0 ? (
            <p className="text-slate-400 font-bold text-sm text-center pt-8">לא נרשמו הקצאות נהגים השבוע</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverPerformanceStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 11, className: 'font-black text-slate-500 fill-slate-500' }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 11, className: 'font-black text-slate-500 fill-slate-500' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    direction: 'rtl', 
                    borderRadius: '12px', 
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 5 }} />
                <Bar name="משלוחים שהוקצו" dataKey="נפח_כולל" fill="#C5A059" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar name="סופקו בהצלחה" dataKey="בוצעו" fill="#34D399" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Mandatory signature of Noa required by SabanOS protocols */}
      <div className="signature text-center py-2 text-gold font-bold text-sm">
        באדיבות נועה ❤️
      </div>
    </div>
  );
};
