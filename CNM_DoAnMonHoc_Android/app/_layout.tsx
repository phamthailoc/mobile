import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import axios from 'axios';
import NotificationsService, { registerForPushNotificationsAsync, addNotificationResponseListener, canUseNativePushNotifications } from '@/services/notifications';
import AuthScreen from './auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { UserProvider } from '@/context/user-context';
import { bootstrapHttp } from '@/services/http';
import { clearSession, getSession } from '@/services/session-storage';
import { API_BASE_URL } from '@/constants/api';

bootstrapHttp();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync('#f8fafc');
  }, []);

  useEffect(() => {
    let isMounted = true;
    let responseSub: { remove: () => void } | null = null;

    (async () => {
      const session = await getSession();
      if (!isMounted) return;
      if (session?.token) {
        let sessionIsValid = false;
        try {
          const res = await axios.get(`${API_BASE_URL}/api/users/${session.username}`);
          if (!isMounted) return;
          setUser({ ...session, ...res.data } as any);
          sessionIsValid = true;
        } catch (error: any) {
          if (error?.response?.status === 401) {
            await clearSession();
          }
        }

        if (sessionIsValid && canUseNativePushNotifications()) {
          // Register push token with backend and attach listener for deep-links
          const token = await registerForPushNotificationsAsync();
          (NotificationsService as any)._lastToken = token;

          if (isMounted) {
            responseSub = await addNotificationResponseListener(response => {
              try {
                const data = response.notification.request.content.data || {};
                if (data.roomId) {
                  router.push({ pathname: '/chat', params: { roomId: data.roomId } } as any);
                } else if (data.screen) {
                  router.push(data.screen);
                }
              } catch (e) {
                console.warn('Notification response handler error', e);
              }
            });
          }
        }
      }
      setIsHydrating(false);
    })();

    return () => {
      isMounted = false;
      responseSub?.remove();
    };
  }, []);

  if (isHydrating) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} backgroundColor="#f8fafc" translucent={false} />
      </ThemeProvider>
    );
  }

  if (!user) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <UserProvider value={{ user, setUser }}>
          <AuthScreen setUser={setUser} />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} backgroundColor="#f8fafc" translucent={false} />
        </UserProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <UserProvider value={{ user, setUser }}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="social" options={{ title: 'Social', headerShown: true }} />
          <Stack.Screen name="stories" options={{ title: 'Stories', headerShown: true }} />
          <Stack.Screen name="notifications" options={{ title: 'Thong bao', headerShown: true }} />
          <Stack.Screen name="search" options={{ title: 'Tim kiem', headerShown: true }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} backgroundColor="#f8fafc" translucent={false} />
      </UserProvider>
    </ThemeProvider>
  );
}
