import { useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket';

/**
 * React hook that subscribes to a Socket.io event.
 * Automatically cleans up the listener on unmount.
 *
 * @param {string} event - Socket event name to listen for
 * @param {Function} handler - Callback invoked with event data
 */
export function useSocket(event, handler) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const socket = getSocket();

    const listener = (data) => {
      savedHandler.current(data);
    };

    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}
