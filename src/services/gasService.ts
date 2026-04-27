import { GAS_URL } from '../config/constants';
import { auth } from '../lib/firebase';

export class GasService {
  /**
   * Universal forwarder to Google Apps Script with Firebase Auth protection
   */
  static async push(action: string, data: any) {
    if (!GAS_URL) {
      console.warn("⚠️ VITE_GAS_URL is missing. Sync disabled.");
      return false;
    }

    try {
      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : null;

      const payload = {
        action,
        timestamp: new Date().toISOString(),
        user: user?.email || 'anonymous',
        ...data
      };

      console.log(`📤 GAS [${action}]:`, payload);

      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'Authorization': idToken ? `Bearer ${idToken}` : ''
        },
        // We use text/plain to avoid CORS preflight if possible, 
        // but since we add Authorization header, a preflight WILL happen.
        // Therefore, we must ensure GAS handle OPTIONS.
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ GAS Response [${action}]:`, result);
      return result;
    } catch (error) {
      console.error(`❌ GAS Sync Failed [${action}]:`, error);
      throw error;
    }
  }

  static async logBlackBox(data: any) {
    return this.push('handleBlackBoxLog', data);
  }

  static async syncOrder(orderData: any) {
    return this.push('syncOrder', orderData);
  }

  static async syncInventory(inventoryData: any) {
    return this.push('syncInventory', inventoryData);
  }

  static async syncChat(chatData: any) {
    return this.push('syncChat', chatData);
  }
}
