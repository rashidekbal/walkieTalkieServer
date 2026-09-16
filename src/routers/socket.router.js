const roomService = require('../services/Room.service');
const messageService = require('../services/Message.service');

function setupSocketRouter(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join_room', async ({ roomCode, senderName }) => {
      try {
        const room = await roomService.joinRoom(roomCode);
        socket.join(roomCode);
        socket.currentRoom = roomCode;
        socket.senderName = senderName || 'Guest';

        const history = await messageService.getRoomMessages(roomCode);
        socket.emit('room_history', { room, history });

        socket.to(roomCode).emit('user_joined', {
          senderName: socket.senderName,
          timestamp: new Date()
        });
      } catch (err) {
        socket.emit('error_message', { message: err.message || 'Failed to join room' });
      }
    });

    socket.on('send_message', async (data) => {
      try {
        const { roomCode, senderName, content, type, mediaUrl, mediaPublicId, fileMeta } = data;
        
        const message = await messageService.sendMessage({
          roomCode,
          senderName: senderName || socket.senderName || 'Guest',
          content,
          type,
          mediaUrl,
          mediaPublicId,
          fileMeta
        });

        io.to(roomCode).emit('new_message', message);
      } catch (err) {
        socket.emit('error_message', { message: err.message || 'Failed to send message' });
      }
    });

    socket.on('typing', ({ roomCode, senderName, isTyping }) => {
      socket.to(roomCode).emit('user_typing', { senderName, isTyping });
    });

    socket.on('disconnect', () => {
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('user_left', {
          senderName: socket.senderName || 'Guest',
          timestamp: new Date()
        });
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSocketRouter;
