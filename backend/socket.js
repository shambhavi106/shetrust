const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer) {
  const allowedOrigins =
    process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL].filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join a time-slot room (for heatmap updates)
    socket.on('join-slot', (slot) => socket.join(`slot:${slot}`));
    socket.on('leave-slot', (slot) => socket.leave(`slot:${slot}`));

    // Join a personal notification room (for registered users)
    socket.on('join-user', (userId) => {
      if (userId && typeof userId === 'string' && userId.length === 24) {
        socket.join(`user:${userId}`);
        console.log(`🔔 User ${userId} joined notification room`);
      }
    });

    // Join an area room (for zone alerts)
    socket.on('join-area', (area) => {
      if (area && typeof area === 'string') {
        socket.join(`area:${area.toLowerCase().replace(/\s+/g, '-')}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialised – call initSocket first');
  return io;
}

module.exports = { initSocket, getIO };
