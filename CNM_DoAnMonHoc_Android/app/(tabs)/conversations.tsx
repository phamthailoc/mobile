import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';

import SafeScreen from '@/components/safe-screen';
import { API_BASE_URL } from '@/constants/api';
import { useUserContext } from '@/context/user-context';

type RoomItem = {
    id: string;
    name: string;
    isDM: boolean;
    peerUsername?: string;
    lastMessage?: string;
    lastAt?: string;
    subtitle?: string;
};

export default function ChatListScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ roomId?: string; roomName?: string }>();
    const { user } = useUserContext();
    const [loading, setLoading] = useState(true);
    const [rooms, setRooms] = useState<RoomItem[]>([]);

    useEffect(() => {
        if (typeof params.roomId === 'string' && params.roomId) {
            const query = `roomId=${encodeURIComponent(params.roomId)}${typeof params.roomName === 'string' && params.roomName ? `&roomName=${encodeURIComponent(params.roomName)}` : ''}`;
            router.replace(`/chat?${query}`);
        }
    }, [params.roomId, params.roomName, router]);

    useEffect(() => {
        let isMounted = true;

        const loadRooms = async () => {
            if (!user?.username) return;
            setLoading(true);

            try {
                const [messagesRes, groupsRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/v1/messages/${user.username}`),
                    axios.get(`${API_BASE_URL}/api/groups/all`),
                ]);

                const messageSource = Array.isArray(messagesRes.data) ? messagesRes.data : (messagesRes.data?.messages || []);
                const groups = Array.isArray(groupsRes.data) ? groupsRes.data : [];

                const roomMap = new Map<string, RoomItem>();

                groups.forEach((group: any) => {
                    const groupId = group.groupId || group.id;
                    if (!groupId) return;

                    const canSeeGroup =
                        group.isPublic ||
                        group.owner === user.username ||
                        (group.members || []).includes(user.username) ||
                        user?.role === 'admin';

                    if (!canSeeGroup) return;

                    roomMap.set(groupId, {
                        id: groupId,
                        name: group.groupName || group.name || groupId,
                        isDM: false,
                        subtitle: 'Nhóm chat',
                    });
                });

                messageSource.forEach((msg: any) => {
                    const roomId = msg.roomId;
                    if (!roomId) return;

                    const current = roomMap.get(roomId);
                    const previewText = msg.isRevoked
                        ? 'Tin nhắn này đã bị thu hồi'
                        : msg.msgType === 'poll'
                            ? msg.pollData?.question || msg.text || 'Bình chọn'
                            : msg.msgType === 'sticker'
                                ? 'Sticker'
                                : msg.fileData
                                    ? (msg.text || msg.fileName || 'Tệp đính kèm')
                                    : (msg.text || 'Tin nhắn văn bản');

                    if (roomId.startsWith('dm_')) {
                        const peer = roomId.replace('dm_', '').split('_').find((p: string) => p !== user.username) || roomId;
                        roomMap.set(roomId, {
                            id: roomId,
                            name: peer,
                            peerUsername: peer,
                            isDM: true,
                            subtitle: `@${peer}`,
                            lastMessage: previewText,
                            lastAt: msg.createdAt || msg.sentAt || msg.time,
                        });
                    } else {
                        roomMap.set(roomId, {
                            ...(current || { id: roomId, name: roomId, isDM: false, subtitle: 'Nhóm chat' }),
                            lastMessage: previewText,
                            lastAt: msg.createdAt || msg.sentAt || msg.time,
                        });
                    }
                });

                const nextRooms = Array.from(roomMap.values()).sort((left, right) => {
                    const leftTime = new Date(left.lastAt || 0).getTime();
                    const rightTime = new Date(right.lastAt || 0).getTime();
                    return rightTime - leftTime;
                });

                if (isMounted) setRooms(nextRooms);
            } catch (error) {
                console.error('Error loading chat rooms:', error);
                if (isMounted) setRooms([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        void loadRooms();

        return () => {
            isMounted = false;
        };
    }, [user?.username, user?.role]);

    const openRoom = (roomId: string) => {
        console.log('[ChatList] openRoom ->', roomId);
        router.push(`/chat?roomId=${encodeURIComponent(roomId)}`);
    };

    const roomCountText = useMemo(() => `${rooms.length} cuộc trò chuyện`, [rooms.length]);

    return (
        <SafeScreen>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Danh sách cuộc trò chuyện</Text>
                        <Text style={styles.subtitle}>{roomCountText}</Text>
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={styles.loadingText}>Đang tải cuộc trò chuyện...</Text>
                    </View>
                ) : rooms.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện</Text>
                        <Text style={styles.emptyText}>Hãy nhắn cho bạn bè hoặc vào nhóm để tạo lịch sử chat.</Text>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {rooms.map(room => (
                            <Pressable key={room.id} style={styles.roomCard} onPress={() => openRoom(room.id)}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{room.name.slice(0, 1).toUpperCase()}</Text>
                                </View>
                                <View style={styles.roomBody}>
                                    <View style={styles.roomRow}>
                                        <Text style={styles.roomName} numberOfLines={1}>{room.isDM ? `@${room.name}` : room.name}</Text>
                                        <Text style={styles.roomTime}>{room.lastAt ? new Date(room.lastAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                                    </View>
                                    <Text style={styles.roomSubtitle} numberOfLines={1}>{room.subtitle || (room.isDM ? `@${room.name}` : 'Nhóm chat')}</Text>
                                    <Text style={styles.roomPreview} numberOfLines={1}>{room.lastMessage || 'Chưa có tin nhắn'}</Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#f8fafc',
        minHeight: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#64748b',
    },
    loadingBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        marginTop: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    emptyBox: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 6,
    },
    emptyText: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
    },
    list: {
        gap: 12,
    },
    roomCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
    },
    roomBody: {
        flex: 1,
    },
    roomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    roomName: {
        flex: 1,
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
    },
    roomTime: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '700',
    },
    roomSubtitle: {
        marginTop: 2,
        fontSize: 13,
        color: '#64748b',
    },
    roomPreview: {
        marginTop: 4,
        fontSize: 14,
        color: '#334155',
        fontWeight: '600',
    },
});
