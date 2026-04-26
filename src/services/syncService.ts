import { Order, TeamChatMessage, UserProfile } from '../types';

const GAS_URL = import.meta.env.VITE_GAS_URL;

/**
 * Service to handle synchronization between Firebase and Google Sheets (BlackBox)
 */
export class SyncService {
  
  private static async sendToGas(payload: any) {
    if (!GAS_URL) {
      console.warn('VITE_GAS_URL is not set. Sync to Google Sheets skipped.');
      return;
    }

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Using text/plain to avoid CORS preflight issues with GAS
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Sync error:', error);
    }
  }

  /**
   * Log critical state changes to the BlackBox sheet
   */
  static async logBlackBox(data: {
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    user: string;
    collection: string;
    oldValue?: any;
    newValue?: any;
    path: string;
  }) {
    return this.sendToGas({
      action: 'logBlackBox',
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
   * Sync Chat message to history sheet
   */
  static async syncChat(message: TeamChatMessage) {
    return this.sendToGas({
      action: 'syncChat',
      sender: message.senderName,
      senderId: message.senderId,
      text: message.text,
      priority: message.priority
    });
  }
}
