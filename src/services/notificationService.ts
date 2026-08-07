import OneSignal from 'react-onesignal';

const ONESIGNAL_APP_ID = "06fa3292-cfc4-42e4-a64a-d629e58ec9b3";

let isInitialized = false;

export const initOneSignal = async () => {
  // Disabled in V35 due to CSP violations until whitelisted
  return;
};

export const sendOrderNotification = async (_title: string, _message: string) => {
  // Disabled in V35 due to CSP violations until whitelisted
  return;
};
