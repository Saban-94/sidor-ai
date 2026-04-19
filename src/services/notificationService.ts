import OneSignal from 'react-onesignal';

const ONESIGNAL_APP_ID = "546472ac-f9ab-4c6c-beb2-e41c72af9849";

let isInitialized = false;

export const initOneSignal = async () => {
  if (isInitialized) return;
  
  // Guard against domain mismatch in development/preview environments
  const currentHost = window.location.hostname;
  const targetHost = "sidor-ai-xi.vercel.app";
  
  if (currentHost !== targetHost && currentHost !== "localhost" && !currentHost.includes("europe-west3.run.app")) {
    console.warn(`OneSignal initialization skipped: Current domain (${currentHost}) does not match configured domain (${targetHost}).`);
    return;
  }

  try {
    isInitialized = true;
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: 'OneSignalSDKWorker.js',
    });
    console.log("OneSignal Initialized");
  } catch (err: any) {
    const errorMessage = err?.message || "";
    
    if (errorMessage.includes("already initialized")) {
      return;
    }
    
    if (errorMessage.includes("Can only be used on")) {
      console.warn(`OneSignal: Domain mismatch. This App ID is restricted to ${targetHost}. Push subscription will not work on this domain (${currentHost}).`);
      isInitialized = true; // Mark as "done/failed" to prevent re-attempts
      return;
    }

    console.error("Error initializing OneSignal:", err);
    isInitialized = false;
  }
};

export const sendOrderNotification = async (title: string, message: string) => {
  // Use VITE_ prefix for client-accessible env variables in Vite
  const apiKey = (import.meta as any).env.VITE_ONESIGNAL_REST_API_KEY;

  if (!apiKey) {
    console.warn("OneSignal REST API Key missing (VITE_ONESIGNAL_REST_API_KEY)");
    return;
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["Subscribed Users"],
        headings: { en: title, he: title },
        contents: { en: message, he: message },
        priority: 10,
        // Sound configuration
        android_sound: "os_notification_fallback_default",
        ios_sound: "os_notification_fallback_default.wav",
      }),
    });
    
    const data = await response.json();
    if (data.errors) {
      console.error("OneSignal API errors:", data.errors);
    } else {
      console.log("OneSignal Notification sent successfully:", data);
    }
  } catch (error) {
    console.error("Error calling OneSignal API:", error);
  }
};
