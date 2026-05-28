import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import SafeScreen from '@/components/safe-screen';
import { API_BASE_URL } from '@/constants/api';
import { pickImage } from '@/utils/file-handler';
import { getApiErrorMessage } from '@/services/http';
import { useUserContext } from '@/context/user-context';

type StoryItem = {
  storyId?: string;
  id?: string;
  username?: string;
  mediaUrl?: string;
  caption?: string;
  createdAt?: string;
  viewers?: string[];
  reactions?: { username: string; emoji: string }[];
};

export default function StoriesScreen() {
  const { user } = useUserContext();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const flattenStories = useCallback((payload: any) => {
    if (Array.isArray(payload)) {
      return payload as StoryItem[];
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const list: StoryItem[] = [];
    Object.entries(payload).forEach(([owner, values]) => {
      const storiesByOwner = Array.isArray(values) ? values : [];
      storiesByOwner.forEach((item: any) => {
        list.push({
          storyId: item.storyId,
          username: item.username || owner,
          mediaUrl: item.mediaUrl,
          caption: item.caption,
          createdAt: item.createdAt,
          viewers: item.viewers || [],
          reactions: item.reactions || [],
        });
      });
    });

    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, []);

  const friendsKey = useMemo(() => (Array.isArray(user?.friends) ? user.friends.join(',') : ''), [user?.friends]);

  const loadStories = useCallback(async (archiveMode = false) => {
    setLoading(true);
    try {
      if (archiveMode) {
        const res = await axios.get(`${API_BASE_URL}/api/stories/archive`);
        setStories((res.data || []) as StoryItem[]);
      } else {
        const friends = friendsKey;
        const res = await axios.get(`${API_BASE_URL}/api/stories/list`, {
          params: { friends },
        });
        setStories(flattenStories(res.data));
      }
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the tai stories'));
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [flattenStories, friendsKey]);

  useEffect(() => {
    void loadStories(showArchive);
  }, [loadStories, showArchive]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStories(showArchive);
    setRefreshing(false);
  };

  const uploadStory = async () => {
    const image = await pickImage();
    if (!image?.base64 || !image.uri || !user?.username) return;

    setUploading(true);
    try {
      const mediaData = image.base64.startsWith('data:')
        ? image.base64
        : `data:${image.type || 'image/jpeg'};base64,${image.base64}`;

      await axios.post(`${API_BASE_URL}/api/stories/upload`, {
        username: user.username,
        mediaData,
        mediaType: image.type?.startsWith('video/') ? 'video' : 'image',
        caption: '',
      });
      await loadStories(showArchive);
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the dang story'));
    } finally {
      setUploading(false);
    }
  };

  const reactStory = async (storyId: string) => {
    if (!user?.username) return;
    try {
      await axios.post(`${API_BASE_URL}/api/stories/react`, {
        storyId,
        username: user.username,
        emoji: '❤️',
      });
      await loadStories(showArchive);
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the tha cam xuc'));
    }
  };

  const markViewed = async (storyId: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/stories/view`, { storyId });
      await loadStories(showArchive);
    } catch {
      // Keep silent to avoid interrupting browsing flow.
    }
  };

  const deleteStory = async (storyId: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/stories/delete`, { storyId });
      await loadStories(showArchive);
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the xoa story'));
    }
  };

  return (
    <SafeScreen>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.header}>{showArchive ? 'Story Archive' : 'Stories'}</Text>
            <Text style={styles.subtitle}>{stories.length} story dang hien thi</Text>
          </View>
          <TouchableOpacity style={styles.archiveButton} onPress={() => setShowArchive(prev => !prev)}>
            <Ionicons name={showArchive ? 'albums' : 'archive'} size={16} color="#0f172a" />
            <Text style={styles.archiveButtonText}>{showArchive ? 'Danh sach' : 'Archive'}</Text>
          </TouchableOpacity>
        </View>

        {!showArchive ? (
          <TouchableOpacity style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]} onPress={uploadStory} disabled={uploading}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.uploadButtonText}>{uploading ? 'Dang tai' : 'Dang story'}</Text>
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={stories}
            keyExtractor={item => item.storyId || item.id || Math.random().toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<Text style={styles.empty}>Chua co story nao</Text>}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => {
              const storyId = item.storyId || item.id;
              const isOwner = item.username === user?.username;
              const reactionCount = item.reactions?.length || 0;

              return (
                <View style={styles.card}>
                  <View style={styles.topRow}>
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={16} color="#0f766e" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.username}>{item.username || 'Nguoi dung'}</Text>
                      <Text style={styles.time}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Vua xong'}</Text>
                    </View>
                    <Text style={styles.viewCount}>{item.viewers?.length || 0} views</Text>
                  </View>

                  {item.mediaUrl ? (
                    <Image source={{ uri: item.mediaUrl }} style={styles.mediaPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.previewBox}>
                      <Ionicons name="image-outline" size={30} color="#64748b" />
                      <Text style={styles.previewText}>Story media da san sang</Text>
                    </View>
                  )}

                  {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}

                  <Text style={styles.reactionCount}>{reactionCount} reactions</Text>

                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => storyId && reactStory(storyId)}>
                      <Ionicons name="heart" size={16} color="#ef4444" />
                      <Text style={styles.actionText}>Like</Text>
                    </TouchableOpacity>
                    {!showArchive ? (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => storyId && markViewed(storyId)}>
                        <Ionicons name="eye" size={16} color="#3b82f6" />
                        <Text style={styles.actionText}>Da xem</Text>
                      </TouchableOpacity>
                    ) : null}
                    {isOwner ? (
                      <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => storyId && deleteStory(storyId)}>
                        <Ionicons name="trash" size={16} color="#fff" />
                        <Text style={styles.deleteBtnText}>Xoa</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  header: { color: '#0f172a', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#64748b', marginTop: 4 },
  archiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  archiveButtonText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },
  uploadButton: {
    backgroundColor: '#0f766e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  uploadButtonDisabled: { opacity: 0.65 },
  uploadButtonText: { color: '#fff', fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 24, color: '#64748b' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ccfbf1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: { color: '#0f172a', fontWeight: '700' },
  time: { color: '#64748b', fontSize: 12 },
  viewCount: { color: '#475569', fontSize: 12, fontWeight: '700' },
  mediaPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  previewBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  previewText: { color: '#64748b', marginTop: 6 },
  caption: { color: '#1e293b', marginTop: 8 },
  reactionCount: { color: '#64748b', marginTop: 8, fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionText: { color: '#1e293b', fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#dc2626' },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
