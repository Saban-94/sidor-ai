import React from 'react';

/**
 * Highlights matches within a text string.
 * Returns an array of React elements (strings or spans).
 */
export function highlightText(text: string, highlight: string) {
  if (!highlight.trim()) {
    return text;
  }
  
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <span key={i} className="bg-sky-100 text-sky-900 font-bold px-0.5 rounded">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export interface ParsedItem {
  quantity: string;
  name: string;
  sku: string;
}

/**
 * Parses a raw string of items into structured objects.
 * Pattern: [Quantity] [Name] [SKU (exactly 5 digits)]
 */
export function parseItems(text: string): ParsedItem[] {
  if (!text) return [];
  
  const items: ParsedItem[] = [];
  
  // Split by lines first to ensure each line is handled individually
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  for (const line of lines) {
    // Regex logic:
    // 1. Optional number at start (Quantity)
    // 2. Any text (Name)
    // 3. Exactly 5 digits at end (SKU)
    const match = line.match(/^(\d+)?\s*(.+?)\s*(\d{5})$/);
    
    if (match) {
      items.push({
        quantity: match[1] || '1',
        name: match[2].trim(),
        sku: match[3]
      });
    } else {
      // Fallback: try to just get quantity and name if SKU is missing
      const fallbackMatch = line.match(/^(\d+)\s+(.+)/);
      if (fallbackMatch) {
         items.push({ quantity: fallbackMatch[1], name: fallbackMatch[2].trim(), sku: '' });
      } else if (line.trim()) {
         items.push({ quantity: '1', name: line.trim(), sku: '' });
      }
    }
  }

  return items;
}

export const CATALOG_KEYWORDS = ['מלט', 'חול', 'בידוד', 'בלוק', 'סומסום', 'טיח', 'דבק', 'גבס', 'סיד'];

export function isKnownProduct(name: string) {
  return CATALOG_KEYWORDS.some(keyword => name.includes(keyword));
}

/**
 * Utility to combine class names
 */
export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
