import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, TeamChatMessage, UserProfile, InventoryItem } from '../types';
import { GAS_URL } from '../config/constants';

/**
 * Service to handle synchronization between Firebase and Google Sheets (BlackBox)
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
    console.log('🔄 Initiating Real-Time Live Stream to Google Sheets...');

    // 1. Inventory Listener
    onSnapshot(collection(db, 'inventory'), (snapshot) => {
      if (this.isInitialLoad.inventory) {
        this.isInitialLoad.inventory = false;
        return;
      }
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          this.syncInventory(change.doc.data() as InventoryItem);
        }
        this.logBlackBox({
          operation: change.type.toUpperCase() as any,
          user: 'Firestore Listener',
          collection: 'inventory',
          newValue: change.doc.data(),
          path: `inventory/${change.doc.id}`,
          origin: change.type === 'modified' ? 'App' : 'Firestore'
        });
      });
    });

    // 2. Orders Listener
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

    // 3. Chat Listener (Last 10 messages only to track new additions)
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

    // 4. Magic Pages Listener
    onSnapshot(collection(db, 'user_magic_pages'), (snapshot) => {
      if (this.isInitialLoad.user_magic_pages) {
        this.isInitialLoad.user_magic_pages = false;
        return;
      }
      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified') {
          const data = change.doc.data() as UserProfile;
          this.logMagicAccess(change.doc.id, data.name, 'UPDATE');
        }
      });
    });

    // Start background re-sync
    setInterval(() => this.processQueue(), 30000);
  }

  private static async sendToGas(payload: any) {
    if (!GAS_URL) return;

    if (!navigator.onLine) {
      this.addToQueue(payload);
      return;
    }

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok && response.status !== 302) { // GAS redirects are ok
        throw new Error(`Sync failed: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      this.addToQueue(payload);
      console.error('Sync error (queued):', error);
      return false;
    }
  }

  private static addToQueue(payload: any) {
    this.queue.push({
      ...payload,
      timestamp: new Date().toISOString()
    });
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

  /**
   * Log critical state changes to the BlackBox sheet
   */
  static async logBlackBox(data: {
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'ADDED' | 'MODIFIED' | 'REMOVED';
    user: string;
    collection: string;
    oldValue?: any;
    newValue?: any;
    path: string;
    origin?: 'App' | 'Sheet' | 'Firestore';
  }) {
    return this.sendToGas({
      action: 'logBlackBox',
      origin: data.origin || 'App',
      ...data
    });
  }

  /**
   * Log Access to User Magic Pages
   */
  static async logMagicAccess(userId: string, userName: string, magicAction: 'ACCESS' | 'UPDATE' = 'ACCESS') {
    return this.sendToGas({
      action: 'logMagicAccess',
      userId,
      userName,
      magicAction
    });
  }

  /**
   * Sync Order status to the Order Tracking sheet
   */
  static async syncOrder(order: Order) {
    return this.sendToGas({
      action: 'syncOrder',
      orderId: order.id,
      trackingId: order.trackingId,
      customerName: order.customerName,
      status: order.status,
      items: order.items
    });
  }

  /**
   * Sync Inventory Stock
   */
  static async syncInventory(item: InventoryItem) {
    return this.sendToGas({
      action: 'syncInventory',
      sku: item.sku,
      name: item.name,
      currentStock: item.currentStock,
      minStock: item.minStock,
      unit: item.unit
    });
  }

  /**
   * Sync Chat message to history sheet
   */
  static async syncChat(message: TeamChatMessage) {
    return this.sendToGas({
      action: 'syncChat',
      sender: message.senderName,
      senderId: message.senderId,
      text: message.text,
      priority: message.priority,
      recipientId: message.recipientId || 'global'
    });
  }
}
