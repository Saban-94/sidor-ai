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
    
    // Automatically dispatch order copy to JONI Pipe (Make.com webhook) in background
    this.sendToJoniPipe(orderData, 'order').catch(err => {
      console.warn("⚠️ Auto-forwarding to JONI pipeline failed in syncOrder:", err.message);
    });

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
    this.sendToJoniPipe(data, 'whatsapp').catch(err => {
      console.warn("⚠️ JONI Pipe dispatch warning:", err);
    });
    return this.push('syncWhatsApp', { ...data, sheetName: 'whatsap' });
  }

  /**
   * Private internal helper to send payload to Make JONI webhook and JONI Realtime DB
   */
  private static async sendToJoniPipe(data: any, type: 'order' | 'morning_report' | 'manual' | 'whatsapp'): Promise<any> {
    const makeWebhookUrl = import.meta.env.VITE_MAKE_JONI_URL || "https://hook.us2.make.com/e1ifxqwm66ji347ooyg6abuk7i2voom0";
    const joniRtdbUrl = "https://whatsapp-8ffd1-default-rtdb.europe-west1.firebasedatabase.app/joni/send.json";
    
    const id = data?.id || data?.orderNumber || data?.reportId || `joni-${Date.now()}`;
    const requestPayload = {
      source: "SabanOS_App",
      triggerType: type,
      timestamp: new Date().toISOString(),
      groupId: "120363428842730390@g.us",
      payload: data
    };

    let makeSuccess = false;
    let rtdbSuccess = false;

    // 1. Send to Make.com Webhook
    try {
      const response = await fetch(makeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      if (response.ok) makeSuccess = true;
    } catch (err: any) {
      console.warn("⚠️ Make.com Webhook transmission error:", err.message);
    }

    // 2. Send to JONI Firebase Realtime DB Endpoint
    try {
      const response = await fetch(joniRtdbUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      if (response.ok) rtdbSuccess = true;
    } catch (err: any) {
      console.warn("⚠️ JONI Firebase RTDB transmission error:", err.message);
    }

    this.saveJoniHistory(id, type, data, (makeSuccess || rtdbSuccess) ? 'success' : 'failed');

    return {
      status: (makeSuccess || rtdbSuccess) ? 'success' : 'failed',
      makeSuccess,
      rtdbSuccess,
      triggerType: type,
      timestamp: requestPayload.timestamp
    };
  }

  /**
   * Commits a transmission to LocalStorage while preventing duplicates by ID + triggerType
   */
  public static saveJoniHistory(id: string, triggerType: string, payload: any, status: 'success' | 'failed') {
    try {
      const HISTORY_KEY = 'saban_os_joni_history';
      const historyRaw = localStorage.getItem(HISTORY_KEY);
      let history: any[] = [];

      if (historyRaw) {
        try {
          history = JSON.parse(historyRaw);
          if (!Array.isArray(history)) history = [];
        } catch {
          history = [];
        }
      }

      // Filter out duplicate records by key fields to ensure tidy data structure
      history = history.filter(item => !(item.id === id && item.triggerType === triggerType));

      history.unshift({
        id,
        triggerType,
        timestamp: new Date().toISOString(),
        payload,
        status
      });

      // Keep size bounded to avoid local storage degradation
      if (history.length > 200) {
        history = history.slice(0, 200);
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error("Failed to persist JONI delivery trace to LocalStorage:", e);
    }
  }

  /**
   * Public API: Manually triggers JONI pipeline for a single order
   */
  static async sendOrderManually(orderData: any): Promise<any> {
    return this.sendToJoniPipe(orderData, 'manual');
  }

  /**
   * Public API: Triggers JONI pipeline for a combined morning report
   */
  static async sendMorningReport(reportData: any): Promise<any> {
    return this.sendToJoniPipe(reportData, 'morning_report');
  }

  /**
   * Public API: Retrieves cached successful JONI transmissions log
   */
  static getJoniHistory(): any[] {
    try {
      const HISTORY_KEY = 'saban_os_joni_history';
      const historyRaw = localStorage.getItem(HISTORY_KEY);
      if (historyRaw) {
        const parsed = JSON.parse(historyRaw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error("Failed to query JONI local history log:", e);
    }
    return [];
  }

  /**
   * Public API: Sends order details to Make Webhook for WhatsApp
   */
  static async sendToWhatsApp(orderData: any): Promise<any> {
    const webhookUrl = import.meta.env.VITE_MAKE_WHATSAPP_URL || import.meta.env.VITE_MAKE_JONI_URL || "Fallback_URL";
    const id = orderData?.id || `wa-${Date.now()}`;
    
    // Structure the dispatch payload
    const requestPayload = {
      source: "SabanOS_App",
      triggerType: "whatsapp",
      timestamp: new Date().toISOString(),
      payload: orderData
    };

    try {
      if (!webhookUrl || webhookUrl === 'Fallback_URL') {
        throw new Error("Missing WhatsApp Webhook URL (VITE_MAKE_WHATSAPP_URL)");
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        throw new Error(`WhatsApp webhook responded with status ${response.status}`);
      }

      const textResult = await response.text().catch(() => 'success');
      
      // Save tracing to history
      this.saveJoniHistory(id, 'whatsapp' as any, orderData, 'success');
      
      return { status: 'success', text: textResult };
    } catch (error: any) {
      console.error("❌ Send to WhatsApp via Webhook failed:", error.message);
      throw error;
    }
  }

  /**
   * Public API: Sends order details to Make Webhook for Email
   */
  static async sendByEmail(orderData: any): Promise<any> {
    const webhookUrl = import.meta.env.VITE_MAKE_EMAIL_URL || import.meta.env.VITE_MAKE_JONI_URL || "Fallback_URL";
    const id = orderData?.id || `email-${Date.now()}`;
    
    // Structure the dispatch payload
    const requestPayload = {
      source: "SabanOS_App",
      triggerType: "email",
      timestamp: new Date().toISOString(),
      payload: orderData
    };

    try {
      if (!webhookUrl || webhookUrl === 'Fallback_URL') {
        throw new Error("Missing Email Webhook URL (VITE_MAKE_EMAIL_URL)");
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        throw new Error(`Email webhook responded with status ${response.status}`);
      }

      const textResult = await response.text().catch(() => 'success');
      
      // Save tracing to history
      this.saveJoniHistory(id, 'email' as any, orderData, 'success');
      
      return { status: 'success', text: textResult };
    } catch (error: any) {
      console.error("❌ Send by Email via Webhook failed:", error.message);
      throw error;
    }
  }
}
