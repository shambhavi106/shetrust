const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer) {
  const allowedOrigins =
    process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL].filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('join-slot', (slot) => {
      socket.join(`slot:${slot}`);
    });

    socket.on('leave-slot', (slot) => {
      socket.leave(`slot:${slot}`);
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
