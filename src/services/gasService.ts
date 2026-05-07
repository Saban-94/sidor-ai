import { auth } from '../lib/firebase';

export class GasService {
  /**
   * Universal forwarder to Google Apps Script with Firebase Auth protection
   */
  static async push(action: string, data: any, retry = true): Promise<any> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      
      // Ensure we have a fresh token
      const idToken = await user.getIdToken(true);

      const payload = {
        action,
        timestamp: new Date().toISOString(),
        user: user.email || 'anonymous',
        uid: user.uid,
        idToken,
        ...data
      };

      console.log(`📤 Syncing to GAS [${action}] at URL: ${import.meta.env.VITE_GAS_URL}`);

      const response = await fetch(import.meta.env.VITE_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      console.log(`✅ Direct POST attempted to GAS [${action}] (Opaque Mode)`);
      return { status: 'success', mode: 'no-cors' };
    } catch (error: any) {
      console.warn(`⚠️ Proxy GAS Sync Warning [${action}]:`, error);
      // Don't throw for best-effort sync actions to avoid UI disruption
      return { status: 'failed', error: error.message };
    }
  }

  static async logBlackBox(data: any) {
    return this.push('handleBlackBoxLog', { ...data, sheetName: 'Logs' });
  }

  static async syncOrder(orderData: any) {
    // Also sync to tracking sheet
    this.syncTracking(orderData);

    const payload = { 
      ...orderData,
      sheetName: 'Orders' // Main storage
    };
    if (orderData.signature && !orderData.base64Data) {
      payload.base64Data = orderData.signature;
    }
    return this.push('syncOrder', payload);
  }

  static async syncTracking(orderData: any) {
    return this.push('syncOrderTracking', { 
      ...orderData, 
      sheetName: 'Order_Tracking',
      updatedAt: new Date().toISOString()
    });
  }

  static async syncInventory(inventoryData: any) {
    return this.push('syncInventory', { ...inventoryData, sheetName: 'Inventory' });
  }

  static async syncCustomer(customerData: any) {
    return this.push('syncCustomer', { ...customerData, sheetName: 'Customers' });
  }

  static async syncChat(chatData: any) {
    return this.push('syncChat', { ...chatData, sheetName: 'Chat' });
  }

  static async syncWhatsApp(data: any) {
    return this.push('syncWhatsApp', { ...data, sheetName: 'whatsap' });
  }
}
