import { GAS_URL } from '../config/constants';
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

      console.log(`📤 Proxying GAS [${action}]:`, payload);

      const response = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 403 && retry) {
        console.warn('⚠️ GAS 403: Retrying with forced token refresh...');
        return this.push(action, data, false);
      }

      if (!response.ok) {
        throw new Error(`Proxy error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ Proxy GAS Response [${action}]:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Proxy GAS Sync Failed [${action}]:`, error);
      throw error;
    }
  }

  static async logBlackBox(data: any) {
    return this.push('handleBlackBoxLog', data);
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
    return this.push('syncChat', chatData);
  }
}
