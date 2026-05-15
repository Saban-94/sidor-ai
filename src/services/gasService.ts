import { auth, getCachedIdentity } from '../lib/firebase';

export class GasService {
  /**
   * Universal forwarder to Google Apps Script with Firebase Auth protection
   * Added robust retry mechanism with exponential backoff for stabilization
   */
  static async push(action: string, data: any, retries = 3, delay = 1000): Promise<any> {
    try {
      const user = auth.currentUser;
      const cached = !user ? getCachedIdentity() : null;
      
      // Filter logs to save quota
      if (action === 'handleBlackBoxLog' && (!data.critical && !data.error)) {
        return { status: 'skipped' }; // Skip non-essential logs
      }

      let idToken = null;
      if (user) {
        idToken = await user.getIdToken(true).catch(() => null);
      }

      const payload = {
        action,
        method: 'PUSH',
        timestamp: new Date().toISOString(),
        user: user?.email || cached?.email || 'anonymous',
        uid: user?.uid || cached?.uid || 'offline',
        idToken,
        ...data
      };

      // V35 Verified Endpoint with local proxy fallback
      const primaryProxy = '/api/sync';
      const secondaryProxy = 'https://sidor-ai-xi.vercel.app/api/sync'; // Vercel verification layer
      
      const targetUrl = retries < 2 ? secondaryProxy : primaryProxy;

      console.log(`📤 Syncing to GAS [${action}] via ${targetUrl === primaryProxy ? 'Local' : 'Vercel'} Proxy | Attempt ${4 - retries}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // Tighten timeout

      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        if (response.status === 404) {
          console.warn(`🛑 End point 404 for [${action}]. Switching proxy.`);
          if (targetUrl === primaryProxy) {
            return this.push(action, data, retries - 1, 500); // Immediate retry with secondary
          }
          throw new Error('All proxies returned 404');
        }

        if (!response.ok) throw new Error(`Proxy returned status ${response.status}`);

        clearTimeout(timeoutId);
        return await response.json();
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      // Logic for infinite loop prevention: 
      // If we've switched proxies and still fail, or hit certain error codes, stop.
      if (retries > 1 && !error.message?.includes('404')) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.push(action, data, retries - 1, delay * 2);
      }
      
      console.error(`❌ Final Proxy GAS Sync Failure [${action}]:`, error.message);
      window.dispatchEvent(new CustomEvent('gas-sync-failed', { detail: { action } }));
      return { status: 'failed', error: error.message };
    }
  }

  static async pull(action: string, criteria: any = {}): Promise<any> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      
      const idToken = await user.getIdToken(true);

      const payload = {
        action,
        method: 'PULL',
        timestamp: new Date().toISOString(),
        idToken,
        ...criteria
      };

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error('Pull failed');
      return await response.json();
    } catch (err) {
      console.error(`❌ GAS Pull Failure [${action}]:`, err);
      return null;
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
