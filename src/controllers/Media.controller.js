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

  async downloadFile(req, res) {
    try {
      let { url, name } = req.query;
      if (!url) {
        return sendError(res, 'URL query parameter is required', 400);
      }

      const fileName = name || 'download';

      if (url.includes('res.cloudinary.com') && !url.includes('/fl_attachment')) {
        url = url.replace('/upload/', '/upload/fl_attachment/');
      }

      const response = await fetch(url);
      if (!response.ok) {
        return sendError(res, `Remote server returned ${response.status}`, response.status);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
}

module.exports = new MediaController();
