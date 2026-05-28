import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { useUserContext } from '@/context/user-context';
import SafeScreen from '@/components/safe-screen';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function AdminStatsScreen({ user }: any) {
  const { user: contextUser } = useUserContext();
  const activeUser = user || contextUser;
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeUser || activeUser.role !== 'admin') return;
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/admin/stats`)
      .then(res => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [activeUser]);

  if (!activeUser || activeUser.role !== 'admin') return (
    <SafeScreen>
      <View style={styles.errorContainer}>
        <Ionicons name="lock-closed" size={56} color="#ef4444" />
        <Text style={styles.errorText}>Chỉ dành cho quản trị viên</Text>
      </View>
    </SafeScreen>
  );

  if (loading) return (
    <SafeScreen>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    </SafeScreen>
  );

  if (!stats) return (
    <SafeScreen>
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={56} color="#f59e0b" />
        <Text style={styles.errorText}>Không có dữ liệu</Text>
      </View>
    </SafeScreen>
  );

  return (
    <SafeScreen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>📊 Thống kê quản trị</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCardLarge}>
            <View style={styles.statIconContainer}>
              <Ionicons name="people" size={28} color="#fff" />
            </View>
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Người dùng</Text>
          </View>

          <View style={styles.statCardLarge}>
            <View style={styles.statIconContainer}>
              <Ionicons name="chatbubbles" size={28} color="#fff" />
            </View>
            <Text style={styles.statValue}>{stats.totalMessages}</Text>
            <Text style={styles.statLabel}>Tin nhắn</Text>
          </View>

          <View style={styles.statCardLarge}>
            <View style={styles.statIconContainer}>
              <Ionicons name="radio-button-on" size={28} color="#fff" />
            </View>
            <Text style={styles.statValue}>{stats.onlineNow}</Text>
            <Text style={styles.statLabel}>Đang online</Text>
          </View>

          <View style={styles.statCardLarge}>
            <View style={styles.statIconContainer}>
              <Ionicons name="people-circle" size={28} color="#fff" />
            </View>
            <Text style={styles.statValue}>{stats.totalGroups}</Text>
            <Text style={styles.statLabel}>Nhóm</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={24} color="#3b82f6" />
            <Text style={styles.infoText}>Thống kê được cập nhật theo thời gian thực</Text>
          </View>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  errorText: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 16,
    fontWeight: '600',
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  statCardLarge: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  statIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#dbeafe',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    color: '#0c4a6e',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
