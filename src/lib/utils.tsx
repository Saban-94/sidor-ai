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
 * Handles quantities with units (e.g., '5 שקים מלט') and 5-digit SKUs.
 */
export function parseItems(text: string): ParsedItem[] {
  if (!text) return [];
  
  const items: ParsedItem[] = [];
  
  // Split by lines or commas to handle list formats
  const delimiters = /[\n,;]/;
  const rawLines = text.split(delimiters).map(l => l.trim()).filter(l => l);
  
  for (const line of rawLines) {
    // 1. Extract SKU (5 digits)
    const skuMatch = line.match(/\b\d{5}\b/);
    const sku = skuMatch ? skuMatch[0] : '';
    
    let workingLine = line;
    if (sku) {
      workingLine = workingLine.replace(new RegExp(`\\b${sku}\\b`), '').trim();
    }
    
    // 2. Extract Quantity and Unit
    // Matches: "5", "5 שקים", "2.5 טון", "חצי קוב"
    // Regex breakdown:
    // ^(\d+(?:\.\d+)?)? -> Optional Number (integers or decimals)
    // \s*
    // (שק|שקים|משט|משטחים|טון|טונות|קוב|יחידות|יח|מ"ר|מ"ק|ק"ג|קג|ליטר|ליטרים)? -> Optional Unit
    const qtyRegex = /^(\d+(?:\.\d+)?|חצי|רבע)?\s*(שק|שקים|משט|משטחים|טון|טונות|קוב|יחידות|יח|מ"ר|מ"ק|ק"ג|קג|ליטר|ליטרים)?\s+/;
    const qtyMatch = workingLine.match(qtyRegex);
    
    let quantity = '1';
    let unit = '';
    let name = workingLine;
    
    if (qtyMatch) {
      const rawQty = qtyMatch[1];
      unit = qtyMatch[2] || '';
      
      if (rawQty === 'חצי') quantity = '0.5';
      else if (rawQty === 'רבע') quantity = '0.25';
      else if (rawQty) quantity = rawQty;
      
      name = workingLine.replace(qtyRegex, '').trim();
    }
    
    // 3. Fallback: Check if quantity/unit are at the end (e.g. "מלט 5 שקים")
    if (!qtyMatch) {
      const endQtyRegex = /\s+(\d+(?:\.\d+)?|חצי|רבע)?\s*(שק|שקים|משט|משטחים|טון|טונות|קוב|יחידות|יח|מ"ר|מ"ק|ק"ג|קג|ליטר|ליטרים)$/;
      const endQtyMatch = workingLine.match(endQtyRegex);
      if (endQtyMatch) {
        const rawQty = endQtyMatch[1];
        unit = endQtyMatch[2] || '';
        
        if (rawQty === 'חצי') quantity = '0.5';
        else if (rawQty === 'רבע') quantity = '0.25';
        else if (rawQty) quantity = rawQty;
        
        name = workingLine.replace(endQtyRegex, '').trim();
      }
    }

    // Clean up
    name = name.replace(/לא צוין/g, '').trim();
    if (!name && sku) name = `מוצר ${sku}`;
    
    // If we have a unit, append it to quantity or keep it separate if we change the interface
    // For now, let's keep it in the name or quantity string to be safe with existing types
    const displayQuantity = unit ? `${quantity} ${unit}` : quantity;

    if (name || sku) {
      items.push({
        quantity: displayQuantity,
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
