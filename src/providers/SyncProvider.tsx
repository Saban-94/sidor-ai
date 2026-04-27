import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { GasService } from '../services/gasService';
import { Order, InventoryItem } from '../types';
import { useToast } from './ToastProvider';

interface SyncContextType {
  status: 'connected' | 'disconnected' | 'syncing';
  lastSync: Date | null;
}

const SyncContext = createContext<SyncContextType>({
  status: 'disconnected',
  lastSync: null
});

export const useSync = () => useContext(SyncContext);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToast } = useToast();
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'syncing'>('disconnected');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState({
    orders: true,
    inventory: true
  });

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setStatus('connected');
        initRealtimeSync();
      } else {
        setStatus('disconnected');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const initRealtimeSync = () => {
    // 1. Orders Monitoring
    const unsubOrders = onSnapshot(collection(db, 'orders'), async (snapshot) => {
      if (isInitialLoad.orders) {
        setIsInitialLoad(prev => ({ ...prev, orders: false }));
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type === 'added' || change.type === 'modified') {
          const order = { id: change.doc.id, ...change.doc.data() } as Order;
          try {
            setStatus('syncing');
            await GasService.syncOrder(order);
            await GasService.logBlackBox({
              operation: change.type.toUpperCase(),
              collection: 'orders',
              path: `orders/${change.doc.id}`,
              newValue: order
            });
            setLastSync(new Date());
            setStatus('connected');
          } catch (error) {
            console.error("Order Sync Error:", error);
            setStatus('disconnected');
            addToast('שגיאת סינכרון', 'נכשל עדכון הזמנה בגליונות גוגל', 'warning');
          }
        } else if (change.type === 'removed') {
           await GasService.logBlackBox({
              operation: 'DELETE',
              collection: 'orders',
              path: `orders/${change.doc.id}`,
              oldValue: change.doc.data()
            });
        }
      }
    });

    // 2. Inventory Monitoring
    const unsubInventory = onSnapshot(collection(db, 'inventory'), async (snapshot) => {
       if (isInitialLoad.inventory) {
        setIsInitialLoad(prev => ({ ...prev, inventory: false }));
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type === 'added' || change.type === 'modified') {
          const item = { id: change.doc.id, ...change.doc.data() } as InventoryItem;
           try {
            setStatus('syncing');
            await GasService.syncInventory(item);
             await GasService.logBlackBox({
              operation: change.type.toUpperCase(),
              collection: 'inventory',
              path: `inventory/${change.doc.id}`,
              newValue: item
            });
            setLastSync(new Date());
            setStatus('connected');
          } catch (error) {
            console.error("Inventory Sync Error:", error);
            setStatus('disconnected');
            addToast('שגיאת סינכרון', 'נכשל עדכון מלאי בגליונות גוגל', 'warning');
          }
        }
      }
    });

    // 3. User Access/Onboarding Monitoring
    const unsubUsers = onSnapshot(collection(db, 'user_magic_pages'), async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          await GasService.logBlackBox({
            operation: 'CREATE',
            collection: 'users',
            path: `users/${change.doc.id}`,
            newValue: change.doc.data()
          });
        }
      });
    });

    return () => {
      unsubOrders();
      unsubInventory();
      unsubUsers();
    };
  };

  return (
    <SyncContext.Provider value={{ status, lastSync }}>
      {children}
    </SyncContext.Provider>
  );
};
