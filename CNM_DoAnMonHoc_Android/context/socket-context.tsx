import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/constants/api';

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
}

interface SocketContextType {
  isConnected: boolean;
  messages: SocketMessage[];
  sendMessage: (messageData: Omit<SocketMessage, 'messageId' | 'id'>) => void;
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<SocketMessage[]>([]);
  const usernameRef = useRef<string | undefined>(undefined);

  const sendMessage = (messageData: Omit<SocketMessage, 'messageId' | 'id'>) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_message', messageData);
    }
  };

  const initializeSocket = (username: string) => {
    if (usernameRef.current === username && socketRef.current?.connected) {
      return; // Already connected with this username
    }

    usernameRef.current = username;

    // Reuse existing socket or create new one
    if (!socketRef.current) {
      const socket = io(API_BASE_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        transports: ['websocket', 'polling'],
        forceNew: false,
        multiplex: false,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ Socket.io connected:', socket.id);
        socket.emit('join_user', username);
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('❌ Socket.io disconnected');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
      });

      socket.on('receive_message', (data: SocketMessage) => {
        console.log('📨 Received message:', data);
        setMessages(prev => [...prev, data]);
      });

      socket.on('message_history', (data: SocketMessage[]) => {
        console.log('📜 Message history:', data);
        setMessages(data);
      });
    } else if (!socketRef.current.connected) {
      socketRef.current.connect();
      socketRef.current.emit('join_user', username);
    }
  };

  // Cleanup only on provider unmount, not on component unmounts
  useEffect(() => {
    return () => {
      // Only disconnect when the provider itself unmounts
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected, messages, sendMessage, socket: socketRef.current }}>
      {React.cloneElement(children as React.ReactElement, { initializeSocket })}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider');
  }
  return context;
}

export function useGlobalSocket(username: string | undefined, enabled: boolean = true) {
  const context = useSocketContext();

  useEffect(() => {
    if (!enabled || !username) return;
    
    // Access initializeSocket from props if available, or call directly
    const initSocket = (window as any).__initializeSocket;
    if (initSocket) {
      initSocket(username);
    }
  }, [enabled, username]);

  return context;
}
