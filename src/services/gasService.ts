import { auth } from '../lib/firebase';

export class GasService {
  /**
   * Universal forwarder to Google Apps Script with Firebase Auth protection
   * Added robust retry mechanism with exponential backoff for stabilization
   */
  static async push(action: string, data: any, retries = 4, delay = 1000): Promise<any> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      
      const idToken = await user.getIdToken(true);

      const payload = {
        action,
        timestamp: new Date().toISOString(),
        user: user.email || 'anonymous',
        uid: user.uid,
        idToken,
        ...data
      };

      let gasUrl = import.meta.env.VITE_GAS_URL;
      if (!gasUrl) {
         console.warn("VITE_GAS_URL is not defined. Synchronization skipped.");
         return { status: 'skipped', reason: 'no-url' };
      }

      // Cleanup URL (robust wrapping)
      gasUrl = gasUrl.trim().replace(/['"]+/g, '');

      console.log(`📤 Syncing to GAS [${action}] | Attempt ${5 - retries}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors', // Opaque response for GAS usually works best for CORS skipping
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log(`✅ Direct POST attempted to GAS [${action}] (Opaque Mode)`);
        return { status: 'success', mode: 'no-cors' };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      if (retries > 1) {
        console.warn(`⚠️ Proxy GAS Sync Failed [${action}]. Retrying in ${delay}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.push(action, data, retries - 1, delay * 1.5);
      }
      
      console.error(`❌ Final Proxy GAS Sync Failure [${action}]:`, error);
      // Trigger global event or return status for UI alert
      window.dispatchEvent(new CustomEvent('gas-sync-failed', { detail: { action } }));
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
