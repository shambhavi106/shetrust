import { io } from 'socket.io-client';

const SOCKET_URL = (() => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return 'http://localhost:5000';
  try {
    return new URL(apiUrl).origin; // e.g. "https://xyz.up.railway.app"
  } catch {
    // fallback: strip trailing /api path
    return apiUrl.replace(/\/api\/?$/, '') || apiUrl;
  }
})();

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
