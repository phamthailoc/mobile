import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/constants/api';
import { getSession, getSessionSync } from '@/services/session-storage';

interface SocketMessage {
  messageId?: string;
  id?: string;
  roomId: string;
  senderId?: string;
  senderUsername: string;
  text: string;
  sender?: string;
  content?: string;
  time?: string;
  createdAt?: string;
  fileData?: string;
  fileType?: string;
  fileName?: string;
  isRevoked?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  isPinned?: boolean;
  reactions?: Array<{ username: string; emoji: string }>;
  readBy?: string[];
  deliveredTo?: string[];
}

// Global socket instance to persist across component mounts/unmounts
let globalSocket: Socket | null = null;
let connectedUsername: string | null = null;
let listenersAttached = false;

const updateMessageById = (
  previous: SocketMessage[],
  messageId: string,
  updater: (message: SocketMessage) => SocketMessage,
) => {
  return previous.map(message => {
    const currentId = message.messageId || message.id;
    if (currentId !== messageId) return message;
    return updater(message);
  });
};

export const useSocket = (username: string | undefined, enabled: boolean = true) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<SocketMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const messageQueueRef = useRef<SocketMessage[]>([]);

  const attachGlobalListeners = useCallback(() => {
    if (!globalSocket || listenersAttached) return;
    listenersAttached = true;

    globalSocket.on('connect', () => {
      setIsConnected(true);
      const session = getSessionSync();
      const activeUser = connectedUsername || session?.username;
      if (activeUser) {
        globalSocket?.emit('user_online', { username: activeUser, displayName: session?.displayName });
      }
    });

    globalSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    globalSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    globalSocket.on('receive_message', (data: SocketMessage) => {
      messageQueueRef.current.push(data);
      setMessages(prev => [...prev, data]);
    });

    globalSocket.on('message_revoked', (payload: { messageId?: string } | string) => {
      const messageId = typeof payload === 'string' ? payload : payload?.messageId;
      if (!messageId) return;

      messageQueueRef.current = updateMessageById(messageQueueRef.current, messageId, message => ({
        ...message,
        text: 'Tin nhắn này đã bị thu hồi',
        fileData: undefined,
        fileType: undefined,
        fileName: undefined,
        isRevoked: true,
      }));

      setMessages(prev =>
        updateMessageById(prev, messageId, message => ({
          ...message,
          text: 'Tin nhắn này đã bị thu hồi',
          fileData: undefined,
          fileType: undefined,
          fileName: undefined,
          isRevoked: true,
        }))
      );
    });

    globalSocket.on('message_edited', (payload: { messageId?: string; newText?: string; editedAt?: string }) => {
      if (!payload?.messageId) return;

      messageQueueRef.current = updateMessageById(messageQueueRef.current, payload.messageId, message => ({
        ...message,
        text: payload.newText || message.text,
        isEdited: true,
        editedAt: payload.editedAt,
      }));

      setMessages(prev =>
        updateMessageById(prev, payload.messageId as string, message => ({
          ...message,
          text: payload.newText || message.text,
          isEdited: true,
          editedAt: payload.editedAt,
        }))
      );
    });

    globalSocket.on('message_pinned', (payload: { messageId?: string; isPinned?: boolean }) => {
      if (!payload?.messageId) return;

      messageQueueRef.current = updateMessageById(messageQueueRef.current, payload.messageId, message => ({
        ...message,
        isPinned: payload.isPinned,
      }));

      setMessages(prev =>
        updateMessageById(prev, payload.messageId as string, message => ({
          ...message,
          isPinned: payload.isPinned,
        }))
      );
    });

    globalSocket.on('message_updated', (payload: { messageId?: string; reactions?: Array<{ username: string; emoji: string }> }) => {
      if (!payload?.messageId) return;

      if ((payload as any).pollData) {
        const pollData = (payload as any).pollData;

        messageQueueRef.current = updateMessageById(messageQueueRef.current, payload.messageId, message => ({
          ...message,
          pollData,
          msgType: message.msgType || 'poll',
        }));

        setMessages(prev =>
          updateMessageById(prev, payload.messageId as string, message => ({
            ...message,
            pollData,
            msgType: message.msgType || 'poll',
          }))
        );
      }

      if (payload.reactions) {
        messageQueueRef.current = updateMessageById(messageQueueRef.current, payload.messageId, message => ({
          ...message,
          reactions: payload.reactions,
        }));

        setMessages(prev =>
          updateMessageById(prev, payload.messageId as string, message => ({
            ...message,
            reactions: payload.reactions,
          }))
        );
      }
    });

    globalSocket.on('messages_read_update', (payload: { updates?: Array<{ messageId: string; readBy: string[] }> }) => {
      if (!payload?.updates?.length) return;

      payload.updates.forEach(update => {
        messageQueueRef.current = updateMessageById(messageQueueRef.current, update.messageId, message => ({
          ...message,
          readBy: update.readBy,
        }));
      });

      setMessages(prev => {
        let next = prev;
        payload.updates?.forEach(update => {
          next = updateMessageById(next, update.messageId, message => ({
            ...message,
            readBy: update.readBy,
          }));
        });
        return next;
      });
    });

    globalSocket.on('messages_delivered_bulk_update', (payload: { updates?: Array<{ messageId: string; deliveredTo: string[] }> }) => {
      if (!payload?.updates?.length) return;

      payload.updates.forEach(update => {
        messageQueueRef.current = updateMessageById(messageQueueRef.current, update.messageId, message => ({
          ...message,
          deliveredTo: update.deliveredTo,
        }));
      });

      setMessages(prev => {
        let next = prev;
        payload.updates?.forEach(update => {
          next = updateMessageById(next, update.messageId, message => ({
            ...message,
            deliveredTo: update.deliveredTo,
          }));
        });
        return next;
      });
    });

    globalSocket.on('message_deleted', (payload: { messageId?: string }) => {
      if (!payload?.messageId) return;
      messageQueueRef.current = messageQueueRef.current.filter(message => (message.messageId || message.id) !== payload.messageId);
      setMessages(prev => prev.filter(message => (message.messageId || message.id) !== payload.messageId));
    });

    globalSocket.on('message_history', (data: SocketMessage[]) => {
      setMessages(data);
    });

    globalSocket.on('error_message', (payload: { error?: string }) => {
      setSendError(payload?.error || 'Khong the gui tin nhan');
    });

    globalSocket.on('message_error', (payload: { message?: string }) => {
      setSendError(payload?.message || 'Khong the gui tin nhan');
    });
  }, []);

  const createOrReconnectSocket = useCallback(async (activeUsername: string) => {
    const session = await getSession();
    if (!session?.token) return;

    if (globalSocket && connectedUsername && connectedUsername !== activeUsername) {
      globalSocket.disconnect();
      globalSocket = null;
      listenersAttached = false;
    }

    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        transports: ['websocket', 'polling'],
        forceNew: false,
        multiplex: false,
        auth: {
          username: activeUsername,
          token: session.token,
          sessionId: session.sessionId,
        },
      });
    }

    connectedUsername = activeUsername;

    if (globalSocket.auth) {
      globalSocket.auth = {
        username: activeUsername,
        token: session.token,
        sessionId: session.sessionId,
      };
    }

    attachGlobalListeners();

    if (!globalSocket.connected) {
      globalSocket.connect();
    } else {
      setIsConnected(true);
      globalSocket.emit('user_online', { username: activeUsername, displayName: session.displayName });
    }
  }, [attachGlobalListeners]);

  const sendMessage = useCallback((messageData: Omit<SocketMessage, 'messageId' | 'id'>) => {
    if (globalSocket?.connected) {
      globalSocket.emit('send_message', messageData);
    }
  }, []);

  const revokeMessage = useCallback((messageId: string) => {
    if (globalSocket?.connected && messageId) {
      globalSocket.emit('revoke_message', messageId);
    }
  }, []);

  const editMessage = useCallback((messageId: string, newText: string) => {
    if (globalSocket?.connected && messageId && newText.trim()) {
      globalSocket.emit('edit_message', { messageId, newText: newText.trim() });
    }
  }, []);

  const markMessagesRead = useCallback((messageIds: string[], roomId: string) => {
    if (globalSocket?.connected && messageIds.length > 0 && roomId) {
      globalSocket.emit('message_read', { messageIds, roomId });
    }
  }, []);

  const markMessagesDelivered = useCallback((messageIds: string[], roomId: string) => {
    if (globalSocket?.connected && messageIds.length > 0 && roomId) {
      globalSocket.emit('messages_delivered', { messageIds, roomId });
    }
  }, []);

  const reconnect = useCallback(async () => {
    if (!enabled || !username) return;
    await createOrReconnectSocket(username);
  }, [createOrReconnectSocket, enabled, username]);

  useEffect(() => {
    if (!enabled || !username) return;
    void createOrReconnectSocket(username);

    // Don't disconnect on component unmount - socket persists across tabs
    return () => {
      // Optional: You can add cleanup logic here if needed
      // But we keep the socket alive for tab switching
    };
  }, [createOrReconnectSocket, enabled, username]);

  return {
    socket: globalSocket,
    isConnected,
    messages,
    sendMessage,
    revokeMessage,
    editMessage,
    markMessagesRead,
    markMessagesDelivered,
    reconnect,
    sendError,
    clearSendError: () => setSendError(null),
  };
};
