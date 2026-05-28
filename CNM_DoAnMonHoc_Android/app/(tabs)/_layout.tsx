import { Tabs } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import axios from 'axios';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { API_BASE_URL } from '@/constants/api';
import { useUserContext } from '@/context/user-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, setUser } = useUserContext();
  const [isBadgeBlinkOn, setIsBadgeBlinkOn] = useState(true);
  const prevRequestsRef = useRef<string[]>(user?.friendRequests || []);

  const pendingFriendRequests = useMemo(() => (user?.friendRequests || []).length, [user?.friendRequests]);

  useEffect(() => {
    if (!pendingFriendRequests) {
      setIsBadgeBlinkOn(true);
      return;
    }

    const blinkTimer = setInterval(() => {
      setIsBadgeBlinkOn(prev => !prev);
    }, 650);

    return () => clearInterval(blinkTimer);
  }, [pendingFriendRequests]);

  useEffect(() => {
    if (!user?.username) return;

    let isMounted = true;

    const syncFriendRequests = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/${user.username}`);
        if (!isMounted || !res.data) return;

        const latestRequests: string[] = res.data.friendRequests || [];
        const previousRequests = prevRequestsRef.current || [];
        const newlyReceived = latestRequests.filter(reqUser => !previousRequests.includes(reqUser));

        if (newlyReceived.length > 0) {
          alert(`Bạn đã nhận lời mời kết bạn từ: ${newlyReceived.join(', ')}`);
        }

        prevRequestsRef.current = latestRequests;
        setUser((prev: any) => ({ ...prev, ...res.data }));
      } catch {
        // Keep silent on polling errors to avoid interrupting UX.
      }
    };

    syncFriendRequests();
    const pollTimer = setInterval(syncFriendRequests, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
    };
  }, [user?.username, setUser]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#94a3b8',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Bạn bè',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrap}>
              <IconSymbol size={32} name="person.2.fill" color={color} />
              {pendingFriendRequests > 0 && (
                <View style={[styles.friendsBadge, { opacity: isBadgeBlinkOn ? 1 : 0.25 }]}>
                  <View style={styles.friendsBadgeDot} />
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Discovery',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="adminStats"
        options={{
          title: 'Thống kê',
          href: user?.role === 'admin' ? undefined : null,
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="person.crop.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Nhóm',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="person.3.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    position: 'relative',
  },
  friendsBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  friendsBadgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
});
