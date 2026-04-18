import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, MapPin, Package, Hash, Search as SearchIcon } from 'lucide-react';
import { Order } from '../services/auraService';
import { highlightText } from '../lib/utils';

interface SearchSuggestionsProps {
  orders: Order[];
  searchQuery: string;
  isVisible: boolean;
  onSelect: (value: string) => void;
}

export const SearchSuggestions = ({ orders, searchQuery, isVisible, onSelect }: SearchSuggestionsProps) => {
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
    items: Array.from(new Set(orders
      .filter(o => o.items.toLowerCase().includes(query))
      .flatMap(o => o.items.split(',').map(i => i.trim()))
      .filter(i => i.toLowerCase().includes(query)))).slice(0, 3)
  };

  const hasAnySuggestions = 
    suggestions.customers.length > 0 || 
    suggestions.destinations.length > 0 || 
    suggestions.orders.length > 0 || 
    suggestions.items.length > 0;

  if (!hasAnySuggestions) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 right-0 z-50 mt-2 bg-white/95 backdrop-blur-md border border-gray-100 rounded-[2rem] shadow-2xl shadow-sky-900/10 overflow-hidden"
      dir="rtl"
    >
      <div className="p-4 space-y-4">
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
      </div>
    </motion.div>
  );
};
