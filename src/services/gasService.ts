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
      
      const gasUrl = import.meta.env.VITE_GAS_URL;
      if (!gasUrl) {
        console.error("❌ VITE_GAS_URL is missing in environment");
        return { status: 'failed', error: 'Missing GAS URL' };
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

      console.log(`📤 [GAS_DIRECT] Syncing ${action} | Attempt ${4 - retries}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        console.log(`📤 [GAS_DIRECT] Attempting direct push for ${action}...`);
        const response = await fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors', 
          cache: 'no-cache',
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return { status: 'success', info: 'Sent via direct no-cors' };
      } catch (directError: any) {
        clearTimeout(timeoutId);
        console.warn(`⚠️ [GAS_DIRECT] failed for ${action}: ${directError.message}. Trying via proxy...`);
        
        // Fallback to local proxy
        try {
          const proxyResponse = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if (!proxyResponse.ok) throw new Error(`Proxy returned ${proxyResponse.status}`);
          const proxyData = await proxyResponse.json();
          return { status: 'success', info: 'Sent via proxy', data: proxyData };
        } catch (proxyError: any) {
          console.error(`❌ [GAS_PROXY] also failed for ${action}:`, proxyError.message);
          throw proxyError;
        }
      }
    } catch (error: any) {
      if (retries > 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.push(action, data, retries - 1, delay * 2);
      }
      
      console.error(`❌ GAS Direct Sync Failure [${action}]:`, error.message);
      return { status: 'failed', error: error.message };
    }
  }

  static async pull(action: string, criteria: any = {}): Promise<any> {
    try {
      const gasUrl = import.meta.env.VITE_GAS_URL;
      if (!gasUrl) throw new Error('Missing GAS URL');

      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken(true) : null;

      const payload = {
        action,
        method: 'PULL',
        timestamp: new Date().toISOString(),
        idToken,
        ...criteria
      };

      // Pull requires cors usually, so if GAS isn't configured for CORS this might fail
      // In this environment, we expect GAS to be set up to handle it or we use a proxy if needed
      // But user requested DIRECT, so let's try direct first.
      const response = await fetch(gasUrl, {
        method: 'POST',
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
    // Basic mapping for main Orders sheet
    const payload = { 
      ...orderData,
      sheetName: 'Orders' 
    };
    if (orderData.signature && !orderData.base64Data) {
      payload.base64Data = orderData.signature;
    }
    
    // Trigger tracking sync in parallel
    this.syncTracking(orderData);
    
    return this.push('syncOrder', payload);
  }

  static async syncTracking(orderData: any) {
    // Semantic Mapping as per V6.0 High-Efficiency Spec
    const driverMap: Record<string, string> = {
      'ali': 'עלי 🚛',
      'hikmat': 'חכמת 🏗️'
    };

    const mappedDriver = orderData.driverId ? (driverMap[orderData.driverId] || orderData.driverId) : '⏳ ממתין';
    
    const trackingPayload = {
      orderId: orderData.id || orderData.orderNumber,
      customerName: orderData.customerName || orderData.customer || 'לקוח מזדמן',
      status: orderData.status || 'pending',
      items: orderData.items || '',
      driverId: mappedDriver,
      updatedAt: new Date().toISOString(),
      sheetName: 'Order_Tracking'
    };

    return this.push('syncOrderTracking', trackingPayload);
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
