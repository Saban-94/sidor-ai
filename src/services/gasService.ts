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
      if (!gasUrl || gasUrl === 'YOUR_GAS_URL_HERE' || !gasUrl.startsWith('http')) {
        console.warn("⚠️ VITE_GAS_URL is missing or invalid. Sync will attempt server bridge only.");
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

      console.log(`📤 [SabanOS_Sync] Forwarding ${action} via server bridge... | Attempt ${4 - retries}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s for bridge

      try {
        // Use the internal server proxy bridge to avoid client-side CORS failures
        // Increased timeout to 30s for heavy sync operations
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown Error');
          throw new Error(`Server Bridge Error: ${response.status} - ${errorText}`);
        }

        const responseText = await response.text();
        let resData;
        try {
          resData = JSON.parse(responseText);
        } catch (e) {
          resData = { info: responseText };
        }

        console.log(`✅ [SabanOS_Sync] Success: ${action}`);
        return { status: 'success', data: resData };
      } catch (bridgeError: any) {
        clearTimeout(timeoutId);
        console.warn(`⚠️ [SabanOS_Sync] Bridge failed for ${action}: ${bridgeError.message}. Trying direct fallback...`);
        
        // Fallback to direct fetch if proxy fails (emergency mode)
        if (gasUrl && gasUrl.startsWith('http')) {
          try {
            const directResponse = await fetch(gasUrl, {
              method: 'POST',
              mode: 'no-cors', // Opaque response
              headers: { 'Content-Type': 'text/plain' }, // Avoid preflight if possible
              body: JSON.stringify(payload)
            });
            console.log(`✅ [SabanOS_Sync] Success via direct fallback for ${action}`);
            return { status: 'success', info: 'Sent via direct fallback (opaque)' };
          } catch (directError: any) {
            console.error(`❌ [SabanOS_Sync] Direct fallback also failed:`, directError.message);
            throw directError;
          }
        } else {
          throw bridgeError;
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

  static async syncGeneric(collectionName: string, data: any, operation: 'CREATE' | 'UPDATE' | 'DELETE') {
    return this.push('syncGeneric', { 
      collectionName, 
      data, 
      operation,
      sheetName: `DB_${collectionName}` // Target sheet naming convention
    });
  }
}
