import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

let sharedSocket = null;

export function useSocket() {
  const [socket, setSocket] = useState(sharedSocket);

  useEffect(() => {
    if (sharedSocket) { setSocket(sharedSocket); return; }

    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    s.on('connect', () => console.log('🔌 Socket connected'));
    s.on('disconnect', () => console.log('🔌 Socket disconnected'));

    sharedSocket = s;
    setSocket(s);

    return () => {};  // keep socket alive for app lifetime
  }, []);

  return socket;
}
