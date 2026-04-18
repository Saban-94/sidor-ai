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

/**
 * Utility to combine class names
 */
export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
