import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Alert, ScrollView, RefreshControl } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { useUserContext } from '@/context/user-context';
import SafeScreen from '@/components/safe-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

type FriendItem = {
  username: string;
  displayName: string;
};

export default function FriendsScreen({ user }: any) {
  const router = useRouter();
  const { user: contextUser, setUser } = useUserContext();
  const activeUser = user || contextUser;
  const activeUsername = activeUser?.username;
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<string[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResult, setGlobalResult] = useState<FriendItem | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [friendTags, setFriendTags] = useState<Record<string, string>>({});
  const [availableTags] = useState<string[]>(['All', 'Gia đình', 'Công việc', 'Game', 'Quan trọng']);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeUsername) return;
    setLoading(true);
    setError(null);
    try {
      const meRes = await axios.get(`${API_BASE_URL}/api/users/${activeUsername}`);
      const me = meRes.data;
      const friendUsernames: string[] = me.friends || [];
      const requests: string[] = me.friendRequests || [];

      const friendDetails = await Promise.all(
        friendUsernames.map(async uname => {
          try {
            const r = await axios.get(`${API_BASE_URL}/api/users/${uname}`);
            return {
              username: uname,
              displayName: r.data?.displayName || uname,
            } as FriendItem;
          } catch {
            return { username: uname, displayName: uname } as FriendItem;
          }
        })
      );

      setFriends(friendDetails);
      setFriendRequests(requests);
      setUser((prev: any) => {
        if (!prev) return { ...me };
        const sameUser =
          prev.username === me.username &&
          prev.displayName === me.displayName &&
          prev.phone === me.phone &&
          prev.bio === me.bio &&
          prev.address === me.address &&
          prev.avatar === me.avatar &&
          JSON.stringify(prev.friends || []) === JSON.stringify(me.friends || []) &&
          JSON.stringify(prev.friendRequests || []) === JSON.stringify(me.friendRequests || []);
        return sameUser ? prev : { ...prev, ...me };
      });
    } catch (err: any) {
      console.error('Error loading friends:', err);
      setError('Không thể tải danh sách bạn bè');
    } finally {
      setLoading(false);
    }
  }, [activeUsername, setUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredFriends = useMemo(() => {
    let next = [...friends];
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      next = next.filter(f => f.displayName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q));
    }
    if (selectedTag !== 'All') {
      next = next.filter(f => friendTags[f.username] === selectedTag);
    }
    next.sort((a, b) => sortOrder === 'asc' ? a.displayName.localeCompare(b.displayName) : b.displayName.localeCompare(a.displayName));
    return next;
  }, [friends, localSearch, selectedTag, sortOrder, friendTags]);

  const searchGlobalUser = async () => {
    const q = globalSearch.trim();
    if (!q) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users/${q}`);
      if (res.data?.username) {
        setGlobalResult({ username: res.data.username, displayName: res.data.displayName || res.data.username });
      } else {
        setGlobalResult(null);
      }
    } catch {
      setGlobalResult(null);
      Alert.alert('Không tìm thấy', 'Không tồn tại username này');
    }
  };

  const sendFriendRequest = async () => {
    if (!globalResult || !activeUser) return;
    try {
      await axios.post(`${API_BASE_URL}/api/friends/request`, {
        fromUser: activeUser.username,
        toUser: globalResult.username,
      });
      Alert.alert('Thành công', 'Đã gửi lời mời kết bạn');
      setGlobalSearch('');
      setGlobalResult(null);
    } catch {
      Alert.alert('Lỗi', 'Không gửi được lời mời');
    }
  };

  const acceptRequest = async (fromUser: string) => {
    if (!activeUser) return;
    try {
      await axios.post(`${API_BASE_URL}/api/friends/accept`, { me: activeUser.username, friendUname: fromUser });
      await loadData();
    } catch {
      Alert.alert('Lỗi', 'Không thể chấp nhận lời mời');
    }
  };

  const unfriend = async (friendUname: string) => {
    if (!activeUser) return;
    try {
      await axios.post(`${API_BASE_URL}/api/friends/unfriend`, { me: activeUser.username, friendUname });
      await loadData();
    } catch {
      Alert.alert('Lỗi', 'Không thể hủy kết bạn');
    }
  };

  const confirmUnfriend = (friendUname: string, displayName: string) => {
    Alert.alert(
      'Xác nhận xóa bạn',
      `Bạn có chắc muốn xóa ${displayName} khỏi danh sách bạn bè không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa bạn',
          style: 'destructive',
          onPress: () => {
            void unfriend(friendUname);
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const assignTag = (username: string, tag: string) => {
    if (tag === 'All') return;
    setFriendTags(prev => ({ ...prev, [username]: tag }));
  };

  const startDirectChat = (friendUsername: string) => {
    if (!activeUsername) return;
    const roomId = `dm_${[activeUsername, friendUsername].sort().join('_')}`;
    router.push({
      pathname: '/chat',
      params: {
        roomId,
        roomName: friendUsername,
      },
    });
  };

  return (
    <SafeScreen>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Bạn bè</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{friends.length}</Text>
          </View>
        </View>

        <View style={styles.searchBlock}>
          <Ionicons name="search" size={20} color="#64748b" style={{ marginLeft: 12 }} />
          <TextInput
            placeholder="Thêm bạn mới..."
            placeholderTextColor="#cbd5e1"
            value={globalSearch}
            onChangeText={setGlobalSearch}
            style={styles.searchInput}
            onSubmitEditing={searchGlobalUser}
          />
        </View>

        {globalResult && (
          <View style={styles.resultCard}>
            <Ionicons name="person-circle" size={40} color="#3b82f6" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.resultName}>{globalResult.displayName}</Text>
              <Text style={styles.resultUser}>@{globalResult.username}</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={sendFriendRequest}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {!!friendRequests.length && (
          <View style={styles.requestPanel}>
            <View style={styles.panelHeader}>
              <Ionicons name="mail-unread" size={20} color="#f59e0b" />
              <Text style={styles.panelTitle}>Lời mời ({friendRequests.length})</Text>
            </View>
            {friendRequests.map(name => (
              <View key={name} style={styles.requestItem}>
                <Ionicons name="person" size={24} color="#3b82f6" />
                <Text style={styles.requestText}>@{name}</Text>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(name)}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.filterRow}>
          <View style={styles.searchInputSmall}>
            <Ionicons name="funnel" size={18} color="#64748b" />
            <TextInput
              placeholder="Lọc..."
              placeholderTextColor="#cbd5e1"
              value={localSearch}
              onChangeText={setLocalSearch}
              style={styles.filterInput}
            />
          </View>
          <TouchableOpacity style={styles.sortBtn} onPress={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}>
            <Ionicons name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={18} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroller}>
          {availableTags.map(tag => (
            <TouchableOpacity key={tag} style={[styles.tagChip, selectedTag === tag && styles.tagChipActive]} onPress={() => setSelectedTag(tag)}>
              <Text style={[styles.tagChipText, selectedTag === tag && styles.tagChipTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
            data={filteredFriends}
            keyExtractor={item => item.username}
            contentContainerStyle={{ paddingBottom: 26 }}
            ListEmptyComponent={<Text style={styles.emptyText}>Chưa có bạn bè</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={styles.friendCard}>
                <Ionicons name="person-circle" size={40} color="#3b82f6" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{item.displayName}</Text>
                  <Text style={styles.username}>@{item.username}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    {availableTags.filter(t => t !== 'All').map(tag => (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.friendTagChip, friendTags[item.username] === tag && styles.friendTagChipActive]}
                        onPress={() => assignTag(item.username, tag)}>
                        <Text style={[styles.friendTagText, friendTags[item.username] === tag && styles.friendTagTextActive]}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.friendActions}>
                  <TouchableOpacity style={styles.chatBtn} onPress={() => startDirectChat(item.username)}>
                    <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => confirmUnfriend(item.username, item.displayName)}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  header: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  badge: { backgroundColor: '#3b82f6', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  searchBlock: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  searchInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, color: '#1e293b', fontSize: 16 },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  resultName: { color: '#1e293b', fontWeight: '700', fontSize: 16 },
  resultUser: { color: '#64748b', marginTop: 2, fontSize: 13, fontWeight: '500' },
  addBtn: { 
    backgroundColor: '#10b981',
    borderRadius: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestPanel: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  panelTitle: { color: '#1e293b', fontWeight: '700', fontSize: 15 },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  requestText: { color: '#1e293b', fontWeight: '600', flex: 1, fontSize: 14 },
  acceptBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  searchInputSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterInput: { flex: 1, paddingVertical: 10, color: '#1e293b', marginLeft: 8 },
  sortBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tagScroller: { marginBottom: 12, maxHeight: 40 },
  tagChip: {
    backgroundColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  tagChipActive: { backgroundColor: '#3b82f6' },
  tagChipText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  tagChipTextActive: { color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: 16, marginTop: 32, fontWeight: '500' },
  friendCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  name: { color: '#1e293b', fontWeight: '700', fontSize: 15 },
  username: { color: '#64748b', fontSize: 13, marginTop: 2, fontWeight: '500' },
  friendTagChip: { backgroundColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  friendTagChipActive: { backgroundColor: '#3b82f6' },
  friendTagText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  friendTagTextActive: { color: '#fff' },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
});
