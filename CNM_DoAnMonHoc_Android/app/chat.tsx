import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions, ScrollView, Modal, Image, Alert, Linking } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { useUserContext } from '@/context/user-context';
import SafeScreen from '@/components/safe-screen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { useSocket } from '@/hooks/use-socket';
import { pickImage, pickDocument, pickVideo, isFileSizeValid, getFileSizeInMB } from '@/utils/file-handler';
import { COMMON_EMOJIS, EMOJI_CATEGORIES } from '@/utils/emoji-data';
import Ionicons from '@expo/vector-icons/Ionicons';

const TENOR_API_KEY = 'LIVDSRZULELA';

type ChatMessage = {
  messageId?: string;
  id?: string;
  roomId?: string;
  senderId?: string;
  senderUsername?: string;
  sender?: string;
  content?: string;
  text?: string;
  sentAt?: string;
  createdAt?: string;
  fileData?: string;
  fileType?: string;
  fileName?: string;
  msgType?: string;
  pollData?: {
    question?: string;
    options?: { text?: string; votes?: string[] }[];
  };
  forwardedFrom?: string;
  isRevoked?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  isPinned?: boolean;
  reactions?: { username: string; emoji: string }[];
  readBy?: string[];
  deliveredTo?: string[];
};

type AttachmentPreview = {
  uri: string;
  type: string;
  name: string;
  base64: string;
  isRemote?: boolean;
};

type TenorGifItem = {
  url: string;
  previewUrl: string;
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.heic', '.heif'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.flv', '.3gp', '.3g2', '.wmv'];
const MAX_BASE64_ATTACHMENT_CHARS = 300 * 1024;
const MESSAGE_API_BASE = `${API_BASE_URL}/api/v1/messages`;

const getAttachmentKind = (fileType?: string, fileName?: string, sourceUri?: string) => {
  const type = (fileType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  const uri = (sourceUri || '').toLowerCase();

  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';

  if (IMAGE_EXTENSIONS.some(ext => name.endsWith(ext))) return 'image';
  if (VIDEO_EXTENSIONS.some(ext => name.endsWith(ext))) return 'video';
  if (IMAGE_EXTENSIONS.some(ext => uri.includes(ext))) return 'image';
  if (VIDEO_EXTENSIONS.some(ext => uri.includes(ext))) return 'video';

  return 'document';
};

const getImageMimeType = (fileType?: string, fileName?: string) => {
  const type = (fileType || '').toLowerCase();
  if (type.startsWith('image/')) return fileType || 'image/jpeg';

  const name = (fileName || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.bmp')) return 'image/bmp';
  if (name.endsWith('.svg')) return 'image/svg+xml';
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
};

const getVideoMimeType = (fileType?: string, fileName?: string) => {
  const type = (fileType || '').toLowerCase();
  if (type.startsWith('video/')) return fileType || 'video/mp4';

  const name = (fileName || '').toLowerCase();
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.avi')) return 'video/x-msvideo';
  if (name.endsWith('.mkv')) return 'video/x-matroska';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.flv')) return 'video/x-flv';
  if (name.endsWith('.3gp')) return 'video/3gpp';
  if (name.endsWith('.3g2')) return 'video/3gpp2';
  if (name.endsWith('.wmv')) return 'video/x-ms-wmv';
  return 'video/mp4';
};

const inferMessageType = (fileType?: string, fileName?: string, sourceUri?: string) => {
  const kind = getAttachmentKind(fileType, fileName, sourceUri);
  if (kind === 'image') return 'image';
  if (kind === 'video') return 'video';

  const lowerType = (fileType || '').toLowerCase();
  const lowerName = (fileName || '').toLowerCase();
  if (lowerType.includes('gif') || lowerName.endsWith('.gif')) return 'image';
  if (fileType || fileName || sourceUri) return 'file';
  return 'text';
};

export default function ChatScreen({ user }: any) {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomId?: string; roomName?: string }>();
  const { width } = useWindowDimensions();
  const { user: contextUser } = useUserContext();
  const activeUser = user || contextUser;
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [activeRoomId, setActiveRoomId] = useState('chung');
  const [msgInput, setMsgInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showRoomsList, setShowRoomsList] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardSourceMessage, setForwardSourceMessage] = useState<ChatMessage | null>(null);
  const [forwardTargetRoom, setForwardTargetRoom] = useState('');
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
  const [previewVideoFailed, setPreviewVideoFailed] = useState(false);
  const [roomProfileMap, setRoomProfileMap] = useState<Record<string, { username: string; displayName: string }>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifLoading, setGifLoading] = useState(false);
  const [gifItems, setGifItems] = useState<TenorGifItem[]>([]);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const isWide = width >= 900;
  const scrollOnNextUpdateRef = useRef(true);
  const pendingPinnedJumpRef = useRef<string | null>(null);
  const loadedUsernameRef = useRef<string | null>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  
  // Socket.io connection
  const {
    isConnected,
    messages: socketMessages,
    sendMessage,
    revokeMessage,
    editMessage,
    markMessagesRead,
    markMessagesDelivered,
    sendError,
    clearSendError,
  } = useSocket(activeUser?.username, !!activeUser);

  const normalizeMessage = (msg: any): ChatMessage => ({
    messageId: msg.messageId || msg.id,
    roomId: msg.roomId || 'chung',
    senderUsername: msg.senderUsername || msg.senderId || msg.sender,
    text: msg.text || msg.content,
    createdAt: msg.createdAt || msg.sentAt || msg.time,
    // Accept either inline base64 (`fileData`) or remote URLs (`mediaUrl`, `fileUrl`)
    fileData: msg.fileData || msg.mediaUrl || msg.fileUrl || msg.attachmentUrl,
    fileType: msg.fileType || msg.attachmentType,
    fileName: msg.fileName || msg.attachmentName,
    msgType: msg.msgType || inferMessageType(msg.fileType || msg.attachmentType, msg.fileName || msg.attachmentName, msg.fileData || msg.mediaUrl || msg.fileUrl || msg.attachmentUrl),
    pollData: msg.pollData,
    forwardedFrom: msg.forwardedFrom,
    isRevoked: msg.isRevoked,
    isEdited: msg.isEdited,
    editedAt: msg.editedAt,
    isPinned: msg.isPinned,
    reactions: Array.isArray(msg.reactions) ? msg.reactions : [],
    readBy: Array.isArray(msg.readBy) ? msg.readBy : [],
    deliveredTo: Array.isArray(msg.deliveredTo) ? msg.deliveredTo : [],
  });

  useEffect(() => {
    if (!sendError) return;
    Alert.alert('Lỗi gửi tin nhắn', sendError);
    clearSendError();
  }, [sendError, clearSendError]);

  useEffect(() => {
    if (!showGifPicker) return;

    const timer = setTimeout(async () => {
      try {
        setGifLoading(true);
        const query = gifSearchQuery.trim();
        const url = query
          ? `https://api.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=21`
          : `https://api.tenor.com/v1/trending?key=${TENOR_API_KEY}&limit=21`;

        const response = await fetch(url);
        const data = await response.json();
        const results = Array.isArray(data?.results) ? data.results : [];

        const extracted = results
          .map((item: any) => {
            const media = item?.media && item.media.length > 0 ? item.media[0] : null;
            const previewUrl = media?.tinygif?.url || media?.nanogif?.url || media?.gif?.url || media?.mediumgif?.url || '';
            const gifUrl = media?.gif?.url || media?.mediumgif?.url || media?.tinygif?.url || previewUrl;
            if (!gifUrl || !previewUrl) return null;
            return { url: gifUrl, previewUrl };
          })
          .filter(Boolean) as TenorGifItem[];

        setGifItems(extracted);
      } catch (error) {
        console.error('Failed to fetch Tenor GIFs:', error);
        setGifItems([]);
      } finally {
        setGifLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [gifSearchQuery, showGifPicker]);

  // Merge real-time messages from socket with existing messages
  useEffect(() => {
    if (!socketMessages || socketMessages.length === 0) {
      return;
    }

    setAllMessages(prev => {
      let changed = false;
      const nextMessages = [...prev];

      socketMessages.forEach(socketMessage => {
        const messageId = socketMessage.messageId || socketMessage.id;
        if (!messageId) return;

        const index = nextMessages.findIndex(message => (message.messageId || message.id) === messageId);
        const normalizedMessage = normalizeMessage(socketMessage);

        if (index >= 0) {
          const current = nextMessages[index];
          if (
            current.text !== normalizedMessage.text ||
            current.fileData !== normalizedMessage.fileData ||
            current.fileType !== normalizedMessage.fileType ||
            current.fileName !== normalizedMessage.fileName ||
            current.msgType !== normalizedMessage.msgType ||
            JSON.stringify(current.pollData || null) !== JSON.stringify(normalizedMessage.pollData || null) ||
            current.forwardedFrom !== normalizedMessage.forwardedFrom ||
            current.isRevoked !== normalizedMessage.isRevoked ||
            current.isEdited !== normalizedMessage.isEdited ||
            current.isPinned !== normalizedMessage.isPinned ||
            JSON.stringify(current.reactions || []) !== JSON.stringify(normalizedMessage.reactions || []) ||
            JSON.stringify(current.readBy || []) !== JSON.stringify(normalizedMessage.readBy || []) ||
            JSON.stringify(current.deliveredTo || []) !== JSON.stringify(normalizedMessage.deliveredTo || [])
          ) {
            nextMessages[index] = { ...current, ...normalizedMessage };
            changed = true;
          }
          return;
        }

        nextMessages.push(normalizedMessage);
        changed = true;
        scrollOnNextUpdateRef.current = true;
      });

      return changed ? nextMessages : prev;
    });
  }, [socketMessages]);

  // Load initial messages from REST API
  useEffect(() => {
    if (!activeUser?.username) return;
    if (loadedUsernameRef.current === activeUser.username) return;
    loadedUsernameRef.current = activeUser.username;
    setLoading(true);
    scrollOnNextUpdateRef.current = true;
    axios.get(`${MESSAGE_API_BASE}/${activeUser.username}`)
      .then(res => {
        const messageSource = Array.isArray(res.data) ? res.data : (res.data?.messages || []);
        const formattedMessages = messageSource.map((msg: any) => normalizeMessage(msg));
        processedMessageIdsRef.current = new Set(formattedMessages.map((msg: ChatMessage) => msg.messageId || msg.id).filter(Boolean) as string[]);
        setAllMessages(formattedMessages);
      })
      .catch(err => {
        console.error('Error loading messages:', err);
        setAllMessages([]);
        loadedUsernameRef.current = null;
      })
      .finally(() => setLoading(false));
  }, [activeUser?.username]);

  useEffect(() => {
    if (!activeUser?.username) return;

    axios.get(`${API_BASE_URL}/api/groups/all`)
      .then(res => setAllGroups(res.data || []))
      .catch(err => {
        console.error('Error loading groups for chat:', err);
        setAllGroups([]);
      });
  }, [activeUser?.username, params.roomId]);

  useEffect(() => {
    if (typeof params.roomId === 'string' && params.roomId) {
      setActiveRoomId(params.roomId);
      scrollOnNextUpdateRef.current = true;
    }
  }, [params.roomId]);

  // Auto-scroll to bottom only when needed, not on every content size change
  // Reset scroll flag when changing rooms
  useEffect(() => {
    if (pendingPinnedJumpRef.current) return;
    scrollOnNextUpdateRef.current = true;
  }, [activeRoomId]);

  const rooms = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; isDM: boolean; peerUsername?: string }>();
    unique.set('chung', { id: 'chung', name: 'Chung', isDM: false });

    allGroups.forEach(group => {
      const groupId = group.groupId || group.id;
      const canSeeGroup =
        group.isPublic ||
        group.owner === activeUser?.username ||
        group.members?.includes(activeUser?.username) ||
        activeUser?.role === 'admin';

      if (groupId && canSeeGroup && !unique.has(groupId)) {
        unique.set(groupId, { id: groupId, name: group.groupName || group.name || groupId, isDM: false });
      }
    });

    allMessages.forEach(m => {
      const roomId = m.roomId || 'chung';
      if (!unique.has(roomId)) {
        if (roomId.startsWith('dm_')) {
          const peer = roomId.replace('dm_', '').split('_').find(p => p !== activeUser?.username) || 'DM';
          unique.set(roomId, { id: roomId, name: peer, isDM: true, peerUsername: peer });
        } else {
          unique.set(roomId, { id: roomId, name: roomId, isDM: false });
        }
      }
    });
    return Array.from(unique.values());
  }, [allGroups, allMessages, activeUser?.role, activeUser?.username]);

  useEffect(() => {
    const dmPeers = rooms
      .filter(room => room.isDM && room.peerUsername)
      .map(room => room.peerUsername as string)
      .filter(username => username && username !== activeUser?.username);

    const missingPeers = dmPeers.filter(username => !roomProfileMap[username]);
    if (missingPeers.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missingPeers.map(async username => {
        try {
          const res = await axios.get(`${API_BASE_URL}/api/users/${username}`);
          return {
            username,
            displayName: res.data?.displayName || res.data?.username || username,
          };
        } catch {
          return { username, displayName: username };
        }
      })
    ).then(results => {
      if (cancelled) return;
      setRoomProfileMap(prev => {
        const next = { ...prev };
        results.forEach(profile => {
          next[profile.username] = profile;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [rooms, activeUser?.username, roomProfileMap]);

  const filteredMessages = useMemo(() => {
    const byRoom = allMessages.filter(m => (m.roomId || 'chung') === activeRoomId);
    if (!searchQuery.trim()) return byRoom;
    const q = searchQuery.toLowerCase();
    return byRoom.filter(m => {
      const content = (m.text || '').toLowerCase();
      const sender = (m.senderUsername || '').toLowerCase();
      return content.includes(q) || sender.includes(q);
    });
  }, [allMessages, activeRoomId, searchQuery]);

  const sortedMessages = useMemo(() => {
    return [...filteredMessages].sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return leftTime - rightTime;
    });
  }, [filteredMessages]);

  const pinnedMessages = useMemo(
    () => [...allMessages]
      .filter(message => message.isPinned && ((message.roomId || 'chung') === activeRoomId))
      .sort((left, right) => {
        const leftTime = new Date(left.createdAt || 0).getTime();
        const rightTime = new Date(right.createdAt || 0).getTime();
        return rightTime - leftTime;
      }),
    [allMessages, activeRoomId]
  );
  const latestPinnedMessage = pinnedMessages[0] || null;

  useEffect(() => {
    if (!activeUser?.username || !activeRoomId || filteredMessages.length === 0) return;

    const undeliveredIds = filteredMessages
      .filter(message => {
        const messageId = getMessageKey(message);
        if (!messageId) return false;
        if (message.senderUsername === activeUser.username) return false;
        return !(message.deliveredTo || []).includes(activeUser.username);
      })
      .map(message => getMessageKey(message))
      .filter(Boolean) as string[];

    if (undeliveredIds.length === 0) return;

    markMessagesDelivered(undeliveredIds.slice(0, 50), activeRoomId);
  }, [activeRoomId, activeUser?.username, filteredMessages, markMessagesDelivered]);

  useEffect(() => {
    if (!activeUser?.username || !activeRoomId || filteredMessages.length === 0) return;

    const unreadIds = filteredMessages
      .filter(message => {
        const messageId = getMessageKey(message);
        if (!messageId) return false;
        if (message.senderUsername === activeUser.username) return false;
        return !(message.readBy || []).includes(activeUser.username);
      })
      .map(message => getMessageKey(message))
      .filter(Boolean) as string[];

    if (unreadIds.length === 0) return;

    const limitedIds = unreadIds.slice(0, 20);

    setAllMessages(prev => prev.map(message => {
      const messageId = getMessageKey(message);
      if (!messageId || !limitedIds.includes(messageId)) return message;
      const currentReadBy = message.readBy || [];
      if (currentReadBy.includes(activeUser.username)) return message;
      return {
        ...message,
        readBy: [...currentReadBy, activeUser.username],
      };
    }));

    markMessagesRead(limitedIds, activeRoomId);
    void axios.post(`${MESSAGE_API_BASE}/mark-read`, {
      messageIds: limitedIds,
      username: activeUser.username,
    });
  }, [activeRoomId, activeUser?.username, filteredMessages, markMessagesRead]);

  // Auto-scroll effect after filteredMessages is defined
  useEffect(() => {
    if (scrollOnNextUpdateRef.current && filteredMessages.length > 0 && !loading) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        scrollOnNextUpdateRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [filteredMessages.length, loading]);

  useEffect(() => {
    const targetMessageId = pendingPinnedJumpRef.current;
    if (!targetMessageId || loading || sortedMessages.length === 0) return;

    const index = sortedMessages.findIndex(message => getMessageKey(message) === targetMessageId);
    if (index < 0) return;

    const timer = setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.35 });
        pendingPinnedJumpRef.current = null;
      } catch {
        flatListRef.current?.scrollToOffset({
          offset: Math.max(0, index * 120),
          animated: true,
        });
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.35 });
          } finally {
            pendingPinnedJumpRef.current = null;
          }
        }, 120);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [sortedMessages, loading, activeRoomId]);

  const participants = useMemo(() => {
    const set = new Set<string>();
    filteredMessages.forEach(m => {
      const u = m.senderUsername;
      if (u) set.add(u);
    });
    if (activeUser?.username) set.add(activeUser.username);
    return Array.from(set);
  }, [filteredMessages, activeUser?.username]);

  const handleSend = async () => {
    if (!msgInput.trim() && !attachmentPreview) return;
    if (!isConnected) {
      Alert.alert('Lỗi', 'Chưa kết nối đến máy chủ. Vui lòng thử lại.');
      return;
    }

    setSending(true);
    try {
      if (attachmentPreview?.base64 && attachmentPreview.base64.length > MAX_BASE64_ATTACHMENT_CHARS) {
        Alert.alert('Lỗi', 'Video/file qua lon de luu tren he thong hien tai. Vui long chon file nho hon.');
        return;
      }

      const messageData: any = buildOutgoingMessagePayload({
        roomId: activeRoomId,
        text: msgInput,
      });

      // Attach file if selected
      if (attachmentPreview) {
        const raw = attachmentPreview.base64 || '';
        const mime = attachmentPreview.type || (attachmentPreview.name && attachmentPreview.name.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
        const isRemote = attachmentPreview.isRemote || /^https?:\/\//i.test(attachmentPreview.uri);
        messageData.fileData = isRemote ? attachmentPreview.uri : (raw.startsWith('data:') ? raw : `data:${mime};base64,${raw}`);
        messageData.fileType = getAttachmentKind(attachmentPreview.type || mime, attachmentPreview.name, attachmentPreview.uri);
        messageData.fileName = attachmentPreview.name;
        messageData.msgType = messageData.fileType;
      }

      // Send via Socket.io
      sendMessage(messageData);

      // Clear input
      setMsgInput('');
      setAttachmentPreview(null);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  const handleAttachFile = async () => {
    try {
      const file = await pickDocument();
      if (file) {
        setAttachmentPreview({
          uri: file.uri,
          type: file.type,
          name: file.name,
          base64: file.base64 || '',
        });
        setShowFileMenu(false);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Lỗi', 'Không thể chọn file');
    }
  };

  const handleAttachImage = async (source: 'camera' | 'gallery') => {
    try {
      const file = await pickImage(source);
      if (file) {
        setAttachmentPreview({
          uri: file.uri,
          type: getImageMimeType(file.type, file.name),
          name: file.name,
          base64: file.base64 || '',
        });
        setShowFileMenu(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const handleAttachGif = async () => {
    setShowFileMenu(false);
    setGifSearchQuery('');
    setShowGifPicker(true);
  };

  const handleSelectGif = (gifUrl: string) => {
    setAttachmentPreview({
      uri: gifUrl,
      type: 'image/gif',
      name: 'tenor.gif',
      base64: '',
      isRemote: true,
    });
    setShowGifPicker(false);
  };

  const handleAttachVideo = async () => {
    try {
      const file = await pickVideo();
      if (file) {
        if (!isFileSizeValid(file.size, 100)) {
          Alert.alert('Lỗi', `File quá lớn. Giới hạn là 100 MB, file của bạn là ${getFileSizeInMB(file.size)}`);
          return;
        }
        setAttachmentPreview({
          uri: file.uri,
          type: file.type || 'video/mp4',
          name: file.name,
          base64: file.base64 || '',
        });
        setShowFileMenu(false);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Lỗi', 'Không thể chọn video');
    }
  };

  const openForwardMessage = (message: ChatMessage) => {
    setForwardSourceMessage(message);
    setForwardTargetRoom('');
    setSelectedMessage(null);
    setShowForwardModal(true);
  };

  const handleForwardMessage = async () => {
    if (!forwardSourceMessage || !activeUser?.username || !forwardTargetRoom) return;

    const sourceType = forwardSourceMessage.msgType || 'text';
    const isPoll = sourceType === 'poll' || !!forwardSourceMessage.pollData;
    const payload: any = {
      roomId: forwardTargetRoom,
      text: forwardSourceMessage.text || (isPoll ? forwardSourceMessage.pollData?.question || 'Bình chọn' : ''),
      forwardedFrom: forwardSourceMessage.senderUsername || activeUser.username,
      forwardFrom: forwardSourceMessage.senderUsername || activeUser.username,
      msgType: isPoll ? 'poll' : sourceType,
    };

    if (forwardSourceMessage.fileData) {
      payload.fileData = forwardSourceMessage.fileData;
      payload.fileType = getAttachmentKind(forwardSourceMessage.fileType, forwardSourceMessage.fileName, forwardSourceMessage.fileData);
      payload.fileName = forwardSourceMessage.fileName;
      payload.msgType = payload.fileType;
    }

    if (isPoll && forwardSourceMessage.pollData) {
      payload.pollData = forwardSourceMessage.pollData;
      payload.text = forwardSourceMessage.pollData.question || payload.text;
    }

    sendMessage(buildOutgoingMessagePayload(payload));
    setShowForwardModal(false);
    setForwardSourceMessage(null);
    setForwardTargetRoom('');
  };

  const handleCreatePoll = async () => {
    if (!activeUser?.username || !pollQuestion.trim()) return;

    const options = pollOptions
      .map(option => option.trim())
      .filter(Boolean)
      .slice(0, 10)
      .map(text => ({ text, votes: [] }));

    if (options.length < 2) {
      Alert.alert('Lỗi', 'Bình chọn cần ít nhất 2 lựa chọn, mỗi lựa chọn một dòng');
      return;
    }

    sendMessage(buildOutgoingMessagePayload({
      roomId: activeRoomId,
      text: pollQuestion.trim(),
      msgType: 'poll',
      pollData: {
        question: pollQuestion.trim(),
        options,
      },
    } as any));

    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollModal(false);
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions(prev => prev.map((option, currentIndex) => (currentIndex === index ? value : option)));
  };

  const addPollOption = () => {
    setPollOptions(prev => (prev.length >= 10 ? prev : [...prev, '']));
  };

  const removePollOption = (index: number) => {
    setPollOptions(prev => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const handleVotePoll = async (message: ChatMessage, optionIndex: number) => {
    const messageId = getMessageKey(message);
    if (!activeUser?.username || !messageId) return;

    try {
      await axios.post(`${MESSAGE_API_BASE}/vote`, {
        messageId,
        optionIndex,
        username: activeUser.username,
      });
    } catch (error) {
      console.error('Error voting poll:', error);
      Alert.alert('Lỗi', 'Không thể bình chọn');
    }
  };

  const getMessageKey = (message: ChatMessage) => message.messageId || message.id || '';

  const buildOutgoingMessagePayload = (payload: Record<string, any>) => {
    const timestamp = new Date().toISOString();
    const displayName = activeUser?.displayName || activeUser?.username || '';
    const username = activeUser?.username || '';
    const text = typeof payload.text === 'string' ? payload.text : '';

    return {
      ...payload,
      roomId: String(payload.roomId || 'chung'),
      sender: displayName,
      senderDisplayName: displayName,
      senderUsername: username,
      senderId: username,
      text,
      content: payload.content ?? text,
      time: payload.time || timestamp,
      sentAt: payload.sentAt || timestamp,
      createdAt: payload.createdAt || timestamp,
    } as Omit<ChatMessage, 'messageId' | 'id'> & { roomId: string; senderUsername: string; senderId: string; sender: string; text: string; content: string };
  };

  const getRoomLabel = (room?: { name?: string; isDM?: boolean } | null) => {
    if (!room) return '#Chung';
    const prefix = room.isDM ? '@' : '#';
    return `${prefix}${room.name || 'Chung'}`;
  };

  const getRoomDisplayName = (room: { id: string; name: string; isDM: boolean }) => {
    if (!room.isDM) return room.name;
    return roomProfileMap[room.name]?.displayName || room.name;
  };

  const getRoomSubtitle = (room: { id: string; name: string; isDM: boolean }) => {
    if (!room.isDM) return room.id === 'chung' ? 'Kênh chung' : 'Nhóm chat';
    const username = roomProfileMap[room.name]?.username || room.name;
    return `@${username}`;
  };

  const getRoomLastMessage = (roomId: string) => {
    const lastMessage = [...allMessages]
      .filter(message => (message.roomId || 'chung') === roomId)
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0];

    if (!lastMessage) return 'Chưa có tin nhắn';
    if (lastMessage.msgType === 'poll') return lastMessage.pollData?.question || lastMessage.text || 'Bình chọn';
    if (lastMessage.fileData) return lastMessage.text || lastMessage.fileName || 'Tệp đính kèm';
    return lastMessage.text || 'Tin nhắn văn bản';
  };

  const getRoomTimeLabel = (roomId: string) => {
    const lastMessage = [...allMessages]
      .filter(message => (message.roomId || 'chung') === roomId)
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0];

    if (!lastMessage?.createdAt) return '';
    const createdAt = new Date(lastMessage.createdAt);
    if (Number.isNaN(createdAt.getTime())) return '';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));
    if (diffMinutes < 1) return 'Vừa xong';
    if (diffMinutes < 60) return `${diffMinutes} phút`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ`;
    return createdAt.toLocaleDateString('vi-VN');
  };

  const AttachmentView = ({ item }: { item: ChatMessage }) => {
    const [failed, setFailed] = useState(false);

    let uri = item.fileData as string;
    const kind = getAttachmentKind(item.fileType, item.fileName, uri);
    const inferredType = item.msgType || inferMessageType(item.fileType, item.fileName, uri);
    const isImageLike = kind === 'image' || inferredType === 'image';
    const isVideoLike = kind === 'video' || inferredType === 'video';

    if (uri && !uri.startsWith('http') && !uri.startsWith('https') && !uri.startsWith('data:')) {
      if (isImageLike) {
        uri = `data:${getImageMimeType(item.fileType, item.fileName)};base64,${item.fileData}`;
      } else if (isVideoLike) {
        uri = `data:${getVideoMimeType(item.fileType, item.fileName)};base64,${item.fileData}`;
      }
    }

    const handleOpenExternally = async () => {
      try {
        if (uri && await Linking.canOpenURL(uri)) {
          await Linking.openURL(uri);
        } else if (uri) {
          // Try http/https fallback
          const httpUri = uri.replace(/^file:\/\//, 'https://');
          if (await Linking.canOpenURL(httpUri)) await Linking.openURL(httpUri);
        }
      } catch {
        Alert.alert('Lỗi', 'Không thể mở video ngoài ứng dụng');
      }
    };

    return (
      <View style={styles.attachmentContainer}>
        {isImageLike ? (
          <Image source={{ uri }} style={styles.attachmentImage} />
        ) : isVideoLike ? (
          failed ? (
            <View style={[styles.attachmentVideoPlayer, { justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: '#fff', marginBottom: 8 }}>Không thể phát video</Text>
              <TouchableOpacity onPress={handleOpenExternally} style={{ backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: '#fff' }}>Mở video</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Video
              source={{ uri }}
              style={styles.attachmentVideoPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping={false}
              onError={() => setFailed(true)}
            />
          )
        ) : (
          <View style={styles.attachmentDocument}>
            <Ionicons name="document" size={32} color="#fff" />
            <Text style={styles.attachmentFileName}>{item.fileName || 'Document'}</Text>
          </View>
        )}
      </View>
    );
  };

  const jumpToMessage = (message: ChatMessage) => {
    const messageId = getMessageKey(message);
    if (!messageId) return;

    pendingPinnedJumpRef.current = messageId;
    setShowPinnedMessages(false);

    const targetRoomId = message.roomId || 'chung';
    if (targetRoomId !== activeRoomId) {
      scrollOnNextUpdateRef.current = true;
      setActiveRoomId(targetRoomId);
      return;
    }

    requestAnimationFrame(() => {
      const index = sortedMessages.findIndex(item => getMessageKey(item) === messageId);
      if (index < 0) return;

      try {
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.35 });
      } catch {
        flatListRef.current?.scrollToOffset({
          offset: Math.max(0, index * 120),
          animated: true,
        });
      }
    });
  };

  const handleDeleteForMe = async (message: ChatMessage) => {
    const messageId = getMessageKey(message);
    if (!activeUser?.username || !messageId) return;

    try {
      await axios.post(`${MESSAGE_API_BASE}/delete-for-me`, {
        username: activeUser.username,
        messageId,
      });

      setAllMessages(prev => prev.filter(item => getMessageKey(item) !== messageId));
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error deleting message for me:', error);
      Alert.alert('Lỗi', 'Không thể xóa tin nhắn');
    }
  };

  const handleClearCurrentRoomHistory = () => {
    if (!activeUser?.username || !activeRoomId) return;

    const roomLabel = getRoomLabel(rooms.find(room => room.id === activeRoomId) || { id: activeRoomId, name: activeRoomId, isDM: activeRoomId.startsWith('dm_') });

    Alert.alert(
      'Xóa lịch sử phòng',
      `Xóa toàn bộ lịch sử của ${roomLabel} trên thiết bị này?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.post(`${MESSAGE_API_BASE}/clear-history`, {
                username: activeUser.username,
                roomId: activeRoomId,
              });

              setAllMessages(prev => prev.filter(item => (item.roomId || 'chung') !== activeRoomId));
              setSelectedMessage(null);
            } catch (error) {
              console.error('Error clearing history:', error);
              Alert.alert('Lỗi', 'Không thể xóa lịch sử phòng');
            }
          },
        },
      ]
    );
  };

  const handleRecallMessage = async (message: ChatMessage) => {
    const messageId = getMessageKey(message);
    if (!activeUser?.username || !messageId) return;

    if (message.senderUsername && message.senderUsername !== activeUser.username) {
      Alert.alert('Lỗi', 'Chỉ có thể thu hồi tin nhắn của chính bạn');
      return;
    }

    try {
      revokeMessage(messageId);

      setAllMessages(prev => prev.map(item => {
        const itemKey = getMessageKey(item);
        if (itemKey !== messageId) return item;
        return {
          ...item,
          text: 'Tin nhắn này đã bị thu hồi',
          fileData: undefined,
          fileType: undefined,
          fileName: undefined,
          isRevoked: true,
        };
      }));
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error recalling message:', error);
      Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn');
    }
  };

  const handleReactToMessage = async (message: ChatMessage, emoji: string) => {
    const messageId = getMessageKey(message);
    if (!activeUser?.username || !messageId) return;

    const currentReaction = (message.reactions || []).find(item => item.username === activeUser.username)?.emoji;
    const nextEmoji = currentReaction === emoji ? null : emoji;

    try {
      await axios.post(`${MESSAGE_API_BASE}/react`, {
        messageId,
        username: activeUser.username,
        emoji: nextEmoji,
      });

      setAllMessages(prev => prev.map(item => {
        const itemId = getMessageKey(item);
        if (itemId !== messageId) return item;
        const baseReactions = (item.reactions || []).filter(reaction => reaction.username !== activeUser.username);
        return {
          ...item,
          reactions: nextEmoji ? [...baseReactions, { username: activeUser.username, emoji: nextEmoji }] : baseReactions,
        };
      }));
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error reacting to message:', error);
      Alert.alert('Lỗi', 'Không thể thả cảm xúc');
    }
  };

  const handleTogglePin = async (message: ChatMessage) => {
    const messageId = getMessageKey(message);
    if (!messageId) return;

    try {
      const nextPinned = !message.isPinned;
      await axios.post(`${MESSAGE_API_BASE}/pin`, {
        messageId,
        isPinned: nextPinned,
      });

      setAllMessages(prev => prev.map(item => {
        const itemId = getMessageKey(item);
        if (itemId !== messageId) return item;
        return {
          ...item,
          isPinned: nextPinned,
        };
      }));
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error pinning message:', error);
      Alert.alert('Lỗi', 'Không thể ghim tin nhắn');
    }
  };

  const openEditMessage = (message: ChatMessage) => {
    if (message.senderUsername !== activeUser?.username) {
      Alert.alert('Lỗi', 'Chỉ có thể sửa tin nhắn của chính bạn');
      return;
    }
    setEditingMessage(message);
    setSelectedMessage(null);
  };

  const handleSubmitEditMessage = async () => {
    if (!editingMessage || !activeUser?.username) return;
    const messageId = getMessageKey(editingMessage);
    const nextText = editMessageText.trim();

    if (!messageId || !nextText) {
      Alert.alert('Lỗi', 'Nội dung tin nhắn không hợp lệ');
      return;
    }

    setSavingEdit(true);
    try {
      editMessage(messageId, nextText);
      setAllMessages(prev => prev.map(item => {
        const itemId = getMessageKey(item);
        if (itemId !== messageId) return item;
        return {
          ...item,
          text: nextText,
          isEdited: true,
          editedAt: new Date().toISOString(),
        };
      }));
      setEditingMessage(null);
      setEditMessageText('');
    } catch (error) {
      console.error('Error editing message:', error);
      Alert.alert('Lỗi', 'Không thể sửa tin nhắn');
    } finally {
      setSavingEdit(false);
    }
  };

  const getReactionSummary = (reactions?: { username: string; emoji: string }[]) => {
    const reactionCount = new Map<string, number>();
    (reactions || []).forEach(item => {
      if (!item?.emoji) return;
      reactionCount.set(item.emoji, (reactionCount.get(item.emoji) || 0) + 1);
    });
    return Array.from(reactionCount.entries());
  };

  const handleEmojiSelect = (emoji: string) => {
    setMsgInput(prev => prev + emoji);
  };

  const renderRoomList = () => (
    <View style={styles.leftPanel}>
      <Text style={styles.leftHeader}>Kênh</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {rooms.map(room => (
          <TouchableOpacity
            key={room.id}
            style={[styles.roomItem, activeRoomId === room.id && styles.roomItemActive]}
            onPress={() => setActiveRoomId(room.id)}>
            <View style={styles.roomItemTopRow}>
              <View style={styles.roomAvatar}>
                <Text style={styles.roomAvatarText}>{getRoomDisplayName(room).slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.roomName, activeRoomId === room.id && styles.roomNameActive]} numberOfLines={1}>
                  {getRoomDisplayName(room)}
                </Text>
                <Text style={styles.roomSubtitle} numberOfLines={1}>{getRoomSubtitle(room)}</Text>
              </View>
            </View>
            <Text style={styles.roomPreview} numberOfLines={1}>{getRoomLastMessage(room.id)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.leftFooterActions}>
        <TouchableOpacity style={styles.smallNavBtn} onPress={() => router.push('/(tabs)/friends')}>
          <Text style={styles.smallNavText}>Bạn bè</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallNavBtn} onPress={() => router.push('/(tabs)/explore')}>
          <Text style={styles.smallNavText}>Discovery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRightSidebar = () => (
    <View style={styles.rightPanel}>
      <Text style={styles.rightTitle}>Thành viên</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {participants.map(name => (
          <View key={name} style={styles.memberItem}>
            <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
            <Text style={styles.memberName}>{name}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeScreen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.header} numberOfLines={1}>
                {getRoomDisplayName(rooms.find(r => r.id === activeRoomId) || { id: 'chung', name: 'Chung', isDM: false })}
              </Text>
              <Text style={styles.headerSubtext} numberOfLines={1}>
                {getRoomSubtitle(rooms.find(r => r.id === activeRoomId) || { id: 'chung', name: 'Chung', isDM: false })}
              </Text>
            </View>
            <View style={styles.topActions}>
                <TouchableOpacity style={styles.topActionButton} onPress={() => setShowSearch(s => !s)}>
                <Text style={styles.topActionText}>Search</Text>
              </TouchableOpacity>
                <TouchableOpacity style={styles.topActionButton} onPress={() => setShowRoomsList(true)}>
                  <Text style={styles.topActionText}>Chats</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.topActionButton} onPress={handleClearCurrentRoomHistory}>
                  <Text style={styles.topActionText}>Clear</Text>
                </TouchableOpacity>
              {!isWide && (
                <TouchableOpacity style={styles.topActionButton} onPress={() => setShowMembersModal(true)}>
                  <Text style={styles.topActionText}>Members</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {showSearch && (
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm tin nhắn hoặc username..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          )}

          {!!latestPinnedMessage && (
            <TouchableOpacity style={styles.pinnedTopStrip} activeOpacity={0.9} onPress={() => setShowPinnedMessages(true)}>
              <View style={styles.pinnedTopLeft}>
                <Ionicons name="pin" size={14} color="#4338ca" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinnedTopLabel}>TIN GHIM MỚI NHẤT - @{latestPinnedMessage.senderUsername || 'unknown'}</Text>
                  <Text style={styles.pinnedTopText} numberOfLines={1}>
                    {latestPinnedMessage.msgType === 'poll'
                      ? latestPinnedMessage.pollData?.question || latestPinnedMessage.text || 'Bình chọn'
                      : latestPinnedMessage.text || latestPinnedMessage.fileName || 'Tin ghim'}
                  </Text>
                </View>
              </View>
              <View style={styles.pinnedTopCountWrap}>
                <Text style={styles.pinnedTopCount}>+{pinnedMessages.length} ghim</Text>
                <Ionicons name="chevron-forward" size={16} color="#4338ca" />
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.mainContentRow}>
            {isWide && renderRoomList()}

            <View style={styles.centerPanel}>
              {/* Mobile room chips removed — use Chats modal instead */}

              {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
                <FlatList
                  ref={flatListRef}
                  data={sortedMessages}
                  keyExtractor={(item, index) => item.messageId || item.id || `${item.senderUsername || 'msg'}-${item.createdAt || index}-${index}`}
                  onScrollToIndexFailed={({ index }) => {
                    flatListRef.current?.scrollToOffset({
                      offset: Math.max(0, index * 120),
                      animated: true,
                    });
                    setTimeout(() => {
                      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.35 });
                    }, 120);
                  }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onLongPress={() => setSelectedMessage(item)}
                      delayLongPress={220}
                      style={[
                        styles.message,
                        item.msgType === 'poll' && styles.messagePoll,
                        (item.senderUsername) === activeUser?.username ? styles.myMsg : styles.otherMsg,
                      ]}>
                      <View style={styles.messageHeaderRow}>
                        <Text style={styles.sender}>{item.senderUsername || 'Unknown'}</Text>
                        {item.isPinned && (
                          <View style={styles.pinnedBadge}>
                            <Ionicons name="bookmark" size={12} color="#facc15" />
                            <Text style={styles.pinnedBadgeText}>Đã ghim</Text>
                          </View>
                        )}
                      </View>
                      {item.forwardedFrom ? <Text style={styles.forwardedLabel}>Chuyển tiếp từ @{item.forwardedFrom}</Text> : null}
                      {item.msgType === 'poll' && item.pollData ? (
                        <View style={styles.pollCard}>
                          <View style={styles.pollHeaderRow}>
                            <View style={styles.pollIconWrap}>
                              <Ionicons name="bar-chart" size={16} color="#10b981" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.pollQuestion}>{item.pollData.question || item.text || 'Bình chọn'}</Text>
                              <Text style={styles.pollSubtitle}>Thăm dò ý kiến</Text>
                            </View>
                          </View>
                          <View style={styles.pollOptionList}>
                            {(() => {
                              const totalVotes = (item.pollData?.options || []).reduce((sum, option) => sum + (option.votes?.length || 0), 0);
                              return (item.pollData.options || []).map((option, optionIndex) => {
                                const voteCount = option.votes?.length || 0;
                                const percent = totalVotes === 0 ? 0 : Math.round((voteCount / totalVotes) * 100);
                                const voted = option.votes?.includes(activeUser?.username || '') || false;
                                return (
                                  <TouchableOpacity key={`${getMessageKey(item)}-${optionIndex}`} style={styles.pollOptionBtn} onPress={() => handleVotePoll(item, optionIndex)} activeOpacity={0.85}>
                                    <View style={styles.pollOptionTopRow}>
                                      <View style={[styles.pollRadio, voted && styles.pollRadioActive]}>
                                        {voted ? <View style={styles.pollRadioDot} /> : null}
                                      </View>
                                      <Text style={[styles.pollOptionText, voted && styles.pollOptionTextActive]}>{option.text || `Lựa chọn ${optionIndex + 1}`}</Text>
                                      <Text style={styles.pollOptionCount}>{percent}%</Text>
                                    </View>
                                    <View style={styles.pollProgressTrack}>
                                      <View style={[styles.pollProgressFill, { width: `${percent}%` }, voted && styles.pollProgressFillActive]} />
                                    </View>
                                  </TouchableOpacity>
                                );
                              });
                            })()}
                          </View>
                          <Text style={styles.pollFooterText}>
                            {(item.pollData.options || []).reduce((sum, option) => sum + (option.votes?.length || 0), 0)} lượt bình chọn
                          </Text>
                        </View>
                      ) : null}
                      
                      {/* File attachment preview */}
                      {item.fileData && !item.isRevoked && (item.fileType || item.fileName || item.fileData) && (
                        <AttachmentView item={item} />
                      )}
                      
                      {/* Message text */}
                      {item.text && (
                        <Text style={[styles.contentText, item.isRevoked && styles.revokedText]}>
                          {item.text}
                          {item.isEdited ? <Text style={styles.editedLabel}> (đã sửa)</Text> : null}
                        </Text>
                      )}

                      {getReactionSummary(item.reactions).length > 0 && (
                        <View style={styles.reactionRow}>
                          {getReactionSummary(item.reactions).map(([emoji, count]) => (
                            <TouchableOpacity
                              key={`${getMessageKey(item)}-${emoji}`}
                              style={styles.reactionChip}
                              onPress={() => handleReactToMessage(item, emoji)}
                            >
                              <Text style={styles.reactionChipText}>{emoji} {count}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <View style={styles.messageFooterRow}>
                        <Text style={styles.time}>{new Date(item.createdAt || '').toLocaleString('vi-VN')}</Text>
                        {item.senderUsername === activeUser?.username && (
                          <Text style={styles.receiptText}>
                            {(item.readBy || []).length > 1 ? 'Đã xem' : (item.deliveredTo || []).length > 1 ? 'Đã nhận' : 'Đang gửi'}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.emptyText}>Không có tin nhắn trong kênh này</Text>}
                />
              )}

              {/* Attachment preview */}
              {attachmentPreview && (
                <View style={styles.previewContainer}>
                  <View style={styles.previewContent}>
                    {getAttachmentKind(attachmentPreview.type, attachmentPreview.name) === 'image' ? (
                      <Image source={{ uri: attachmentPreview.uri }} style={styles.previewImage} />
                    ) : getAttachmentKind(attachmentPreview.type, attachmentPreview.name) === 'video' ? (
                      previewVideoFailed ? (
                        <View style={[styles.previewVideoPlayer, { justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ color: '#64748b', marginBottom: 8 }}>Không thể phát video</Text>
                          <TouchableOpacity onPress={async () => {
                            try {
                              if (attachmentPreview?.uri && await Linking.canOpenURL(attachmentPreview.uri)) {
                                await Linking.openURL(attachmentPreview.uri);
                              }
                            } catch {
                              Alert.alert('Lỗi', 'Không thể mở video');
                            }
                          }} style={{ backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                            <Text style={{ color: '#fff' }}>Mở video</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Video
                          source={{ uri: attachmentPreview.uri }}
                          style={styles.previewVideoPlayer}
                          useNativeControls
                          resizeMode={ResizeMode.CONTAIN}
                          isLooping={false}
                          onError={() => setPreviewVideoFailed(true)}
                          onLoad={() => setPreviewVideoFailed(false)}
                        />
                      )
                    ) : (
                      <View style={styles.previewDocument}>
                        <Ionicons name="document" size={24} color="#fff" />
                        <Text style={styles.previewFileName}>{attachmentPreview.name}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setAttachmentPreview(null)} style={styles.previewRemoveBtn}>
                    <Text style={{ color: '#fff', fontSize: 18 }}>×</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Input row */}
              <View style={styles.inputRow}>
                <TouchableOpacity 
                  style={styles.iconBtn} 
                  onPress={() => setShowFileMenu(!showFileMenu)}
                  disabled={sending}
                >
                  <Ionicons name="attach" size={20} color="#6366f1" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.iconBtn} 
                  onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={sending}
                >
                  <Ionicons name="happy-outline" size={22} color="#6366f1" />
                </TouchableOpacity>

                <TextInput
                  style={styles.input}
                  placeholder="Nhập tin nhắn..."
                  value={msgInput}
                  onChangeText={setMsgInput}
                  onSubmitEditing={handleSend}
                  multiline
                  editable={!sending}
                  placeholderTextColor="#94a3b8"
                />

                <TouchableOpacity 
                  style={[styles.sendBtn, sending && styles.sendBtnDisabled]} 
                  onPress={handleSend}
                  disabled={sending || (!msgInput.trim() && !attachmentPreview)}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Gửi</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* File menu modal */}
            <Modal visible={showFileMenu} transparent animationType="fade" onRequestClose={() => setShowFileMenu(false)}>
              <View style={styles.modalBackdrop}>
                <View style={styles.fileMenuCard}>
                  <TouchableOpacity style={styles.menuItem} onPress={() => handleAttachImage('camera')}>
                    <Ionicons name="camera" size={24} color="#6366f1" />
                    <Text style={styles.menuItemText}>Chụp ảnh</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => handleAttachImage('gallery')}>
                    <Ionicons name="images" size={24} color="#6366f1" />
                    <Text style={styles.menuItemText}>Chọn ảnh</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={handleAttachGif}>
                    <Ionicons name="film-outline" size={24} color="#6366f1" />
                    <Text style={styles.menuItemText}>Chọn GIF Tenor</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={handleAttachVideo}>
                    <Ionicons name="videocam" size={24} color="#6366f1" />
                    <Text style={styles.menuItemText}>Chọn video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={handleAttachFile}>
                    <Ionicons name="document" size={24} color="#6366f1" />
                    <Text style={styles.menuItemText}>Chọn file</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setShowPollModal(true); setShowFileMenu(false); }}>
                    <Ionicons name="list-outline" size={24} color="#6366f1" />
                    <Text style={styles.menuItemText}>Tạo bình chọn</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.menuItem, styles.cancelBtn]} onPress={() => setShowFileMenu(false)}>
                    <Text style={styles.menuItemTextCancel}>Hủy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <Modal visible={showGifPicker} transparent animationType="slide" onRequestClose={() => setShowGifPicker(false)}>
              <View style={styles.modalBackdrop}>
                <View style={styles.gifPickerCard}>
                  <View style={styles.gifPickerHeader}>
                    <View>
                      <Text style={styles.gifPickerTitle}>Biểu cảm & GIF</Text>
                      <Text style={styles.gifPickerSubtitle}>GIF Tenor</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowGifPicker(false)}>
                      <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.gifSearchBar}>
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <TextInput
                      style={styles.gifSearchInput}
                      value={gifSearchQuery}
                      onChangeText={setGifSearchQuery}
                      placeholder="Tìm kiếm GIF trên Tenor..."
                      placeholderTextColor="#94a3b8"
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                  </View>

                  {gifLoading ? (
                    <View style={styles.gifLoadingState}>
                      <ActivityIndicator color="#6366f1" />
                    </View>
                  ) : gifItems.length > 0 ? (
                    <ScrollView contentContainerStyle={styles.gifGrid} showsVerticalScrollIndicator={false}>
                      {gifItems.map(item => (
                        <TouchableOpacity
                          key={item.url}
                          style={styles.gifTile}
                          onPress={() => handleSelectGif(item.url)}
                          activeOpacity={0.85}
                        >
                          <Image source={{ uri: item.previewUrl }} style={styles.gifImage} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.gifEmptyState}>
                      <Text style={styles.gifEmptyText}>Không tìm thấy GIF nào.</Text>
                    </View>
                  )}
                </View>
              </View>
            </Modal>

            {/* Emoji picker modal */}
            <Modal visible={showEmojiPicker} transparent animationType="slide" onRequestClose={() => setShowEmojiPicker(false)}>
              <View style={styles.emojiPickerModal}>
                <View style={styles.emojiPickerHeader}>
                  <Text style={styles.emojiPickerTitle}>Bộ lọc Emoji</Text>
                  <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                    <Ionicons name="close" size={24} color="#e2e8f0" />
                  </TouchableOpacity>
                </View>

                {/* Common emojis */}
                <View style={styles.emojiSection}>
                  <Text style={styles.emojiSectionTitle}>Phổ biến</Text>
                  <View style={styles.emojiGrid}>
                    {COMMON_EMOJIS.map((emoji, i) => (
                      <TouchableOpacity 
                        key={i} 
                        style={styles.emojiButton}
                        onPress={() => handleEmojiSelect(emoji)}
                      >
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Categorized emojis */}
                <ScrollView style={styles.emojiScrollView}>
                  {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                    <View key={category} style={styles.emojiSection}>
                      <Text style={styles.emojiSectionTitle}>
                        {category === 'smileys' ? 'Mặt cười' : 
                         category === 'hearts' ? 'Trái tim' : 
                         category === 'hand' ? 'Bàn tay' : 
                         category === 'animals' ? 'Động vật' : 
                         category === 'food' ? 'Thức ăn' : 
                         category === 'activity' ? 'Hoạt động' : 
                         category === 'travel' ? 'Du lịch' : 'Đối tượng'}
                      </Text>
                      <View style={styles.emojiGrid}>
                        {emojis.slice(0, 12).map((emoji, i) => (
                          <TouchableOpacity 
                            key={i} 
                            style={styles.emojiButton}
                            onPress={() => {
                              handleEmojiSelect(emoji);
                              setShowEmojiPicker(false);
                            }}
                          >
                            <Text style={styles.emojiText}>{emoji}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </Modal>

            {isWide && renderRightSidebar()}
          </View>
        </View>

        <Modal visible={showMembersModal} transparent animationType="slide" onRequestClose={() => setShowMembersModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Thành viên</Text>
              <ScrollView>
                {participants.map(name => (
                  <View key={name} style={styles.memberItem}>
                    <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
                    <Text style={styles.memberName}>{name}</Text>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowMembersModal(false)}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showRoomsList} transparent animationType="slide" onRequestClose={() => setShowRoomsList(false)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.roomsListCard}>
              <View style={styles.pinnedListHeader}>
                <Text style={styles.messageActionTitle}>Danh sách cuộc trò chuyện</Text>
                <TouchableOpacity onPress={() => setShowRoomsList(false)}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {rooms.map(room => (
                  <TouchableOpacity
                    key={room.id}
                    style={[styles.roomListItem, activeRoomId === room.id && styles.roomListItemActive]}
                    onPress={() => { setActiveRoomId(room.id); setShowRoomsList(false); scrollOnNextUpdateRef.current = true; }}>
                    <View style={styles.roomListMetaRow}>
                      <View style={styles.roomListAvatar}>
                        <Text style={styles.roomListAvatarText}>{getRoomDisplayName(room).slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.roomListTitleRow}>
                          <Text style={[styles.roomListItemText, activeRoomId === room.id && styles.roomListItemTextActive]} numberOfLines={1}>
                            {getRoomDisplayName(room)}
                          </Text>
                          {!!getRoomTimeLabel(room.id) && <Text style={styles.roomListTime}>{getRoomTimeLabel(room.id)}</Text>}
                        </View>
                        <Text style={styles.roomListSubtitle} numberOfLines={1}>{getRoomSubtitle(room)}</Text>
                        <Text style={styles.roomListPreview} numberOfLines={2}>{getRoomLastMessage(room.id)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={() => setSelectedMessage(null)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.messageActionCard}>
              <Text style={styles.messageActionTitle}>Tùy chọn tin nhắn</Text>
              <View style={styles.quickReactionRow}>
                {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.quickReactionBtn}
                    onPress={() => {
                      if (selectedMessage) {
                        handleReactToMessage(selectedMessage, emoji);
                      }
                    }}
                  >
                    <Text style={styles.quickReactionText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.messageActionBtn}
                onPress={() => {
                  if (selectedMessage) {
                    handleTogglePin(selectedMessage);
                  }
                }}>
                <Ionicons name="bookmark-outline" size={18} color="#0ea5e9" />
                <Text style={styles.messageActionBtnTextInfo}>{selectedMessage?.isPinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.messageActionBtn}
                onPress={() => {
                  if (selectedMessage) {
                    openForwardMessage(selectedMessage);
                  }
                }}>
                <Ionicons name="share-social-outline" size={18} color="#7c3aed" />
                <Text style={styles.messageActionBtnTextInfo}>Chuyển tiếp</Text>
              </TouchableOpacity>

              {selectedMessage?.senderUsername === activeUser?.username && !selectedMessage?.isRevoked && (
                <TouchableOpacity
                  style={styles.messageActionBtn}
                  onPress={() => {
                    if (selectedMessage) {
                      openEditMessage(selectedMessage);
                    }
                  }}>
                  <Ionicons name="create-outline" size={18} color="#2563eb" />
                  <Text style={styles.messageActionBtnTextInfo}>Sửa tin nhắn</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.messageActionBtn}
                onPress={() => {
                  if (selectedMessage) {
                    handleRecallMessage(selectedMessage);
                  }
                }}>
                <Ionicons name="refresh-outline" size={18} color="#f97316" />
                <Text style={styles.messageActionBtnTextWarn}>Thu hồi cho mọi người</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageActionBtn}
                onPress={() => {
                  if (selectedMessage) {
                    handleDeleteForMe(selectedMessage);
                  }
                }}>
                <Ionicons name="eye-off-outline" size={18} color="#475569" />
                <Text style={styles.messageActionBtnTextMuted}>Ẩn với tôi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.messageActionBtn, styles.messageActionCancel]} onPress={() => setSelectedMessage(null)}>
                <Text style={styles.messageActionCancelText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={!!editingMessage} transparent animationType="fade" onRequestClose={() => setEditingMessage(null)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.editMessageCard}>
              <Text style={styles.messageActionTitle}>Sửa tin nhắn</Text>
              <TextInput
                style={styles.editInput}
                value={editMessageText}
                onChangeText={setEditMessageText}
                placeholder="Nhập nội dung mới..."
                multiline
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.editActionRow}>
                <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditingMessage(null)}>
                  <Text style={styles.editCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editSaveBtn} onPress={handleSubmitEditMessage} disabled={savingEdit || !editMessageText.trim()}>
                  {savingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.editSaveText}>Lưu</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showPollModal} transparent animationType="fade" onRequestClose={() => setShowPollModal(false)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.pollCreateCard}>
              <Text style={styles.messageActionTitle}>Tạo bình chọn</Text>
              <TextInput
                style={styles.pollInput}
                value={pollQuestion}
                onChangeText={setPollQuestion}
                placeholder="Câu hỏi bình chọn"
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.pollOptionEditorList}>
                {pollOptions.map((option, index) => (
                  <View key={index} style={styles.pollOptionEditorRow}>
                    <TextInput
                      style={styles.pollOptionEditorInput}
                      value={option}
                      onChangeText={value => updatePollOption(index, value)}
                      placeholder={`Lựa chọn ${index + 1}`}
                      placeholderTextColor="#94a3b8"
                    />
                    {pollOptions.length > 2 ? (
                      <TouchableOpacity style={styles.pollOptionRemoveBtn} onPress={() => removePollOption(index)}>
                        <Ionicons name="close" size={14} color="#ef4444" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.pollOptionAddBtn} onPress={addPollOption} disabled={pollOptions.length >= 10}>
                <Ionicons name="add" size={14} color="#0ea5e9" />
                <Text style={styles.pollOptionAddText}>Thêm lựa chọn</Text>
              </TouchableOpacity>
              <View style={styles.editActionRow}>
                <TouchableOpacity style={styles.editCancelBtn} onPress={() => setShowPollModal(false)}>
                  <Text style={styles.editCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editSaveBtn} onPress={handleCreatePoll} disabled={!pollQuestion.trim()}>
                  <Text style={styles.editSaveText}>Đăng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showForwardModal} transparent animationType="fade" onRequestClose={() => setShowForwardModal(false)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.pollCreateCard}>
              <Text style={styles.messageActionTitle}>Chuyển tiếp tin nhắn</Text>
              <ScrollView style={{ maxHeight: 280 }}>
                {rooms.filter(room => room.id !== activeRoomId).map(room => (
                  <TouchableOpacity key={room.id} style={[styles.forwardRoomItem, forwardTargetRoom === room.id && styles.forwardRoomItemActive]} onPress={() => setForwardTargetRoom(room.id)}>
                    <Text style={[styles.forwardRoomText, forwardTargetRoom === room.id && styles.forwardRoomTextActive]}>{getRoomLabel(room)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.editActionRow}>
                <TouchableOpacity style={styles.editCancelBtn} onPress={() => setShowForwardModal(false)}>
                  <Text style={styles.editCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editSaveBtn} onPress={handleForwardMessage} disabled={!forwardTargetRoom}>
                  <Text style={styles.editSaveText}>Gửi</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showPinnedMessages} transparent animationType="fade" onRequestClose={() => setShowPinnedMessages(false)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.pinnedListCard}>
              <View style={styles.pinnedListHeader}>
                <Text style={styles.messageActionTitle}>Danh sách tất cả tin ghim ({pinnedMessages.length})</Text>
                <TouchableOpacity onPress={() => setShowPinnedMessages(false)}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 380 }}>
                {pinnedMessages.map(message => (
                  <TouchableOpacity
                    key={getMessageKey(message)}
                    style={styles.pinnedListItem}
                    activeOpacity={0.85}
                    onPress={() => jumpToMessage(message)}>
                    <Text style={styles.pinnedListSender}>@{message.senderUsername || 'unknown'}</Text>
                    <Text style={styles.pinnedListText} numberOfLines={2}>
                      {message.msgType === 'poll'
                        ? message.pollData?.question || message.text || 'Bình chọn'
                        : message.text || message.fileName || 'Tin ghim'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  header: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  headerSubtext: { color: '#64748b', fontSize: 11, fontWeight: '700', marginTop: 2 },
  topActions: { flexDirection: 'row', gap: 8 },
  topActionButton: { backgroundColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  topActionText: { color: '#475569', fontWeight: '700', fontSize: 12 },
  searchInput: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 10,
    color: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  mainContentRow: { flex: 1, flexDirection: 'row', gap: 10 },
  leftPanel: { width: 220, backgroundColor: '#fff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  leftHeader: { color: '#0ea5e9', fontWeight: '800', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  roomItem: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, marginBottom: 8, backgroundColor: '#f1f5f9' },
  roomItemActive: { backgroundColor: '#3b82f6' },
  roomItemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  roomAvatar: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  roomAvatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  roomName: { color: '#475569', fontWeight: '800', fontSize: 13, lineHeight: 16 },
  roomNameActive: { color: '#fff' },
  roomSubtitle: { color: '#64748b', fontSize: 10, fontWeight: '700', lineHeight: 12 },
  roomPreview: { color: '#94a3b8', fontSize: 11, lineHeight: 14 },
  leftFooterActions: { marginTop: 10, gap: 8 },
  smallNavBtn: { backgroundColor: '#e2e8f0', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  smallNavText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  centerPanel: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 10, flexDirection: 'column', borderWidth: 1, borderColor: '#e2e8f0' },
  mobileRoomScroller: { marginBottom: 8, maxHeight: 40 },
  roomChip: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  roomChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  roomChipText: { color: '#475569', fontWeight: '700', fontSize: 12 },
  roomChipTextActive: { color: '#fff' },
  message: { padding: 10, borderRadius: 10, marginVertical: 4, maxWidth: '84%' },
  messagePoll: { maxWidth: '92%' },
  myMsg: { backgroundColor: '#3b82f6', alignSelf: 'flex-end' },
  otherMsg: { backgroundColor: '#e2e8f0', alignSelf: 'flex-start' },
  messageHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sender: { fontWeight: '800', fontSize: 11, color: '#0ea5e9', marginBottom: 2 },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(250, 204, 21, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pinnedBadgeText: { color: '#facc15', fontSize: 11, fontWeight: '700' },
  forwardedLabel: { color: '#7c3aed', fontSize: 11, fontWeight: '700', marginTop: 2, marginBottom: 4 },
  pollCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    gap: 10,
    width: '100%',
    minWidth: 280,
    alignSelf: 'stretch',
  },
  pollHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pollIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  pollQuestion: { color: '#0f172a', fontWeight: '800', fontSize: 15, lineHeight: 20 },
  pollSubtitle: { color: '#64748b', fontSize: 11, fontWeight: '700', marginTop: 2 },
  pollOptionList: { gap: 8 },
  pollOptionBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#dbe4ff',
    gap: 8,
  },
  pollOptionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  pollRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollRadioActive: { borderColor: '#10b981', backgroundColor: '#10b981' },
  pollRadioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  pollOptionText: { color: '#1e293b', fontWeight: '700', flex: 1, flexShrink: 1, paddingRight: 6 },
  pollOptionTextActive: { fontWeight: '800', color: '#111827' },
  pollOptionCount: { color: '#4338ca', fontWeight: '800', minWidth: 34, textAlign: 'right' },
  pollProgressTrack: { height: 8, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  pollProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#c7d2fe' },
  pollProgressFillActive: { backgroundColor: '#a7f3d0' },
  pollFooterText: { color: '#64748b', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  contentText: { color: '#1e293b', marginVertical: 4 },
  editedLabel: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic' },
  revokedText: { color: '#64748b', fontStyle: 'italic' },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  reactionChip: { backgroundColor: 'rgba(15, 23, 42, 0.08)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  reactionChipText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  messageFooterRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 10, color: '#64748b', alignSelf: 'flex-end', marginTop: 4 },
  receiptText: { color: '#dbeafe', fontSize: 10, fontWeight: '700' },
  attachmentContainer: { marginVertical: 8, borderRadius: 8, overflow: 'hidden', maxWidth: 200 },
  attachmentImage: { width: 200, height: 150, borderRadius: 8 },
  attachmentDocument: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 80, borderWidth: 1, borderColor: '#cbd5e1' },
  attachmentVideoPlayer: { width: 240, height: 170, backgroundColor: '#000' },
  attachmentFileName: { color: '#475569', fontSize: 12, marginTop: 8, textAlign: 'center' },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: 16 },
  previewContainer: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  previewContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  previewImage: { width: 60, height: 60, borderRadius: 8 },
  previewDocument: { width: 60, height: 60, backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  previewVideoPlayer: { width: 120, height: 80, backgroundColor: '#000', borderRadius: 8 },
  previewFileName: { color: '#475569', fontSize: 11, marginLeft: 8, flex: 1 },
  previewRemoveBtn: { backgroundColor: '#ef4444', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 8, gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  input: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 10, fontSize: 14, color: '#1e293b', maxHeight: 100, borderWidth: 1, borderColor: '#cbd5e1' },
  sendBtn: { backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#cbd5e1', opacity: 0.5 },
  rightPanel: { width: 220, backgroundColor: '#fff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  rightTitle: { color: '#f87171', fontWeight: '800', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  memberItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  memberAvatar: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#fff', fontWeight: '800' },
  memberName: { color: '#1e293b', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalBackdropCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { maxHeight: '60%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  modalTitle: { color: '#1e293b', fontWeight: '800', fontSize: 18, marginBottom: 10 },
  closeModalBtn: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  messageActionCard: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 10 },
  messageActionTitle: { color: '#1e293b', fontWeight: '800', fontSize: 18, marginBottom: 4 },
  pinnedTopStrip: {
    marginHorizontal: 10,
    marginBottom: 8,
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedTopLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 12,
  },
  pinnedTopLabel: {
    color: '#4338ca',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  pinnedTopText: {
    color: '#1e1b4b',
    fontSize: 12,
    fontWeight: '600',
  },
  pinnedTopCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedTopCount: {
    color: '#4338ca',
    fontSize: 12,
    fontWeight: '700',
  },
  roomsListCard: { width: '92%', maxHeight: '82%', backgroundColor: '#fff', borderRadius: 18, padding: 10 },
  roomListItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomColor: '#eef2f7',
    borderBottomWidth: 1,
  },
  roomListItemActive: { backgroundColor: '#eef2ff' },
  roomListMetaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  roomListAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  roomListAvatarText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  roomListTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  roomListItemText: { color: '#0f172a', fontWeight: '800', fontSize: 15, flex: 1 },
  roomListItemTextActive: { color: '#1e293b' },
  roomListSubtitle: { color: '#64748b', fontSize: 11, fontWeight: '700', marginTop: 2 },
  roomListPreview: { color: '#334155', fontSize: 12, marginTop: 4, lineHeight: 16 },
  roomListTime: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  quickReactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  quickReactionBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: 12 },
  quickReactionText: { fontSize: 20 },
  messageActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#f8fafc' },
  messageActionBtnTextDanger: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  messageActionBtnTextWarn: { color: '#f97316', fontWeight: '700', fontSize: 14 },
  messageActionBtnTextMuted: { color: '#475569', fontWeight: '700', fontSize: 14 },
  messageActionBtnTextInfo: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  messageActionCancel: { backgroundColor: '#e2e8f0', justifyContent: 'center' },
  messageActionCancelText: { color: '#475569', fontWeight: '700', fontSize: 14, textAlign: 'center', width: '100%' },
  editMessageCard: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 12 },
  editInput: { minHeight: 100, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 10, color: '#1e293b', textAlignVertical: 'top' },
  editActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  editCancelBtn: { backgroundColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  editCancelText: { color: '#475569', fontWeight: '700' },
  editSaveBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, minWidth: 72, alignItems: 'center' },
  editSaveText: { color: '#fff', fontWeight: '700' },
  pollCreateCard: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 12 },
  pinnedListCard: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 12 },
  pinnedListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pinnedListItem: { padding: 12, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  pinnedListSender: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  pinnedListText: { color: '#0f172a', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  pollInput: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 10, color: '#1e293b' },
  pollOptionEditorList: { gap: 8 },
  pollOptionEditorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollOptionEditorInput: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 10, color: '#1e293b' },
  pollOptionRemoveBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fee2e2' },
  pollOptionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 2 },
  pollOptionAddText: { color: '#0ea5e9', fontWeight: '700' },
  forwardRoomItem: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 8 },
  forwardRoomItemActive: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
  forwardRoomText: { color: '#1e293b', fontWeight: '700' },
  forwardRoomTextActive: { color: '#1d4ed8' },
  fileMenuCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#f1f5f9' },
  menuItemText: { color: '#1e293b', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  menuItemTextCancel: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  cancelBtn: { backgroundColor: '#ef4444' },
  gifPickerCard: { flex: 1, backgroundColor: '#fff', marginTop: 48, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 20 },
  gifPickerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  gifPickerTitle: { color: '#1e293b', fontWeight: '800', fontSize: 18 },
  gifPickerSubtitle: { color: '#6366f1', fontWeight: '700', fontSize: 12, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  gifSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  gifSearchInput: { flex: 1, color: '#1e293b', fontSize: 14 },
  gifLoadingState: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  gifGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  gifTile: { width: '31%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  gifImage: { width: '100%', height: '100%' },
  gifEmptyState: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  gifEmptyText: { color: '#64748b', fontWeight: '600' },
  emojiPickerModal: { flex: 1, backgroundColor: '#fff', marginTop: 40 },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  emojiPickerTitle: { color: '#1e293b', fontWeight: '800', fontSize: 18 },
  emojiSection: { paddingHorizontal: 12, marginVertical: 12 },
  emojiSectionTitle: { color: '#475569', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  emojiButton: { width: '23%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: 10 },
  emojiText: { fontSize: 24 },
  emojiScrollView: { flex: 1 },
});
