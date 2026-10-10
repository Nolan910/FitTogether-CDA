const { Server } = require('socket.io');
const { allowedOrigins } = require('../config/cors');
const { authenticateToken } = require('../Middleware/authJwt');
const HttpError = require('../utils/httpError');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const { userId } = await authenticateToken(socket.handshake.auth?.token);
      socket.data.userId = userId;
      next();
    } catch (err) {
      next(new Error(err instanceof HttpError ? err.message : 'Erreur serveur.'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.data.userId);
  });

  return io;
};

const emitToUsers = (userIds, event, payload) => {
  if (!io) return;
  io.to(userIds.map(String)).emit(event, payload);
};

const closeSocket = () => new Promise((resolve) => {
  if (!io) return resolve();
  io.close(() => {
    io = null;
    resolve();
  });
});

module.exports = { initSocket, emitToUsers, closeSocket };
