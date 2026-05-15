import OneSignal from 'react-onesignal';

const ONESIGNAL_APP_ID = "546472ac-f9ab-4c6c-beb2-e41c72af9849";

let isInitialized = false;

export const initOneSignal = async () => {
  // Disabled in V35 due to CSP violations until whitelisted
  return;
};

export const sendOrderNotification = async (_title: string, _message: string) => {
  // Disabled in V35 due to CSP violations until whitelisted
  return;
};
