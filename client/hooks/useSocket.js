import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000';

export const useSocket = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(null);
  const pingIntervalRef = useRef(null);
  const listenersRef = useRef(new Map());

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return socketRef.current;

    socketRef.current = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('✅ Socket connected:', socket.id);
      startPing();
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('❌ Socket disconnected:', reason);
      stopPing();
    });

    socket.on('pong', ({ timestamp }) => {
      const rtt = Date.now() - timestamp;
      setLatency(Math.round(rtt / 2)); // One-way latency estimate
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setIsConnected(false);
    });

    return socket;
  }, []);

  const startPing = useCallback(() => {
    stopPing();
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping', { timestamp: Date.now() });
      }
    }, 5000);
  }, []);

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      stopPing();
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, [stopPing]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn(`Cannot emit '${event}': socket not connected`);
    }
  }, []);

  const on = useCallback((event, handler) => {
    if (!socketRef.current) return;
    socketRef.current.on(event, handler);
    // Track for cleanup
    const key = `${event}-${handler.toString().slice(0, 20)}`;
    listenersRef.current.set(key, { event, handler });
  }, []);

  const off = useCallback((event, handler) => {
    if (!socketRef.current) return;
    if (handler) {
      socketRef.current.off(event, handler);
    } else {
      socketRef.current.off(event);
    }
  }, []);

  const getSocket = useCallback(() => socketRef.current, []);
  const getSocketId = useCallback(() => socketRef.current?.id, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    latency,
    connect,
    disconnect,
    emit,
    on,
    off,
    getSocket,
    getSocketId,
  };
};
