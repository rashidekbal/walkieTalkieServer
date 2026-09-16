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

      // IMPORTANT: fl_attachment is ONLY valid for /image/upload/ and /video/upload/ in Cloudinary.
      // Applying fl_attachment to /raw/upload/ causes Cloudinary to return 400/404/401 errors.
      let targetUrl = url;
      if (targetUrl.includes('/image/upload/') && !targetUrl.includes('/fl_attachment')) {
        targetUrl = targetUrl.replace('/image/upload/', '/image/upload/fl_attachment/');
      }

      let response = await fetch(targetUrl);
      if (!response.ok && targetUrl !== url) {
        // Fall back to exact original URL if fl_attachment failed
        response = await fetch(url);
      }

      if (!response.ok) {
        return sendError(res, `Remote server returned ${response.status}`, response.status);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const safeFileName = fileName.replace(/["\r\n]/g, '_');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName)}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
}

module.exports = new MediaController();
