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
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload),
      });

      // Note: With no-cors, we can't read the response body or status.
      // We assume it worked if the browser doesn't throw.
      console.log(`✅ Direct POST attempted to GAS [${action}]`);
      return { status: 'success', mode: 'no-cors' };
    } catch (error: any) {
      console.error(`❌ Proxy GAS Sync Failed [${action}]:`, error);
      // Construct a better error message for the UI
      const errorMessage = error.message || 'Unknown network error';
      throw new Error(`סנכרון נכשל: ${errorMessage}`);
    }
  }

  static async logBlackBox(data: any) {
    return this.push('handleBlackBoxLog', { ...data, sheetName: 'Logs' });
  }

  static async syncOrder(orderData: any) {
    // If there's a signature, GAS often expects it as 'base64Data' at top level
    const payload = { 
      ...orderData,
      sheetName: 'Orders' // Ensure GAS knows which sheet to target
    };
    if (orderData.signature && !orderData.base64Data) {
      payload.base64Data = orderData.signature;
    }
    return this.push('syncOrder', payload);
  }

  static async syncInventory(inventoryData: any) {
    return this.push('syncInventory', { ...inventoryData, sheetName: 'Inventory' });
  }

  static async syncChat(chatData: any) {
    return this.push('syncChat', { ...chatData, sheetName: 'Chat' });
  }
}
