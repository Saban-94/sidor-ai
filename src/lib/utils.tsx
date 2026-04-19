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
 * Logistics: [Quantity] [Name] [SKU (5+ digits)]
 */
export function parseItems(text: string): ParsedItem[] {
  if (!text) return [];
  
  const items: ParsedItem[] = [];
  // Detect patterns like "8 חול שק גדול 11501" or "חול שק גדול 11501"
  const itemRegex = /(\d+)?\s*([^\d]+?)\s*(\d{5,})/g;
  let match;
  
  while ((match = itemRegex.exec(text)) !== null) {
    items.push({
      quantity: match[1] || '1',
      name: match[2].trim(),
      sku: match[3]
    });
  }
  
  if (items.length === 0 && text.trim()) {
    // Fallback: try to split by lines or just return one item
    const lines = text.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      const qMatch = line.match(/^(\d+)\s+(.+)/);
      if (qMatch) {
         items.push({ quantity: qMatch[1], name: qMatch[2].trim(), sku: '' });
      } else {
         items.push({ quantity: '1', name: line.trim(), sku: '' });
      }
    });
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
