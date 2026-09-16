const defaultMessageRepo = require('../repositories/Message.repository');
const defaultRoomRepo = require('../repositories/Room.repository');
const { validateRoomCode } = require('../utils/codeGenerator');

class MessageService {
  constructor(messageRepo = defaultMessageRepo, roomRepo = defaultRoomRepo) {
    this.messageRepo = messageRepo;
    this.roomRepo = roomRepo;
  }

  async sendMessage({ roomCode, senderName, senderSocketId = null, content, type = 'text', mediaUrl = null, mediaPublicId = null, fileMeta = {} }) {
    if (!roomCode || !validateRoomCode(roomCode)) {
      const err = new Error('Invalid 8-character room code.');
      err.statusCode = 400;
      throw err;
    }

    const room = await this.roomRepo.findByCode(roomCode);
    if (!room) {
      const err = new Error('Room does not exist.');
      err.statusCode = 404;
      throw err;
    }

    await this.roomRepo.updateLastActive(roomCode);

    const savedMessage = await this.messageRepo.create({
      roomCode,
      senderName: senderName || 'Guest',
      senderSocketId,
      type,
      content: content || '',
      mediaUrl,
      mediaPublicId,
      fileMeta
    });

    return savedMessage;
  }

  async getRoomMessages(roomCode) {
    if (!roomCode || !validateRoomCode(roomCode)) {
      const err = new Error('Invalid 8-character room code.');
      err.statusCode = 400;
      throw err;
    }

    return await this.messageRepo.findByRoomCode(roomCode);
  }
}

module.exports = new MessageService();
module.exports.MessageServiceClass = MessageService;
