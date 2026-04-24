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
    // 1. Try to find a 5-digit SKU anywhere in the line
    const skuMatch = line.match(/\b\d{5}\b/);
    const sku = skuMatch ? skuMatch[0] : '';
    
    // 2. Remove the SKU from the line to parse quantity and name
    let lineWithoutSku = line;
    if (sku) {
      // Replace only the first occurrence to be safe
      lineWithoutSku = line.replace(new RegExp(`\\b${sku}\\b`), '').trim();
    }
    
    // 3. Find leading quantity
    const qtyMatch = lineWithoutSku.match(/^(\d+)\s+/);
    const quantity = qtyMatch ? qtyMatch[1] : '1';
    
    // 4. Name is what remains
    let name = lineWithoutSku;
    if (qtyMatch) {
      name = lineWithoutSku.replace(new RegExp(`^${quantity}\\s+`), '').trim();
    }
    
    // Clean up common filler words
    name = name.replace(/לא צוין/g, '').trim();
    
    // If name is empty but we have a SKU, use the SKU as name for now
    if (!name && sku) {
      name = `מוצר ${sku}`;
    }

    if (name || sku) {
      items.push({
        quantity: quantity || '1',
        name: name || 'פריט ללא שם',
        sku: sku || ''
      });
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
