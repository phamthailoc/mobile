import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';

type NotificationResponse = import('expo-notifications').NotificationResponse;
type Notification = import('expo-notifications').Notification;

let notificationsModulePromise: Promise<typeof import('expo-notifications')> | null = null;
let notificationHandlerConfigured = false;

function isExpoGoAndroid() {
  const isExpoGo = Constants.appOwnership === 'expo' || (Constants as any).executionEnvironment === 'storeClient';
  return Platform.OS === 'android' && isExpoGo;
}

export function canUseNativePushNotifications() {
  return !isExpoGoAndroid() && Device.isDevice;
}

async function loadNotificationsModule() {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications');
  }

  const Notifications = await notificationsModulePromise;

  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    notificationHandlerConfigured = true;
  }

  return Notifications;
}

export async function registerForPushNotificationsAsync() {
  try {
    // Avoid running push registration inside Expo Go on Android (not supported)
    if (!canUseNativePushNotifications()) {
      console.warn('[Notifications] Skipping push registration inside Expo Go on Android');
      return null;
    }

    const Notifications = await loadNotificationsModule();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted');
      return null;
    }

    // Try to get device token (on Android this should be FCM token)
    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const token = tokenResponse?.data || tokenResponse?.token || null;

    if (!token) {
      console.warn('[Notifications] No device push token returned');
      return null;
    }

    // Send token to backend (requires Authorization header via bootstrapHttp interceptor)
    try {
      await axios.post(`${API_BASE_URL}/api/notifications/token`, { token });
      console.log('[Notifications] Token registered with backend');
    } catch (err) {
      console.warn('[Notifications] Failed to register token with backend', err?.message || err);
    }

    return token;
  } catch (err) {
    console.error('[Notifications] register error', err);
    return null;
  }
}

export async function addNotificationResponseListener(handler: (response: NotificationResponse) => void) {
  if (!canUseNativePushNotifications()) return null;
  const Notifications = await loadNotificationsModule();
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export async function addNotificationReceivedListener(handler: (notification: Notification) => void) {
  if (!canUseNativePushNotifications()) return null;
  const Notifications = await loadNotificationsModule();
  return Notifications.addNotificationReceivedListener(handler);
}

export async function removePushTokenOnLogout(token: string | null) {
  if (!token) return;
  try {
    await axios.delete(`${API_BASE_URL}/api/notifications/token`, { data: { token } });
    console.log('[Notifications] Token removed from backend');
  } catch (err) {
    console.warn('[Notifications] Failed to remove token on logout', err?.message || err);
  }
}

export default {
  registerForPushNotificationsAsync,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  removePushTokenOnLogout,
};
