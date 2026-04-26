import OneSignal from 'react-onesignal';

const ONESIGNAL_APP_ID = "546472ac-f9ab-4c6c-beb2-e41c72af9849";
const INCOMING_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'; // Standard WhatsApp-style chime

class NotificationManager {
  private static instance: NotificationManager;
  private audio: HTMLAudioElement | null = null;
  private isInitialized = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio(INCOMING_SOUND_URL);
      this.audio.load();
    }
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  public async initOneSignal() {
    if (this.isInitialized) return;
    
    const currentHost = window.location.hostname;
    const isAllowedHost = 
      currentHost === "localhost" || 
      currentHost === "127.0.0.1" ||
      currentHost.includes("europe-west3.run.app") ||
      currentHost.includes("vercel.app");

    if (!isAllowedHost) return;

    try {
      this.isInitialized = true;
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: 'OneSignalSDKWorker.js',
      });
    } catch (err) {
      console.error("OneSignal Init Error:", err);
    }
  }

  public playIncomingSound() {
    if (this.audio) {
      this.audio.currentTime = 0;
      this.audio.play().catch(e => console.log('Audio playback blocked by browser policies until user interact.'));
    }
  }

  public async requestBrowserPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  public showBrowserNotification(title: string, body: string, icon?: string) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const n = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico'
    });

    n.onclick = () => {
      window.focus();
      n.close();
    };
  }

  public updateTabBadge(count: number) {
    if (count > 0) {
      document.title = `(${count}) SabanOS | Smart Chat`;
    } else {
      document.title = `SabanOS | Smart Chat`;
    }
  }
}

export const notificationService = NotificationManager.getInstance();

export const initOneSignal = () => notificationService.initOneSignal();

export const sendOrderNotification = async (title: string, message: string) => {
  const apiKey = (import.meta as any).env.VITE_ONESIGNAL_REST_API_KEY;
  if (!apiKey) return;

  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
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
      }),
    });
  } catch (error) {
    console.error("OneSignal API Error:", error);
  }
};
