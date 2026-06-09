'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;
let socketRefCount = 0;

function getSocket(): Socket {
  if (!globalSocket || globalSocket.disconnected) {
    globalSocket = io({
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
  }
  socketRefCount++;
  return globalSocket;
}

function releaseSocket() {
  socketRefCount--;
  // Don't disconnect — we keep the singleton alive for the app lifetime
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const s = getSocket();
    setSocket(s);
    setIsConnected(s.connected);

    const handleConnect = () => {
      if (mountedRef.current) setIsConnected(true);
    };
    const handleDisconnect = () => {
      if (mountedRef.current) setIsConnected(false);
    };

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);

    return () => {
      mountedRef.current = false;
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      releaseSocket();
    };
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    if (socket) {
      socket.emit('join_conversation', conversationId);
    }
  }, [socket]);

  const leaveConversation = useCallback((conversationId: string) => {
    if (socket) {
      socket.emit('leave_conversation', conversationId);
    }
  }, [socket]);

  const joinAgentRoom = useCallback((agentId: string) => {
    if (socket) {
      socket.emit('join_agent_room', agentId);
    }
  }, [socket]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onNewMessage = useCallback((callback: (data: any) => void) => {
    if (socket) {
      socket.on('new_message', callback);
      return () => {
        socket.off('new_message', callback);
      };
    }
    return () => {};
  }, [socket]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onInboxUpdate = useCallback((callback: (data: any) => void) => {
    if (socket) {
      socket.on('inbox_update', callback);
      return () => {
        socket.off('inbox_update', callback);
      };
    }
    return () => {};
  }, [socket]);

  return {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
    joinAgentRoom,
    onNewMessage,
    onInboxUpdate,
  };
}
