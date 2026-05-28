import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import SafeScreen from '@/components/safe-screen';
import { API_BASE_URL } from '@/constants/api';
import { useUserContext } from '@/context/user-context';
import { getApiErrorMessage } from '@/services/http';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.heic', '.heif'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.flv', '.3gp', '.3g2', '.wmv'];

const getAttachmentKind = (fileType?: string, fileName?: string, sourceUri?: string) => {
  const type = (fileType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  const uri = (sourceUri || '').toLowerCase();

  if (type.startsWith('image/') || type === 'image') return 'image';
  if (type.startsWith('video/') || type === 'video') return 'video';
  if (type.startsWith('audio/') || type === 'audio') return 'audio';

  if (IMAGE_EXTENSIONS.some(ext => name.endsWith(ext))) return 'image';
  if (VIDEO_EXTENSIONS.some(ext => name.endsWith(ext))) return 'video';
  if (IMAGE_EXTENSIONS.some(ext => uri.includes(ext))) return 'image';
  if (VIDEO_EXTENSIONS.some(ext => uri.includes(ext))) return 'video';

  if (type.includes('gif') || name.endsWith('.gif') || uri.includes('.gif')) return 'image';
  return 'file';
};

type PostItem = {
  postId?: string;
  id?: string;
  username?: string;
  text?: string;
  mediaUrl?: string;
  fileData?: string;
  fileType?: string;
  fileName?: string;
  privacy?: 'public' | 'friends' | 'private';
  createdAt?: string;
  isEdited?: boolean;
  reactions?: { username: string; emoji: string }[];
  comments?: {
    commentId: string;
    username: string;
    text: string;
    createdAt?: string;
    reactions?: { username: string; emoji: string }[];
    replies?: { replyId: string; username: string; text: string }[];
  }[];
};

export default function SocialScreen() {
  const { user } = useUserContext();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [newPost, setNewPost] = useState('');
  const [postPrivacy, setPostPrivacy] = useState<'public' | 'friends' | 'private'>('friends');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [activeReactionPostId, setActiveReactionPostId] = useState<string | null>(null);
  const [selectedReactionsPost, setSelectedReactionsPost] = useState<PostItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPost, setEditingPost] = useState<PostItem | null>(null);
  const [editingText, setEditingText] = useState('');

  const normalizePosts = useCallback((data: any[]) => {
    return (data || []).map((item: any) => ({
      postId: item.postId || item.id,
      username: item.username || item.author,
      text: item.text || item.content,
      mediaUrl: item.mediaUrl || item.fileUrl || item.attachmentUrl,
      fileData: item.fileData || item.attachmentData,
      fileType: item.fileType || item.attachmentType,
      fileName: item.fileName || item.attachmentName,
      privacy: item.privacy || 'friends',
      createdAt: item.createdAt,
      isEdited: !!item.isEdited,
      reactions: Array.isArray(item.reactions) ? item.reactions : [],
      comments: item.comments || [],
    }));
  }, []);

  const friendsKey = useMemo(() => (Array.isArray(user?.friends) ? user.friends.join(',') : ''), [user?.friends]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const friends = friendsKey;
      const res = await axios.get(`${API_BASE_URL}/api/posts/list`, {
        params: { friends },
      });
      setPosts(normalizePosts(res.data || []));
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the tai feed'));
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [normalizePosts, friendsKey]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const createPost = async () => {
    const content = newPost.trim();
    if (!content || !user?.username) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/api/posts/create`, {
        username: user.username,
        text: content,
        privacy: postPrivacy,
      });
      setNewPost('');
      setPostPrivacy('friends');
      await loadPosts();
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the tao bai viet'));
    } finally {
      setSubmitting(false);
    }
  };

  const reactPost = async (postId: string, emoji: string) => {
    if (!user?.username) return;
    try {
      await axios.post(`${API_BASE_URL}/api/posts/react`, {
        postId,
        username: user.username,
        emoji,
      });
      await loadPosts();
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the tha cam xuc'));
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const getUserCurrentEmoji = (reactions: { username: string; emoji: string }[] = []) => {
    const match = reactions.find(reaction => reaction.username === user?.username);
    return match ? match.emoji : null;
  };

  const addComment = async (postId: string) => {
    const draft = (commentDrafts[postId] || '').trim();
    if (!draft || !user?.username) return;

    try {
      await axios.post(`${API_BASE_URL}/api/posts/comment`, {
        postId,
        username: user.username,
        text: draft,
      });
      setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
      await loadPosts();
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the binh luan'));
    }
  };

  const replyFirstComment = async (postId: string, commentId: string) => {
    if (!user?.username) return;
    try {
      await axios.post(`${API_BASE_URL}/api/posts/comment/reply`, {
        postId,
        commentId,
        username: user.username,
        text: 'Tra loi tu mobile',
      });
      await loadPosts();
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the tra loi'));
    }
  };

  const reactFirstComment = async (postId: string, commentId: string) => {
    if (!user?.username) return;
    try {
      await axios.post(`${API_BASE_URL}/api/posts/comment/react`, {
        postId,
        commentId,
        username: user.username,
        emoji: '👍',
      });
      await loadPosts();
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the react comment'));
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/posts/delete`, { postId });
      await loadPosts();
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the xoa bai viet'));
    }
  };

  const openEditPost = (post: PostItem) => {
    setEditingPost(post);
    setEditingText(post.text || '');
  };

  const submitEditPost = async () => {
    const postId = editingPost?.postId || editingPost?.id;
    if (!postId) return;

    try {
      await axios.post(`${API_BASE_URL}/api/posts/edit`, {
        postId,
        text: editingText,
      });
      setEditingPost(null);
      setEditingText('');
      await loadPosts();
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the sua bai viet'));
    }
  };

  const summaryText = useMemo(() => {
    return `Xin chao ${user?.displayName || user?.username || 'ban'} - ${posts.length} bai viet`;
  }, [posts.length, user?.displayName, user?.username]);

  return (
    <SafeScreen>
      <View style={styles.container}>
        <Text style={styles.header}>Social Feed</Text>
        <Text style={styles.subtitle}>{summaryText}</Text>

        <View style={styles.createBox}>
          <TextInput
            value={newPost}
            onChangeText={setNewPost}
            placeholder="Ban dang nghi gi?"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            multiline
          />
          <View style={styles.privacyRow}>
            {(['public', 'friends', 'private'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.privacyChip, postPrivacy === mode && styles.privacyChipActive]}
                onPress={() => setPostPrivacy(mode)}>
                <Text style={[styles.privacyChipText, postPrivacy === mode && styles.privacyChipTextActive]}>{mode}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.postButton, submitting && styles.postButtonDisabled]} onPress={createPost} disabled={submitting}>
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.postButtonText}>{submitting ? 'Dang dang...' : 'Dang bai'}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.postId || item.id || Math.random().toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={<Text style={styles.emptyText}>Chua co bai viet nao</Text>}
            renderItem={({ item }) => {
              const postId = item.postId || item.id;
              const reactionsList = item.reactions || [];
              const commentsList = item.comments || [];
              const reactionsCount = reactionsList.length;
              const commentsCount = commentsList.length;
              const myPost = item.username === user?.username;
              const showComments = !!postId && !!expandedComments[postId];
              const userEmoji = getUserCurrentEmoji(reactionsList);
              const attachmentKind = getAttachmentKind(item.fileType, item.fileName, item.mediaUrl || item.fileData);

              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarCircle}>
                      <Ionicons name="person" size={16} color="#1d4ed8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.authorText}>{item.username || 'Nguoi dung'}</Text>
                      <Text style={styles.timeText}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Vua xong'}</Text>
                    </View>
                    <Text style={styles.privacyText}>{item.privacy || 'friends'}</Text>
                  </View>

                  <Text style={styles.contentText}>{item.text || ''}</Text>
                  {/* media preview if present */}
                  {(item.mediaUrl || item.fileData) ? (() => {
                    let uri = item.mediaUrl || item.fileData || '';
                    const isRemote = uri.startsWith('http') || uri.startsWith('https');
                    if (!isRemote && uri && !uri.startsWith('data:')) {
                      const mime = item.fileType || (item.fileName && item.fileName.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
                      uri = `data:${mime};base64,${uri}`;
                    }

                    return (
                      <View style={styles.mediaWrap}>
                        {attachmentKind === 'video' ? (
                          <Text style={styles.videoFallbackText}>Video attachment</Text>
                        ) : (
                          <Image source={{ uri }} style={styles.postImage} resizeMode="contain" />
                        )}
                      </View>
                    );
                  })() : null}
                  {item.isEdited ? <Text style={styles.editedTag}>Da chinh sua</Text> : null}

                  <View style={styles.metaRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        if (reactionsList.length > 0) {
                          setSelectedReactionsPost(item);
                        }
                      }}>
                      <Text style={styles.metaText}>{reactionsCount} cam xuc</Text>
                    </TouchableOpacity>
                    <Text style={styles.metaText}>{commentsCount} binh luan</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <View style={styles.reactionZone}>
                      {activeReactionPostId === postId && (
                        <View style={styles.reactionPopup}>
                          {['❤️', '🔥', '😂', '😮', '😢'].map(emoji => (
                            <TouchableOpacity key={emoji} onPress={() => postId && reactPost(postId, emoji)}>
                              <Text style={styles.reactionEmoji}>{emoji}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <TouchableOpacity
                        style={[styles.actionBtn, userEmoji && styles.actionBtnActive]}
                        onPress={() => {
                          if (!postId) return;
                          setActiveReactionPostId(prev => (prev === postId ? null : postId));
                        }}>
                        <Ionicons name={userEmoji ? 'heart' : 'heart-outline'} size={16} color={userEmoji ? '#7c3aed' : '#64748b'} />
                        <Text style={styles.actionText}>{userEmoji ? 'Da cam xuc' : 'Cam xuc'}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => postId && toggleComments(postId)}>
                      <Ionicons name="chatbubble" size={16} color="#3b82f6" />
                      <Text style={styles.actionText}>Binh luan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn}>
                      <Ionicons name="share-social" size={16} color="#6b7280" />
                      <Text style={styles.actionText}>Chia se</Text>
                    </TouchableOpacity>
                  </View>

                  {showComments && (
                    <View style={styles.commentSection}>
                      <View style={styles.commentComposer}>
                        <TextInput
                          value={commentDrafts[postId || ''] || ''}
                          onChangeText={value => setCommentDrafts(prev => ({ ...prev, [postId || '']: value }))}
                          placeholder="Viet binh luan cua ban..."
                          placeholderTextColor="#94a3b8"
                          style={styles.commentInput}
                        />
                        <TouchableOpacity style={styles.commentSendBtn} onPress={() => postId && addComment(postId)}>
                          <Ionicons name="send" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>

                      {commentsList.length > 0 && (
                        <View style={styles.commentList}>
                          {commentsList.slice(0, 5).map(comment => (
                            <View key={comment.commentId} style={styles.commentPreview}>
                              <Text style={styles.commentPreviewText}>
                                {comment.username}: {comment.text}
                              </Text>
                              <View style={styles.commentActionRow}>
                                <TouchableOpacity onPress={() => postId && reactFirstComment(postId, comment.commentId)}>
                                  <Text style={styles.commentActionText}>React comment</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => postId && replyFirstComment(postId, comment.commentId)}>
                                  <Text style={styles.commentActionText}>Reply</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {myPost ? (
                    <View style={styles.ownerRow}>
                      <TouchableOpacity style={styles.ownerBtn} onPress={() => openEditPost(item)}>
                        <Text style={styles.ownerBtnText}>Sua</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.ownerBtn, styles.ownerBtnDanger]} onPress={() => postId && deletePost(postId)}>
                        <Text style={styles.ownerBtnText}>Xoa</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        <Modal visible={!!editingPost} transparent animationType="fade" onRequestClose={() => setEditingPost(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Sua bai viet</Text>
              <TextInput value={editingText} onChangeText={setEditingText} multiline style={styles.modalInput} placeholder="Noi dung..." />
              <View style={styles.modalActionRow}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setEditingPost(null)}>
                  <Text style={styles.modalBtnGhostText}>Huy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtn} onPress={submitEditPost}>
                  <Text style={styles.modalBtnText}>Luu</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={!!selectedReactionsPost} transparent animationType="fade" onRequestClose={() => setSelectedReactionsPost(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Cam xuc bai viet</Text>
              <View style={{ gap: 8, marginBottom: 12 }}>
                {(selectedReactionsPost?.reactions || []).map((reaction, index) => (
                  <View key={`${reaction.username}-${index}`} style={styles.reactionListItem}>
                    <Text style={styles.reactionListEmoji}>{reaction.emoji}</Text>
                    <Text style={styles.reactionListText}>@{reaction.username}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setSelectedReactionsPost(null)}>
                <Text style={styles.modalBtnText}>Dong</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingTop: 16 },
  header: { color: '#0f172a', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#475569', marginTop: 6, marginBottom: 12, fontWeight: '500' },
  createBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    minHeight: 70,
    color: '#0f172a',
    textAlignVertical: 'top',
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  postButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postButtonDisabled: { opacity: 0.65 },
  postButtonText: { color: '#fff', fontWeight: '700' },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  privacyChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  privacyChipActive: { backgroundColor: '#1d4ed8' },
  privacyChipText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  privacyChipTextActive: { color: '#fff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
  },
  privacyText: {
    fontSize: 11,
    color: '#334155',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontWeight: '700',
  },
  authorText: { color: '#0f172a', fontWeight: '700' },
  timeText: { color: '#64748b', fontSize: 12 },
  contentText: { color: '#1e293b', lineHeight: 20 },
  mediaWrap: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#0f172a',
  },
  postImage: {
    width: '100%',
    height: 260,
  },
  videoFallbackText: {
    color: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontWeight: '700',
  },
  editedTag: { color: '#64748b', fontSize: 11, marginTop: 6, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  reactionZone: { flex: 1, position: 'relative' },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  actionBtnActive: { backgroundColor: '#ede9fe' },
  actionText: { color: '#1e293b', fontWeight: '700', fontSize: 12 },
  reactionPopup: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 10,
  },
  reactionEmoji: { fontSize: 22 },
  commentSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 10 },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  commentInput: { flex: 1, color: '#1e293b', paddingVertical: 8 },
  commentSendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  commentPreview: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commentPreviewText: { color: '#334155', fontSize: 12 },
  commentActionRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  commentActionText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
  commentList: { gap: 8 },
  ownerRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  ownerBtn: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  ownerBtnDanger: { backgroundColor: '#dc2626' },
  ownerBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  modalInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  modalActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  modalBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalBtnGhost: { backgroundColor: '#e2e8f0' },
  modalBtnText: { color: '#fff', fontWeight: '700' },
  modalBtnGhostText: { color: '#334155', fontWeight: '700' },
  reactionListItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  reactionListEmoji: { fontSize: 18 },
  reactionListText: { color: '#0f172a', fontWeight: '600' },
});
