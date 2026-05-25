/**
 * SocketContext - Centralized WebSocket state management
 *
 * Provides:
 * - Connection status tracking
 * - Automatic reconnection
 * - Type-safe event subscription
 * - Emit with automatic retry
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { io } from 'socket.io-client'
import { _setSharedSocket } from '../services/socket'

const SocketContext = createContext(null)

// Connection status enum
export const ConnectionStatus = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
}

export function SocketProvider({ children, userId }) {
  const [status, setStatus] = useState(ConnectionStatus.CONNECTING)
  const [lastConnected, setLastConnected] = useState(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const socketRef = useRef(null)
  const listenersRef = useRef(new Map())

  // Initialize socket connection
  useEffect(() => {
    const socket = io('/', {
      // Polling-first: survives proxies that block WebSocket upgrade (e.g. a
      // Cloudflare Tunnel with WebSockets disabled). Socket.io still upgrades
      // to WS when the upgrade path is open; if upgrade fails, the session
      // stays on long-polling instead of thrashing. See incident 2026-04-14.
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })

    socketRef.current = socket
    // Wave 2: register this socket with the legacy services/socket.js
    // shim so that `getSocket()` / `on*` / `off*` helpers keep working
    // against this ONE connection (instead of opening a second io('/')).
    _setSharedSocket(socket)

    // Connection event handlers
    socket.on('connect', () => {
      setStatus(ConnectionStatus.CONNECTED)
      setLastConnected(new Date())
      setReconnectAttempts(0)

      // Join user room if userId provided
      if (userId) {
        socket.emit('join_user_room', userId)
      }
    })

    socket.on('disconnect', (reason) => {
      setStatus(ConnectionStatus.DISCONNECTED)
      console.log('[SocketContext] Disconnected:', reason)
    })

    socket.on('reconnect_attempt', (attempt) => {
      setStatus(ConnectionStatus.RECONNECTING)
      setReconnectAttempts(attempt)
    })

    socket.on('reconnect', () => {
      setStatus(ConnectionStatus.CONNECTED)
      setLastConnected(new Date())
      setReconnectAttempts(0)
    })

    socket.on('connect_error', (error) => {
      setStatus(ConnectionStatus.ERROR)
      console.error('[SocketContext] Connection error:', error.message)
    })

    socket.on('reconnect_failed', () => {
      setStatus(ConnectionStatus.ERROR)
      console.error('[SocketContext] Reconnection failed after max attempts')
    })

    return () => {
      // Unregister from legacy shim before tearing down, so a stale
      // socket reference can't be served to late callers.
      _setSharedSocket(null)
      socket.disconnect()
      socketRef.current = null
    }
  }, [userId])

  // Subscribe to a socket event
  const subscribe = useCallback((event, callback) => {
    const socket = socketRef.current
    if (!socket) return () => {}

    // Track listener for cleanup
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set())
    }
    listenersRef.current.get(event).add(callback)

    socket.on(event, callback)

    // Return unsubscribe function
    return () => {
      socket.off(event, callback)
      listenersRef.current.get(event)?.delete(callback)
    }
  }, [])

  // Emit an event
  const emit = useCallback((event, data, callback) => {
    const socket = socketRef.current
    if (!socket?.connected) {
      console.warn('[SocketContext] Cannot emit - not connected')
      return false
    }

    if (callback) {
      socket.emit(event, data, callback)
    } else {
      socket.emit(event, data)
    }
    return true
  }, [])

  // Emit with retry logic
  const emitWithRetry = useCallback(async (event, data, maxRetries = 3) => {
    const socket = socketRef.current

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (socket?.connected) {
        socket.emit(event, data)
        return true
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }

    console.error('[SocketContext] Failed to emit after retries:', event)
    return false
  }, [])

  // Force reconnect
  const reconnect = useCallback(() => {
    const socket = socketRef.current
    if (socket && !socket.connected) {
      socket.connect()
    }
  }, [])

  // Get raw socket instance (use sparingly)
  const getSocket = useCallback(() => socketRef.current, [])

  const value = useMemo(() => ({
    status,
    isConnected: status === ConnectionStatus.CONNECTED,
    isReconnecting: status === ConnectionStatus.RECONNECTING,
    lastConnected,
    reconnectAttempts,
    subscribe,
    emit,
    emitWithRetry,
    reconnect,
    getSocket,
  }), [status, lastConnected, reconnectAttempts, subscribe, emit, emitWithRetry, reconnect, getSocket])

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

// Hook to use socket context
export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

// Hook for subscribing to specific socket events
export function useSocketEvent(eventName, handler, deps = []) {
  const { subscribe, isConnected } = useSocket()
  const handlerRef = useRef(handler)

  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!isConnected) return

    const stableHandler = (data) => handlerRef.current(data)
    return subscribe(eventName, stableHandler)
  }, [eventName, subscribe, isConnected, ...deps])
}

// Hook for emitting events
export function useSocketEmit() {
  const { emit, emitWithRetry, isConnected } = useSocket()
  return { emit, emitWithRetry, isConnected }
}

export default SocketContext
