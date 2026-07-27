import { io } from 'socket.io-client'

let socket = null

export function getSocketUrl() {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:3000`
  }
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'
}

export function createSocket() {
  if (socket) return socket

  try {
    const url = getSocketUrl()
    socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })
  } catch (err) {
    console.error('Socket creation failed:', err)
  }

  return socket
}

export default createSocket
