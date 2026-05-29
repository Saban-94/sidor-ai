import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { GasService } from '../services/gasService';
import { useToast } from './ToastProvider';
import { Order, InventoryItem } from '../types';

interface QueueItem {
  id: string;
  type: 'order' | 'inventory' | 'customer' | 'log';
  data: any;
  timestamp: number;
}

interface SyncContextType {
  status: 'connected' | 'disconnected' | 'syncing' | 'error' | 'offline-pending';
  lastSync: Date | null;
  queueSize: number;
  pipelineHealth: {
    firebase: boolean;
    gas: boolean;
  };
  triggerSync: (type: 'order' | 'inventory' | 'customer' | 'log', data: any) => void;
  syncAll: () => Promise<void>;
  syncInventoryNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
  status: 'disconnected',
  lastSync: null,
  queueSize: 0,
  pipelineHealth: { firebase: false, gas: false },
  triggerSync: () => {},
  syncAll: async () => {},
  syncInventoryNow: async () => {}
});

export const useSync = () => useContext(SyncContext);

const QUEUE_STORAGE_KEY = 'saban_sync_queue';

export const SyncManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToast } = useToast();
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'syncing' | 'error' | 'offline-pending'>('disconnected');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pipelineHealth, setPipelineHealth] = useState({ firebase: false, gas: false });
  const [queueSize, setQueueSize] = useState(0);
  
  // Throttle & Queue
  const syncQueue = useRef<{ [key: string]: QueueItem }>({});
  const throttleTimeout = useRef<NodeJS.Timeout | null>(null);
  const isSyncing = useRef(false);

  // Load offline queue on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (savedQueue) {
      try {
        syncQueue.current = JSON.parse(savedQueue);
        setQueueSize(Object.keys(syncQueue.current).length);
        if (Object.keys(syncQueue.current).length > 0) {
          setStatus('offline-pending');
        }
      } catch (e) {
        console.error("Failed to parse saved sync queue", e);
      }
    }

    const handleOnline = () => {
      console.log("🌐 Network is back online. Flushing queue...");
      addToast('החיבור חזר', 'מבצע סנכרון נתונים שהצטברו...', 'success');
      processBatch();
    };

    const handleOffline = () => {
      console.warn("🌐 Network went offline. Staging changes locally.");
      addToast('מצב אופליין', 'השינויים נשמרים מקומית ויסונכרנו כשהחיבור יחזור.', 'warning');
      setStatus('offline-pending');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleSyncRequest = (e: any) => {
      if (e.detail && e.detail.type && e.detail.data) {
        triggerSync(e.detail.type, e.detail.data);
      }
    };

    window.addEventListener('sync-trigger', handleSyncRequest);

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const hasPending = Object.keys(syncQueue.current).length > 0;
        setStatus(hasPending ? 'offline-pending' : 'connected');
        setPipelineHealth(prev => ({ 
          ...prev, 
          firebase: true,
          gas: navigator.onLine ? (!hasPending ? true : prev.gas) : false 
        }));
        if (navigator.onLine && hasPending) {
          processBatch();
        }
      } else {
        setStatus('disconnected');
        setPipelineHealth({ firebase: false, gas: false });
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-trigger', handleSyncRequest);
      unsubscribeAuth();
    };
  }, []);

  const saveQueueToDisk = () => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(syncQueue.current));
    setQueueSize(Object.keys(syncQueue.current).length);
  };

  const triggerSync = (type: 'order' | 'inventory' | 'customer' | 'log', data: any) => {
    const id = data.id || `temp_${Date.now()}`;
    const key = `${type}_${id}`;
    
    syncQueue.current[key] = {
      id,
      type,
      data,
      timestamp: Date.now()
    };
    
    saveQueueToDisk();

    if (!navigator.onLine) {
      setStatus('offline-pending');
      return;
    }

    // Debounce processing (2500ms for high efficiency)
    if (throttleTimeout.current) clearTimeout(throttleTimeout.current);
    throttleTimeout.current = setTimeout(processBatch, 2500);
  };

  const syncAll = async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    setStatus('syncing');
    addToast('סנכרון מלא', 'מעדכן את כל הגליונות מהבסיס... 🚛', 'info');

    try {
      const { getDocs, collection } = await import('firebase/firestore');
      
      // 1. Sync Active Orders (today and future)
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      for (const order of orders) {
        await GasService.syncOrder(order);
      }

      // 2. Sync Inventory
      const invSnap = await getDocs(collection(db, 'inventory'));
      const inventory = invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      for (const item of inventory) {
        await GasService.syncInventory(item);
      }

      addToast('הסנכרון הושלם!', 'כל הנתונים הזרקו לגליונות ✅', 'success');
      setLastSync(new Date());
      setStatus('connected');
      setPipelineHealth(prev => ({ ...prev, gas: true }));
    } catch (error: any) {
      console.error("Full sync failure:", error);
      setStatus('error');
      setPipelineHealth(prev => ({ ...prev, gas: false }));
      addToast('שגיאת סנכרון', error.message, 'warning');
    } finally {
      isSyncing.current = false;
    }
  };

  const syncInventoryNow = async () => {
    if (isSyncing.current) return;
    setStatus('syncing');
    try {
      const { getDocs, collection } = await import('firebase/firestore');
      const invSnap = await getDocs(collection(db, 'inventory'));
      const inventory = invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      for (const item of inventory) {
        await GasService.syncInventory(item);
      }
      addToast('מלאי סונכרן', 'גליון המלאי עודכן ✅', 'success');
      setLastSync(new Date());
      setStatus('connected');
      setPipelineHealth(prev => ({ ...prev, gas: true }));
    } catch (error: any) {
      setStatus('error');
      setPipelineHealth(prev => ({ ...prev, gas: false }));
      addToast('שגיאה בסנכרון מלאי', error.message, 'warning');
    }
  };

  const processBatch = async () => {
    if (isSyncing.current || Object.keys(syncQueue.current).length === 0) return;
    if (!navigator.onLine) return;

    isSyncing.current = true;
    setStatus('syncing');
    
    const items = (Object.entries(syncQueue.current) as [string, QueueItem][])
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    let successCount = 0;
    
    try {
      for (const [key, item] of items) {
        let res;
        switch (item.type) {
          case 'order':
            res = await GasService.syncOrder(item.data);
            break;
          case 'inventory':
            res = await GasService.syncInventory(item.data);
            break;
          case 'customer':
            res = await GasService.syncCustomer(item.data);
            break;
          case 'log':
            res = await GasService.logBlackBox(item.data);
            break;
        }

        if (res && res.status === 'success') {
          delete syncQueue.current[key];
          successCount++;
        } else {
          console.error(`Sync failed for item ${key}:`, res?.error);
        }
      }
      
      saveQueueToDisk();
      
      if (Object.keys(syncQueue.current).length === 0) {
        setStatus('connected');
        setLastSync(new Date());
        setPipelineHealth(prev => ({ ...prev, gas: true }));
      } else {
        setStatus('error');
        setPipelineHealth(prev => ({ ...prev, gas: false }));
      }
    } catch (err) {
      console.error("Batch sync failure:", err);
      setStatus('error');
      setPipelineHealth(prev => ({ ...prev, gas: false }));
    } finally {
      isSyncing.current = false;
      throttleTimeout.current = null;
    }
  };

  return (
    <SyncContext.Provider value={{ status, lastSync, queueSize, pipelineHealth, triggerSync, syncAll, syncInventoryNow }}>
      {children}
    </SyncContext.Provider>
  );
};
