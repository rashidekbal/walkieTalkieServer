const roomService = require('../services/Room.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

class RoomController {
  async createRoom(req, res) {
    try {
      const { title } = req.body;
      const room = await roomService.createRoom(title);
      return sendSuccess(res, room, 'Room created successfully', 201);
    } catch (err) {
      return sendError(res, err.message, err.statusCode || 500);
    }
  }

  async joinRoom(req, res) {
    try {
      const code = req.params.code || req.body.code;
      const room = await roomService.joinRoom(code);
      return sendSuccess(res, room, 'Joined room successfully');
    } catch (err) {
      return sendError(res, err.message, err.statusCode || 400);
    }
  }
}

module.exports = new RoomController();
