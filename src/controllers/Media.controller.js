const mediaService = require('../services/Media.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary');

function parseCloudinaryUrl(urlStr) {
  try {
    const urlObj = new URL(urlStr);
    if (!urlObj.hostname.includes('cloudinary.com')) return null;

    const parts = urlObj.pathname.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;

    const resourceType = parts[uploadIndex - 1] || 'image';
    let remainingParts = parts.slice(uploadIndex + 1);
    remainingParts = remainingParts.filter(p => !p.startsWith('fl_') && !/^v\d+$/.test(p) && !p.startsWith('s--'));

    const publicId = remainingParts.join('/');
    return { resourceType, publicId };
  } catch (e) {
    return null;
  }
}

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
      const safeFileName = fileName.replace(/["\r\n]/g, '_');

      // 1. Handle base64 Data URLs
      if (url.startsWith('data:')) {
        const matches = url.match(/^data:(.+?);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', mime);
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName)}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
          return res.send(buffer);
        }
      }

      // 2. Generate cryptographically signed Cloudinary URL to bypass 401 unauthenticated / raw security restrictions
      let targetUrl = url;
      const parsed = parseCloudinaryUrl(url);

      if (parsed && parsed.publicId && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME !== 'demo') {
        try {
          const signedUrl = cloudinary.url(parsed.publicId, {
            resource_type: parsed.resourceType,
            sign_url: true,
            secure: true,
            type: 'upload'
          });
          if (signedUrl) {
            targetUrl = signedUrl;
          }
        } catch (e) {
          console.warn('[MediaController] Failed to sign Cloudinary URL:', e.message);
        }
      }

      // If image/video and not already signed, apply fl_attachment flag
      if (targetUrl === url && targetUrl.includes('/image/upload/') && !targetUrl.includes('/fl_attachment')) {
        targetUrl = targetUrl.replace('/image/upload/', '/image/upload/fl_attachment/');
      }

      let response = await fetch(targetUrl);

      // Fallback: If targetUrl failed, try fetching original url directly
      if (!response.ok && targetUrl !== url) {
        response = await fetch(url);
      }

      if (!response.ok) {
        return sendError(res, `Remote server returned ${response.status}`, response.status);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName)}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);

      if (response.body && typeof Readable.fromWeb === 'function') {
        const nodeStream = Readable.fromWeb(response.body);
        return nodeStream.pipe(res);
      } else {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return res.send(buffer);
      }
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
}

module.exports = new MediaController();
