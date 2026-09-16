const defaultRoomRepository = require('../repositories/Room.repository');
const { generateRoomCode, validateRoomCode } = require('../utils/codeGenerator');

class RoomService {
  constructor(roomRepository = defaultRoomRepository) {
    this.roomRepository = roomRepository;
  }

  async createRoom(title = 'General Room') {
    let attempts = 0;
    let code = '';
    let existingRoom = null;

    do {
      code = generateRoomCode();
      existingRoom = await this.roomRepository.findByCode(code);
      attempts++;
    } while (existingRoom && attempts < 10);

    if (existingRoom) {
      throw new Error('Failed to generate a unique room code. Please try again.');
    }

    const room = await this.roomRepository.create({
      code,
      title
    });

    return room;
  }

  async joinRoom(code) {
    if (!code || !validateRoomCode(code)) {
      const error = new Error('Invalid room code format. Must be exactly 8 alphanumeric characters.');
      error.statusCode = 400;
      throw error;
    }

    const room = await this.roomRepository.findByCode(code);
    if (!room) {
      const error = new Error('Room not found. Check your 8-digit code and try again.');
      error.statusCode = 404;
      throw error;
    }

    await this.roomRepository.updateLastActive(code);
    return room;
  }
}

module.exports = new RoomService();
module.exports.RoomServiceClass = RoomService;
