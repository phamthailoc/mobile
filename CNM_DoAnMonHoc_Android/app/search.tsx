import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import SafeScreen from '@/components/safe-screen';
import { API_BASE_URL } from '@/constants/api';
import { getApiErrorMessage } from '@/services/http';

type SearchResult = {
  id?: string;
  username?: string;
  groupId?: string;
  groupName?: string;
  postId?: string;
  text?: string;
  type?: string;
};

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/search/global`, {
        params: { q },
      });
      const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setResults(data);
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the tim kiem'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const resultCountText = useMemo(() => {
    return `${results.length} ket qua`;
  }, [results.length]);

  return (
    <SafeScreen>
      <View style={styles.container}>
        <Text style={styles.header}>Tim kiem toan cuc</Text>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color="#64748b" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tim user, nhom, bai viet..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={runSearch}>
            <Text style={styles.searchBtnText}>Tim</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <>
            <Text style={styles.countText}>{resultCountText}</Text>
            <FlatList
              data={results}
              keyExtractor={(item, index) => `${item.id || item.postId || item.groupId || item.username || 'item'}-${index}`}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={<Text style={styles.emptyText}>Nhap tu khoa de bat dau tim kiem</Text>}
              renderItem={({ item }) => {
                const label = item.username || item.groupName || item.text || 'Noi dung';
                const type = item.type || (item.username ? 'user' : item.groupId ? 'group' : item.postId ? 'post' : 'other');

                return (
                  <View style={styles.resultCard}>
                    <View style={styles.iconWrap}>
                      <Ionicons
                        name={type === 'user' ? 'person' : type === 'group' ? 'people' : type === 'post' ? 'document-text' : 'sparkles'}
                        size={16}
                        color="#1d4ed8"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultLabel}>{label}</Text>
                      <Text style={styles.resultType}>{type.toUpperCase()}</Text>
                    </View>
                  </View>
                );
              }}
            />
          </>
        )}
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingTop: 16 },
  header: { color: '#0f172a', fontSize: 28, fontWeight: '800', marginBottom: 12 },
  searchRow: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  input: { flex: 1, color: '#1e293b', paddingVertical: 12 },
  searchBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBtnText: { color: '#fff', fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#475569', marginTop: 10, marginBottom: 8, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLabel: { color: '#0f172a', fontWeight: '700' },
  resultType: { color: '#64748b', fontSize: 11, marginTop: 2 },
});
