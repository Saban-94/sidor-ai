import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrderItem, InventoryItem } from '../types';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  ShoppingBag,
  Warehouse,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { he } from 'date-fns/locale';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const InventoryAnalytics: React.FC = () => {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Current day range for KPIs
    const today = startOfDay(new Date());
    
    const unsubscribeItems = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[]);
    });

    const unsubscribeOrders = onSnapshot(collection(db, 'order_items'), (snap) => {
      setOrderItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OrderItem[]);
      setLoading(false);
    });

    return () => {
      unsubscribeItems();
      unsubscribeOrders();
    };
  }, []);

  // 1. KPI: Daily Units Sum
  const dailyUnits = useMemo(() => {
    const today = startOfDay(new Date());
    return orderItems
      .filter(item => {
        const itemDate = item.createdAt instanceof Timestamp ? item.createdAt.toDate() : new Date();
        return itemDate >= today;
      })
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [orderItems]);

  // 2. Data for Pie Chart: Sales by originWarehouse
  const warehouseData = useMemo(() => {
    const counts: Record<string, number> = {};
    orderItems.forEach(item => {
      const warehouse = item.originWarehouse || 'לא ידוע';
      counts[warehouse] = (counts[warehouse] || 0) + item.quantity;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orderItems]);

  // 3. Data for Bar Chart: Top 10 Products
  const topProductsData = useMemo(() => {
    const productCounts: Record<string, { name: string, quantity: number }> = {};
    orderItems.forEach(item => {
      if (!productCounts[item.sku]) {
        productCounts[item.sku] = { name: item.name, quantity: 0 };
      }
      productCounts[item.sku].quantity += item.quantity;
    });
    
    return Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [orderItems]);

  // 4. KPI: Products At Risk (Stock < Order Qty Pending)
  const atRiskProducts = useMemo(() => {
    return inventory.filter(invItem => {
      const pendingQty = orderItems
        .filter(orderItem => orderItem.sku === invItem.sku && orderItem.status === 'pending')
        .reduce((sum, oi) => sum + oi.quantity, 0);
      return invItem.currentStock < pendingQty;
    });
  }, [inventory, orderItems]);

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700" dir="rtl">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl">
              <ShoppingBag size={24} />
            </div>
            <span className="flex items-center gap-1 text-emerald-600 font-black text-xs">
              <ArrowUpRight size={14} /> +12%
            </span>
          </div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">יחידות שיצאו היום</p>
          <h4 className="text-3xl font-black text-slate-900">{dailyUnits} יח'</h4>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <AlertTriangle size={24} />
            </div>
          </div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">מוצרים בסיכון</p>
          <h4 className={`text-3xl font-black ${atRiskProducts.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {atRiskProducts.length}
          </h4>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Warehouse size={24} />
            </div>
          </div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">מחסן פעיל ביותר</p>
          <h4 className="text-2xl font-black text-slate-900 truncate">
            {warehouseData.sort((a, b) => b.value - a.value)[0]?.name || '---'}
          </h4>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales by Origin */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <Warehouse className="text-sky-600" size={20} />
            פילוח מכירות לפי מקור
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={warehouseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {warehouseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'inherit', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="text-emerald-500" size={20} />
            10 המוצרים הנמכרים ביותר
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  width={100}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                />
                <Bar dataKey="quantity" fill="#0ea5e9" radius={[0, 10, 10, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* At Risk Products List */}
      {atRiskProducts.length > 0 && (
        <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-rose-600" size={20} />
            <h3 className="text-rose-900 font-black">התראת מלאי בסיכון ⚠️</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {atRiskProducts.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-rose-200 flex justify-between items-center">
                <div>
                  <p className="font-black text-slate-800 text-sm">{item.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{item.sku}</p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-rose-600 font-black">מלאי: {item.currentStock}</p>
                  <p className="text-[10px] text-slate-400">בהזמנה: {
                    orderItems.filter(oi => oi.sku === item.sku && oi.status === 'pending').reduce((s, o) => s + o.quantity, 0)
                  }</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
