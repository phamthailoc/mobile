import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import axios from 'axios';
import SafeScreen from '@/components/safe-screen';
import { API_BASE_URL } from '@/constants/api';
import { useUserContext } from '@/context/user-context';
import Ionicons from '@expo/vector-icons/Ionicons';

type GroupItem = {
  groupId: string;
  groupName: string;
  owner: string;
  isPublic: boolean;
  members?: string[];
  pendingRequests?: string[];
};

export default function ExploreScreen() {
  const { user } = useUserContext();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'private' | 'joined'>('all');

  const loadGroups = () => {
    axios
      .get(`${API_BASE_URL}/api/groups/all`)
      .then(res => setGroups(res.data || []))
      .catch(() => setGroups([]));
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const filtered = useMemo(() => {
    return groups.filter(g => {
      const q = search.trim().toLowerCase();
      const matches = !q || g.groupName.toLowerCase().includes(q) || g.owner.toLowerCase().includes(q);
      if (!matches) return false;
      const joined = g.owner === user?.username || g.members?.includes(user?.username);
      if (filter === 'public') return g.isPublic;
      if (filter === 'private') return !g.isPublic;
      if (filter === 'joined') return !!joined;
      return true;
    });
  }, [groups, search, filter, user?.username]);

  const requestJoin = async (groupId: string) => {
    await axios.post(`${API_BASE_URL}/api/groups/request`, { groupId, username: user?.username });
    loadGroups();
  };

  return (
    <SafeScreen>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Khám phá</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{filtered.length}</Text>
          </View>
        </View>

        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color="#64748b" style={{ marginLeft: 12 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm nhóm..."
            placeholderTextColor="#cbd5e1"
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {(['all', 'public', 'private', 'joined'] as const).map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'Tất cả' : f === 'public' ? 'Công khai' : f === 'private' ? 'Riêng tư' : 'Đã tham gia'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <FlatList
          data={filtered}
          keyExtractor={item => item.groupId}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyMessage={<Text style={styles.emptyText}>Không tìm thấy nhóm</Text>}
          renderItem={({ item }) => {
            const joined = item.owner === user?.username || item.members?.includes(user?.username);
            const pending = item.pendingRequests?.includes(user?.username);
            return (
              <View style={styles.groupCard}>
                <View style={styles.groupIcon}>
                  <Ionicons name={item.isPublic ? 'lock-open' : 'lock-closed'} size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.groupTopRow}>
                    <Text style={styles.groupName}>{item.groupName}</Text>
                    <View style={[styles.badge, item.isPublic ? styles.badgePublic : styles.badgePrivate]}>
                      <Text style={styles.badgeText}>{item.isPublic ? 'Công khai' : 'Riêng tư'}</Text>
                    </View>
                  </View>
                  <Text style={styles.groupMeta}>👤 {item.owner}</Text>
                  <Text style={styles.groupMeta}>👥 {item.members?.length || 0} thành viên</Text>
                </View>
              </View>
            );
          }}
        />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  header: { color: '#1e293b', fontSize: 28, fontWeight: '800' },
  badge: { backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  badgePublic: { backgroundColor: '#10b981' },
  badgePrivate: { backgroundColor: '#f59e0b' },
  searchWrapper: {
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
  filterRow: { marginBottom: 12, maxHeight: 44 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#e2e8f0', marginRight: 8 },
  filterChipActive: { backgroundColor: '#3b82f6' },
  filterText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  groupName: { color: '#1e293b', fontSize: 16, fontWeight: '800', flex: 1 },
  groupMeta: { color: '#64748b', fontSize: 13, marginTop: 2, fontWeight: '500' },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: 16, marginTop: 32, fontWeight: '500' },
});
