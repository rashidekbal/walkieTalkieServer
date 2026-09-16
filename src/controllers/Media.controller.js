const mediaService = require('../services/Media.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

class MediaController {
  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 'No file uploaded', 400);
      }
      const mediaData = await mediaService.uploadMedia(req.file);
      return sendSuccess(res, mediaData, 'File uploaded to Cloudinary successfully');
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
}

module.exports = new MediaController();
