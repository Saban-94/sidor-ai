import OneSignal from 'react-onesignal';

const ONESIGNAL_APP_ID = "546472ac-f9ab-4c6c-beb2-e41c72af9849";
const GAS_URL = import.meta.env.VITE_GAS_URL;

let isInitialized = false;

export const initOneSignal = async () => {
  if (isInitialized) return;
  
  const currentHost = window.location.hostname;
  const isAllowedHost = 
    currentHost === "localhost" || 
    currentHost === "127.0.0.1" ||
    currentHost.includes("vercel.app") ||
    currentHost.includes("google.app");

  if (!isAllowedHost) {
    console.warn(`OneSignal initialization skipped: Domain ${currentHost} not configured.`);
    return;
  }

  try {
    isInitialized = true;
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: 'OneSignalSDKWorker.js',
    });
    console.log("OneSignal Initialized ✅");
  } catch (err: any) {
    if (err?.message?.includes("already initialized")) return;
    console.error("Error initializing OneSignal:", err);
    isInitialized = false;
  }
};

/**
 * שליחת התראה דרך הצינור המאובטח של Google Apps Script
 * פותר בעיות CORS ושומר על המפתח הסודי מוגן
 */
export const sendOrderNotification = async (title: string, message: string) => {
  if (!GAS_URL) {
    console.error("Missing VITE_GAS_URL for notifications");
    return;
  }

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors", // עוקף הגבלות דפדפן בשימוש מול GAS
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: 'sendNotification',
        title: title,
        message: message,
        appId: ONESIGNAL_APP_ID
      }),
    });

    console.log("Notification trigger sent to GAS pipeline 🚀");
  } catch (error) {
    console.error("Error triggering notification via GAS:", error);
  }
};
