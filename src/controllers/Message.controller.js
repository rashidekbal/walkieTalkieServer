const messageService = require('../services/Message.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

class MessageController {
  async sendMessage(req, res) {
    try {
      const { roomCode, senderName, content, type, mediaUrl, mediaPublicId, fileMeta } = req.body;
      const message = await messageService.sendMessage({
        roomCode,
        senderName,
        content,
        type,
        mediaUrl,
        mediaPublicId,
        fileMeta
      });
      return sendSuccess(res, message, 'Message sent successfully', 201);
    } catch (err) {
      return sendError(res, err.message, err.statusCode || 400);
    }
  }

  async getRoomMessages(req, res) {
    try {
      const { code } = req.params;
      const messages = await messageService.getRoomMessages(code);
      return sendSuccess(res, messages, 'Messages retrieved successfully');
    } catch (err) {
      return sendError(res, err.message, err.statusCode || 400);
    }
  }
}

module.exports = new MessageController();
