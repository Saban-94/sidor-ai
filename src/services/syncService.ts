import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, TeamChatMessage, UserProfile, InventoryItem } from '../types';
import { GAS_URL } from '../config/constants';

/**
 * SabanOS Sync Service - Strong Bidirectional Engine
 * Path: src/services/syncService.ts
 */
export class SyncService {
  private static queue: any[] = JSON.parse(localStorage.getItem('sync_queue') || '[]');
  private static isSyncing = false;
  private static isInitialLoad: Record<string, boolean> = {
    inventory: true,
    orders: true,
    office_messages: true,
    user_magic_pages: true
  };

  /**
   * Initialize Global Real-Time Listeners
   */
  static initListeners() {
    console.log('%c 🔄 SabanOS: Initiating Real-Time Live Stream...', 'color: #3b82f6; font-weight: bold');

    // 1. Inventory Listener - מול טאב Inventory_Stock
    onSnapshot(collection(db, 'inventory'), (snapshot) => {
      if (this.isInitialLoad.inventory) {
        this.isInitialLoad.inventory = false;
        return;
      }
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data() as InventoryItem;
        if (change.type === 'added' || change.type === 'modified') {
          this.syncInventory(data);
        }
        this.logBlackBox({
          operation: change.type.toUpperCase() as any,
          user: 'System Listener',
          collection: 'inventory',
          newValue: data,
          path: `inventory/${change.doc.id}`,
          origin: 'Firestore'
        });
      });
    });

    // 2. Orders Listener - מול טאב Order_Tracking
    onSnapshot(collection(db, 'orders'), (snapshot) => {
      if (this.isInitialLoad.orders) {
        this.isInitialLoad.orders = false;
        return;
      }
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          this.syncOrder({ id: change.doc.id, ...change.doc.data() } as Order);
        }
      });
    });

    // 3. Chat Listener - מול טאב James_Notebook_Log (ג'יימס מדווח)
    const chatQuery = query(collection(db, 'office_messages'), orderBy('timestamp', 'desc'), limit(10));
    onSnapshot(chatQuery, (snapshot) => {
      if (this.isInitialLoad.office_messages) {
        this.isInitialLoad.office_messages = false;
        return;
      }
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          this.syncChat(change.doc.data() as TeamChatMessage);
        }
      });
    });

    // Start background re-sync
    setInterval(() => this.processQueue(), 30000);
  }

  /**
   * הצינור המרכזי לגוגל - תיקון CORS ופורמט נתונים
   */
  private static async sendToGas(payload: any) {
    if (!GAS_URL) {
      console.warn('⚠️ SabanOS: GAS_URL is missing in configuration');
      return;
    }

    if (!navigator.onLine) {
      this.addToQueue(payload);
      return;
    }

    try {
      console.log(`%c 📤 Sending ${payload.action} to Google Sheets...`, 'color: #8b5cf6');
      
      // שימוש ב-no-cors וב-text/plain כדי לעבור את גוגל
      await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      
      console.log(`%c ✅ ${payload.action} Synced Successfully`, 'color: #10b981');
      return true;
    } catch (error) {
      this.addToQueue(payload);
      console.error('❌ Sync error (queued):', error);
      return false;
    }
  }

  private static addToQueue(payload: any) {
    this.queue.push({ ...payload, timestamp: new Date().toISOString() });
    localStorage.setItem('sync_queue', JSON.stringify(this.queue));
  }

  private static async processQueue() {
    if (this.isSyncing || this.queue.length === 0 || !navigator.onLine) return;
    this.isSyncing = true;
    const itemsToProcess = [...this.queue];
    this.queue = [];
    localStorage.setItem('sync_queue', JSON.stringify([]));

    for (const item of itemsToProcess) {
      await this.sendToGas(item);
    }
    this.isSyncing = false;
  }

  // --- פונקציות סנכרון ספציפיות ---

  static async logBlackBox(data: any) {
    return this.sendToGas({
      action: 'logBlackBox',
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  static async syncOrder(order: Order) {
    return this.sendToGas({
      action: 'syncOrder',
      orderId: order.id,
      customer: order.customerName,
      status: order.status,
      items: order.items ? JSON.stringify(order.items) : ""
    });
  }

  static async syncInventory(item: InventoryItem) {
    return this.sendToGas({
      action: 'syncInventory',
      sku: item.sku,
      name: item.name,
      currentStock: item.currentStock,
      minStock: item.minStock,
      category: item.category || 'כללי'
    });
  }

  static async syncChat(message: TeamChatMessage) {
    return this.sendToGas({
      action: 'generateAI', // הפעלה של ג'יימס בגיליון
      prompt: `${message.senderName}: ${message.text}`
    });
  }
}
