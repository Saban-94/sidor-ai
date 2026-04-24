import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, MapPin, Package, Hash, Search as SearchIcon, AlertTriangle } from 'lucide-react';
import { Order, InventoryItem } from '../types';
import { highlightText } from '../lib/utils';

interface SearchSuggestionsProps {
  orders: Order[];
  inventoryItems?: InventoryItem[];
  searchQuery: string;
  isVisible: boolean;
  onSelect: (value: string) => void;
}

export const SearchSuggestions = ({ orders, inventoryItems = [], searchQuery, isVisible, onSelect }: SearchSuggestionsProps) => {
  if (!isVisible || searchQuery.length < 2) return null;

  const query = searchQuery.toLowerCase();
  
  // Extract unique matches from different fields
  const suggestions = {
    customers: Array.from(new Set(orders
      .filter(o => o.customerName.toLowerCase().includes(query))
      .map(o => o.customerName))).slice(0, 3),
    destinations: Array.from(new Set(orders
      .filter(o => o.destination.toLowerCase().includes(query))
      .map(o => o.destination))).slice(0, 3),
    orders: Array.from(new Set(orders
      .filter(o => o.orderNumber?.toLowerCase().includes(query))
      .map(o => o.orderNumber))).slice(0, 3),
    items: Array.from(new Set([
      ...orders
        .filter(o => o.items.toLowerCase().includes(query))
        .flatMap(o => o.items.split(/[,|\n]/).map(i => i.trim()))
        .filter(i => i.toLowerCase().includes(query)),
      ...inventoryItems
        .filter(i => i.name.toLowerCase().includes(query))
        .map(i => i.name)
    ]))
      .filter(val => val.length > 0)
      .slice(0, 5),
    skus: Array.from(new Set([
      ...orders
        .filter(o => {
          const skus = o.items.match(/\b\d{5}\b/g);
          return skus?.some(s => s.includes(query));
        })
        .flatMap(o => o.items.match(/\b\d{5}\b/g) || [])
        .filter(s => s.includes(query)),
      ...inventoryItems
        .filter(i => i.sku.toLowerCase().includes(query))
        .map(i => i.sku)
    ]))
      .slice(0, 3)
  };

  const hasAnySuggestions = 
    suggestions.customers.length > 0 || 
    suggestions.destinations.length > 0 || 
    suggestions.orders.length > 0 || 
    suggestions.items.length > 0 ||
    suggestions.skus.length > 0;

  // Add "Did you mean" if no results and query is somewhat long
  const corrections = !hasAnySuggestions && query.length >= 3 ? inventoryItems
    .filter(i => {
      // Simple logic: if query is a prefix or contains parts of the name
      const parts = query.split(' ');
      return parts.some(p => p.length >= 3 && i.name.toLowerCase().includes(p));
    })
    .slice(0, 2) : [];

  if (!hasAnySuggestions && corrections.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 right-0 z-50 mt-2 bg-white/95 backdrop-blur-md border border-gray-100 rounded-[2rem] shadow-2xl shadow-sky-900/10 overflow-hidden"
      dir="rtl"
    >
      <div className="p-4 space-y-4">
        {!hasAnySuggestions && corrections.length > 0 && (
          <div className="bg-sky-50/50 p-3 rounded-2xl border border-sky-100 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-sky-600" />
              <span className="text-xs font-bold text-sky-800">לא נמצאו תוצאות מדויקות. האם התכוונת ל:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {corrections.map(item => (
                <button 
                  key={item.id}
                  onClick={() => onSelect(item.name)}
                  className="bg-white px-3 py-1.5 rounded-xl border border-sky-200 text-sm font-bold text-sky-700 hover:bg-sky-600 hover:text-white transition-all shadow-sm"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestions.customers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-3 mb-2">
              <User size={12} className="text-sky-500" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">לקוחות</span>
            </div>
            <div className="space-y-1">
              {suggestions.customers.map((val) => (
                <button
                  key={val}
                  onClick={() => onSelect(val)}
                  className="w-full text-right px-3 py-2 rounded-xl hover:bg-sky-50 transition-colors text-sm font-bold text-gray-700 flex items-center justify-between group"
                >
                  <span>{highlightText(val, searchQuery)}</span>
                  <SearchIcon size={14} className="opacity-0 group-hover:opacity-100 text-sky-400 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestions.destinations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-3 mb-2">
              <MapPin size={12} className="text-orange-500" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">יעדים</span>
            </div>
            <div className="space-y-1">
              {suggestions.destinations.map((val) => (
                <button
                  key={val}
                  onClick={() => onSelect(val)}
                  className="w-full text-right px-3 py-2 rounded-xl hover:bg-orange-50 transition-colors text-sm font-bold text-gray-700 flex items-center justify-between group"
                >
                  <span>{highlightText(val, searchQuery)}</span>
                  <SearchIcon size={14} className="opacity-0 group-hover:opacity-100 text-orange-400 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestions.orders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-3 mb-2">
              <Hash size={12} className="text-gray-900" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">מספרי הזמנה</span>
            </div>
            <div className="space-y-1">
              {suggestions.orders.map((val) => val && (
                <button
                  key={val}
                  onClick={() => onSelect(val)}
                  className="w-full text-right px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-sm font-bold text-gray-700 flex items-center justify-between group"
                >
                  <span>{highlightText(val, searchQuery)}</span>
                  <SearchIcon size={14} className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestions.items.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-3 mb-2">
              <Package size={12} className="text-pink-500" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">פריטים</span>
            </div>
            <div className="space-y-1">
              {suggestions.items.map((val) => (
                <button
                  key={val}
                  onClick={() => onSelect(val)}
                  className="w-full text-right px-3 py-2 rounded-xl hover:bg-pink-50 transition-colors text-sm font-bold text-gray-700 flex items-center justify-between group"
                >
                  <span>{highlightText(val, searchQuery)}</span>
                  <SearchIcon size={14} className="opacity-0 group-hover:opacity-100 text-pink-400 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}
        {suggestions.skus.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-3 mb-2">
              <Hash size={12} className="text-emerald-500" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">מק"טים (SKU)</span>
            </div>
            <div className="space-y-1">
              {suggestions.skus.map((val) => (
                <button
                  key={val}
                  onClick={() => onSelect(val)}
                  className="w-full text-right px-3 py-2 rounded-xl hover:bg-emerald-50 transition-colors text-sm font-bold text-gray-700 flex items-center justify-between group"
                >
                  <span>{highlightText(val, searchQuery)}</span>
                  <SearchIcon size={14} className="opacity-0 group-hover:opacity-100 text-emerald-400 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
