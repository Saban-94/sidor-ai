import { useState, useEffect } from 'react';

/**
 * useUserMemory Hook
 * 
 * Manages user-specific persistence in localStorage.
 * Automatically loads data on mount and saves on change.
 * 
 * @param userId - The unique ID of the current user
 * @param key - The specific key for this memory segment
 * @param initialValue - Default structure if no memory exists
 */
export function useUserMemory<T>(userId: string | undefined, key: string, initialValue: T) {
  const fullKey = userId ? `aura_memory_${userId}_${key}` : null;

  const [memory, setMemory] = useState<T>(() => {
    if (typeof window === 'undefined' || !fullKey) return initialValue;
    try {
      const saved = localStorage.getItem(fullKey);
      return saved ? JSON.parse(saved) : initialValue;
    } catch (e) {
      console.warn(`[UserMemory] Failed to parse memory for ${key}`, e);
      return initialValue;
    }
  });

  // Track if we've already synced to avoid overwriting initial state before loading
  useEffect(() => {
    if (!fullKey) return;
    
    // Attempt to load whenever key changes (e.g. user logs in)
    try {
      const saved = localStorage.getItem(fullKey);
      if (saved) {
        setMemory(JSON.parse(saved));
      } else {
        setMemory(initialValue);
      }
    } catch (e) {
      setMemory(initialValue);
    }
  }, [fullKey]);

  // Save to localStorage whenever memory changes
  useEffect(() => {
    if (!fullKey) return;
    try {
      localStorage.setItem(fullKey, JSON.stringify(memory));
    } catch (e) {
      console.warn(`[UserMemory] Failed to save memory for ${key}`, e);
    }
  }, [fullKey, memory]);

  /**
   * Update the memory with new data.
   * Supports partial updates for objects.
   */
  const updateMemory = (newData: Partial<T> | T | ((prev: T) => T)) => {
    setMemory((prev) => {
      if (typeof newData === 'function') {
        return (newData as (prev: T) => T)(prev);
      }
      
      if (
        typeof newData === 'object' && 
        newData !== null && 
        typeof prev === 'object' && 
        prev !== null &&
        !Array.isArray(newData)
      ) {
        return { ...prev, ...newData } as T;
      }
      return newData as T;
    });
  };

  /**
   * Resets memory to initial state and removes from storage.
   */
  const clearMemory = () => {
    setMemory(initialValue);
    if (fullKey) {
      localStorage.removeItem(fullKey);
    }
  };

  return [memory, updateMemory, clearMemory] as const;
}
