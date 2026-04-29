import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { GasService } from '../services/gasService';
import { useToast } from './ToastProvider';
import { Order, InventoryItem } from '../types';

interface SyncContextType {
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSync: Date | null;
  pipelineHealth: {
    firebase: boolean;
    gas: boolean;
  };
}

const SyncContext = createContext<SyncContextType>({
  status: 'disconnected',
  lastSync: null,
  pipelineHealth: { firebase: false, gas: false }
});

export const useSync = () => useContext(SyncContext);

interface QueueItem {
  type: 'order' | 'inventory' | 'log';
  data: any;
}

export const SyncManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToast } = useToast();
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'syncing' | 'error'>('disconnected');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pipelineHealth, setPipelineHealth] = useState({ firebase: false, gas: false });
  
  // Throttle Queue
  const syncQueue = useRef<{ [key: string]: QueueItem }>({});
  const throttleTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let unsubscribeSync: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setStatus('connected');
        setPipelineHealth(prev => ({ ...prev, firebase: true }));
        
        // Clean up previous sync if it exists
        if (unsubscribeSync) unsubscribeSync();
        unsubscribeSync = initRealtimeSync();
      } else {
        setStatus('disconnected');
        setPipelineHealth({ firebase: false, gas: false });
        if (unsubscribeSync) {
          unsubscribeSync();
          unsubscribeSync = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSync) unsubscribeSync();
    };
  }, []);

  const processQueue = async () => {
    const items = Object.values(syncQueue.current) as QueueItem[];
    if (items.length === 0) return;

    setStatus('syncing');
    console.log(`🧬 SyncManager starting push to GAS URL: ${import.meta.env.VITE_GAS_URL}`);
    try {
      // Process batch
      for (const item of items) {
        if (item.type === 'order') await GasService.syncOrder(item.data);
        if (item.type === 'inventory') await GasService.syncInventory(item.data);
        if (item.type === 'log') await GasService.logBlackBox(item.data);
      }
      
      setSyncResult(true);
    } catch (err) {
      setSyncResult(false);
    } finally {
      syncQueue.current = {};
      throttleTimeout.current = null;
    }
  };

  const setSyncResult = (success: boolean) => {
    if (success) {
      setLastSync(new Date());
      setStatus('connected');
      setPipelineHealth(prev => ({ ...prev, gas: true }));
    } else {
      setStatus('error');
      setPipelineHealth(prev => ({ ...prev, gas: false }));
      addToast('שגיאת סינכרון', 'נכשל החיבור לגליונות גוגל. בדוק הרשאות.', 'warning');
    }
  };

  const queueSync = (id: string, type: 'order' | 'inventory' | 'log', data: any) => {
    syncQueue.current[id] = { type, data };
    if (!throttleTimeout.current) {
      throttleTimeout.current = setTimeout(processQueue, 1500); // 1.5s throttle
    }
  };

  const initRealtimeSync = () => {
    const currentUID = auth.currentUser?.uid;

    // 1. Orders
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const order = { id: change.doc.id, ...change.doc.data() };
          queueSync(`order_${order.id}`, 'order', order);
        }
      });
    }, () => setPipelineHealth(prev => ({ ...prev, firebase: false })));

    // 2. Inventory
    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const item = { id: change.doc.id, ...change.doc.data() };
          queueSync(`inv_${item.id}`, 'inventory', item);
        }
      });
    }, () => setPipelineHealth(prev => ({ ...prev, firebase: false })));

    // 3. BlackBox Audit (for deletions and critical state)
    const unsubAudit = onSnapshot(collection(db, 'orders'), (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          queueSync(`log_${change.doc.id}`, 'log', {
            operation: 'DELETE',
            collection: 'orders',
            path: `orders/${change.doc.id}`,
            oldValue: change.doc.data()
          });
        }
      });
    });

    return () => {
      unsubOrders();
      unsubInventory();
      unsubAudit();
    };
  };

  return (
    <SyncContext.Provider value={{ status, lastSync, pipelineHealth }}>
      {children}
    </SyncContext.Provider>
  );
};
