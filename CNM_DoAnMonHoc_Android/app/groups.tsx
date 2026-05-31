import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import SafeScreen from '@/components/safe-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useUserContext } from '@/context/user-context';
import { useRouter } from 'expo-router';

type GroupItem = {
  groupId?: string;
  id?: string;
  groupName?: string;
  owner?: string;
  isPublic?: boolean;
};

export default function GroupsScreen({ user }: any) {
  const router = useRouter();
  const { user: contextUser } = useUserContext();
  const activeUser = user || contextUser;
  const activeUsername = activeUser?.username;
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const loadGroups = async () => {
    if (!activeUsername) return;
    try {
      setError(null);
      const res = await axios.get(`${API_BASE_URL}/api/groups/all`);
      setGroups(res.data || []);
    } catch (err: any) {
      console.error('Error loading groups:', err);
      setError('Không thể tải danh sách nhóm');
      setGroups([]);
    }
  };

  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên kênh');
      return;
    }
    if (!activeUsername) return;

    try {
      const res = await axios.post(`${API_BASE_URL}/api/groups/create`, {
        groupName: name,
        owner: activeUsername,
        isPublic: activeUser?.role === 'admin' ? isPublic : false,
      });

      const createdGroup = res.data;

      setGroupName('');
      setIsPublic(false);
      setShowCreateModal(false);
      await loadGroups();

      if (createdGroup?.groupId) {
        router.push({
          pathname: '/chat',
          params: {
            roomId: createdGroup.groupId,
            roomName: createdGroup.groupName || name,
          },
        });
      }
    } catch (err) {
      console.error('Error creating group:', err);
      Alert.alert('Lỗi', 'Không thể tạo kênh');
    }
  };

  useEffect(() => {
    setLoading(true);
    loadGroups().finally(() => setLoading(false));
  }, [activeUsername]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  const openGroupChat = (group: GroupItem) => {
    const roomId = group.groupId || group.id;
    if (!roomId) return;

    router.push({
      pathname: '/chat',
      params: {
        roomId,
        roomName: group.groupName || roomId,
      },
    });
  };

  return (
    <SafeScreen>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Nhóm của bạn</Text>
          <View style={styles.headerActions}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{groups.length}</Text>
            </View>
            <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={item => item.groupId || item.id || Math.random().toString()}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListEmptyComponent={<Text style={styles.emptyText}>Chưa có nhóm nào</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.groupCard} activeOpacity={0.85} onPress={() => openGroupChat(item)}>
                <Ionicons name="people" size={36} color="#3b82f6" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.groupTitleRow}>
                    <Text style={styles.name}>{item.groupName}</Text>
                    <View style={[styles.visibilityBadge, item.isPublic ? styles.visibilityBadgePublic : styles.visibilityBadgePrivate]}>
                      <Text style={styles.visibilityBadgeText}>{item.isPublic ? 'Công khai' : 'Riêng tư'}</Text>
                    </View>
                  </View>
                  <Text style={styles.owner}>Chủ nhóm: {item.owner || 'N/A'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo kênh mới</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Nhập tên kênh..."
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />

            <View style={styles.permissionBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionTitle}>Kênh công khai</Text>
                <Text style={styles.permissionDesc}>
                  {activeUser?.role === 'admin'
                    ? 'Admin có thể tạo kênh công khai.'
                    : 'Tài khoản thường chỉ có thể tạo kênh riêng tư.'}
                </Text>
              </View>
              <TouchableOpacity
                disabled={activeUser?.role !== 'admin'}
                onPress={() => setIsPublic(prev => !prev)}
                style={[styles.switchPill, isPublic ? styles.switchPillActive : styles.switchPillInactive, activeUser?.role !== 'admin' && styles.switchPillDisabled]}>
                <Text style={[styles.switchText, isPublic && styles.switchTextActive]}>
                  {isPublic ? 'Công khai' : 'Riêng tư'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={createGroup}>
              <Ionicons name="people" size={18} color="#fff" />
              <Text style={styles.submitText}>Tạo kênh</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  header: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  badge: { backgroundColor: '#3b82f6', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  createBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: 16, marginTop: 32, fontWeight: '500' },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    flex: 1,
    color: '#991b1b',
    fontWeight: '600',
    fontSize: 14,
  },
  retryBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  owner: { fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: '500' },
  visibilityBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  visibilityBadgePublic: { backgroundColor: '#dcfce7' },
  visibilityBadgePrivate: { backgroundColor: '#fef3c7' },
  visibilityBadgeText: { fontSize: 10, fontWeight: '800', color: '#334155' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#1e293b', fontSize: 20, fontWeight: '800' },
  input: { backgroundColor: '#f1f5f9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#1e293b', fontSize: 15 },
  permissionBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', borderRadius: 14, padding: 14 },
  permissionTitle: { color: '#1e293b', fontWeight: '700', fontSize: 14 },
  permissionDesc: { color: '#64748b', fontSize: 12, marginTop: 4, lineHeight: 18 },
  switchPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  switchPillActive: { backgroundColor: '#10b981' },
  switchPillInactive: { backgroundColor: '#e2e8f0' },
  switchPillDisabled: { opacity: 0.55 },
  switchText: { fontWeight: '800', fontSize: 12, color: '#475569' },
  switchTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#3b82f6', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
