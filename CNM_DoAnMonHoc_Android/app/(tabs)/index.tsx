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
  const privateCount = useMemo(() => groups.filter(g => !g.isPublic).length, [groups]);

  return (
    <SafeScreen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerSection}>
          <View>
            <Text style={styles.greeting}>Xin chào 👋</Text>
            <Text style={styles.userName}>{user?.displayName || 'Bạn'}</Text>
          </View>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-circle" size={48} color="#3b82f6" />
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#3b82f6" />
            <Text style={styles.statNumber}>{user?.friends?.length || 0}</Text>
            <Text style={styles.statLabel}>Bạn bè</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="lock-open" size={24} color="#10b981" />
            <Text style={styles.statNumber}>{publicCount}</Text>
            <Text style={styles.statLabel}>Công khai</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="lock-closed" size={24} color="#f59e0b" />
            <Text style={styles.statNumber}>{privateCount}</Text>
            <Text style={styles.statLabel}>Riêng tư</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>Thao tác nhanh</Text>
        </View>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(tabs)/chat')}
          activeOpacity={0.7}>
          <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Vào Chat</Text>
            <Text style={styles.actionDescription}>Nhắn tin với bạn bè</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#10b981' }]}
          onPress={() => router.push('/(tabs)/friends')}
          activeOpacity={0.7}>
          <Ionicons name="people" size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Bạn bè</Text>
            <Text style={styles.actionDescription}>Quản lý bạn bè của bạn</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#8b5cf6' }]}
          onPress={() => router.push('/(tabs)/explore')}
          activeOpacity={0.7}>
          <Ionicons name="compass" size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Khám phá</Text>
            <Text style={styles.actionDescription}>Tìm nhóm mới</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#f59e0b' }]}
          onPress={() => router.push('/social')}
          activeOpacity={0.7}>
          <Ionicons name="images" size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Social Feed</Text>
            <Text style={styles.actionDescription}>Bai viet va binh luan</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#14b8a6' }]}
          onPress={() => router.push('/stories')}
          activeOpacity={0.7}>
          <Ionicons name="albums" size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Stories</Text>
            <Text style={styles.actionDescription}>Xem va dang story</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#64748b' }]}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.7}>
          <Ionicons name="notifications" size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Thong bao</Text>
            <Text style={styles.actionDescription}>Cai dat push va lich su</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#0ea5e9' }]}
          onPress={() => router.push('/search')}
          activeOpacity={0.7}>
          <Ionicons name="search" size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Tim kiem toan cuc</Text>
            <Text style={styles.actionDescription}>User, nhom, bai viet</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Chatbot Section */}
        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>Hỗ trợ</Text>
        </View>
        <TouchableOpacity
          style={styles.chatbotCard}
          onPress={() => setShowChatbot(true)}
          activeOpacity={0.7}>
          <View style={styles.chatbotIcon}>
            <Ionicons name="help-circle" size={32} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.chatbotTitle}>Trợ lý Chatbot</Text>
            <Text style={styles.chatbotDescription}>Hỏi tôi bất cứ điều gì</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#6b7280" />
        </TouchableOpacity>

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
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  userName: {
    fontSize: 28,
    color: '#1e293b',
    fontWeight: '700',
    marginTop: 4,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
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
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  sectionTitle: {
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  actionCard: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    elevation: 3,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  actionDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '500',
  },
  chatbotCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  chatbotIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatbotTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  chatbotDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
});
