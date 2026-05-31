import { StyleSheet, View, TouchableOpacity, Text, ScrollView } from 'react-native';
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'expo-router';
import ChatbotPopup from '../chatbot';
import { API_BASE_URL } from '@/constants/api';
import { useUserContext } from '@/context/user-context';
import SafeScreen from '@/components/safe-screen';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useUserContext();
  const [showChatbot, setShowChatbot] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/groups/all`)
      .then(res => setGroups(res.data || []))
      .catch(() => setGroups([]));
  }, []);

  const publicCount = useMemo(() => groups.filter(g => g.isPublic).length, [groups]);

  return (
    <SafeScreen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Chào mừng trở lại, {user?.displayName || user?.username || 'Bạn'}</Text>
          <Text style={styles.heroSubtitle}>Kết nối, chia sẻ và làm việc hiệu quả hơn mỗi ngày.</Text>
        </View>

        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#ecfdf5' }]}>
              <Ionicons name="pulse" size={20} color="#10b981" />
            </View>
            <Text style={styles.statTitle}>Đang trực tuyến</Text>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>Tài khoản trên hệ thống</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#eef2ff' }]}>
              <Ionicons name="people-outline" size={20} color="#4f46e5" />
            </View>
            <Text style={styles.statTitle}>Danh bạ bạn bè</Text>
            <Text style={styles.statNumber}>{user?.friends?.length || 0}</Text>
            <Text style={styles.statLabel}>Đã kết nối</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#faf5ff' }]}>
              <Ionicons name="globe-outline" size={20} color="#9333ea" />
            </View>
            <Text style={styles.statTitle}>Khám phá cộng đồng</Text>
            <Text style={styles.statNumber}>{publicCount}</Text>
            <Text style={styles.statLabel}>Nhóm công khai</Text>
          </View>
        </View>

        <View style={styles.sectionGrid}>
          <TouchableOpacity style={styles.socialFeedCard} onPress={() => router.push('/social')} activeOpacity={0.75}>
            <View style={styles.centerIcon}>
              <Ionicons name="chatbox-outline" size={34} color="#94a3b8" />
            </View>
            <Text style={styles.socialFeedTitle}>Social Feed</Text>
            <Text style={styles.socialFeedDescription}>Xem bài viết, bình luận và chia sẻ mới nhất.</Text>
          </TouchableOpacity>

          <View style={styles.supportPanel}>
            <View style={styles.panelTitleRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#4f46e5" />
              <Text style={styles.panelTitle}>Hỗ trợ</Text>
            </View>

            <View style={styles.statusItem}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#10b981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>Mọi dịch vụ hoạt động ổn định</Text>
                <Text style={styles.statusText}>Server, Database và Socket đều sẵn sàng.</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.statusItem} onPress={() => setShowChatbot(true)} activeOpacity={0.75}>
              <Ionicons name="help-circle-outline" size={22} color="#6366f1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>Trợ lý Chatbot</Text>
                <Text style={styles.statusText}>Hỏi trợ lý khi bạn cần hỗ trợ nhanh.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>

        <ChatbotPopup visible={showChatbot} onClose={() => setShowChatbot(false)} />
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heroCard: {
    backgroundColor: '#7c3aed',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 26,
    marginTop: 8,
    marginBottom: 18,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    fontWeight: '600',
  },
  statsSection: {
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statTitle: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '700',
  },
  statNumber: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 14,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  sectionGrid: {
    gap: 14,
    paddingBottom: 28,
  },
  socialFeedCard: {
    minHeight: 190,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  centerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  socialFeedTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  socialFeedDescription: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  supportPanel: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  panelTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  statusTitle: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '800',
  },
  statusText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
