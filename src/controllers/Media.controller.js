const mediaService = require('../services/Media.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
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

    // Extract asset version if present in URL (e.g. v1742204918 -> 1742204918)
    let version = null;
    const versionPart = remainingParts.find(p => /^v\d+$/.test(p));
    if (versionPart) {
      version = versionPart.substring(1);
    }

    remainingParts = remainingParts.filter(p => !p.startsWith('fl_') && !/^v\d+$/.test(p) && !p.startsWith('s--'));

    const publicId = remainingParts.join('/');
    return { resourceType, publicId, version };
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

      const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video/');
      const maxAllowedBytes = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      const maxAllowedMb = isVideo ? 100 : 10;

      if (req.file.size > maxAllowedBytes) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          try {
            await fs.promises.unlink(req.file.path);
          } catch (_) {}
        }
        const fileMb = (req.file.size / (1024 * 1024)).toFixed(1);
        return sendError(
          res,
          `File size (${fileMb} MB) exceeds the ${maxAllowedMb} MB limit for ${isVideo ? 'video' : 'images and documents'}.`,
          400
        );
      }

      const mediaData = await mediaService.uploadMedia(req.file);
      return sendSuccess(res, mediaData, 'File uploaded to Cloudinary successfully');
    } catch (err) {
      if (req.file && req.file.path) {
        try {
          if (fs.existsSync(req.file.path)) {
            await fs.promises.unlink(req.file.path);
          }
        } catch (_) {}
      }
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
          const asciiFileName = safeFileName.replace(/["\r\n\\]/g, '_');
          res.setHeader('Content-Type', mime);
          res.setHeader('Content-Disposition', `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
          return res.send(buffer);
        }
      }

      // 2. Build candidate URLs for Cloudinary downloads
      const candidateUrls = [];
      const parsed = parseCloudinaryUrl(url);

      if (parsed && parsed.publicId && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME !== 'demo') {
        const extMatch = parsed.publicId.match(/\.([a-zA-Z0-9]+)$/);
        const fileExtMatch = safeFileName.match(/\.([a-zA-Z0-9]+)$/);
        const format = extMatch ? '' : (fileExtMatch ? fileExtMatch[1] : '');

        // Option A: Authenticated private_download_url (crucial for raw files like PDF, ZIP)
        // Hits https://api.cloudinary.com/v1_1/<cloud>/<resource>/download?timestamp=...&signature=...
        // and bypasses CDN-level delivery restrictions
        try {
          const privateUrl = cloudinary.utils.private_download_url(parsed.publicId, format, {
            resource_type: parsed.resourceType,
            type: 'upload'
          });
          if (privateUrl) {
            candidateUrls.push(privateUrl);
          }
        } catch (e) {
          console.warn('[MediaController] Failed to generate private_download_url:', e.message);
        }

        // Option B: Signed CDN URL with exact version
        try {
          const signedUrl = cloudinary.url(parsed.publicId, {
            resource_type: parsed.resourceType,
            sign_url: true,
            secure: true,
            type: 'upload',
            version: parsed.version || undefined
          });
          if (signedUrl && !candidateUrls.includes(signedUrl)) {
            candidateUrls.push(signedUrl);
          }
        } catch (e) {
          console.warn('[MediaController] Failed to sign Cloudinary URL:', e.message);
        }
      }

      // Option C: If image and not already attachment flag, add fl_attachment URL
      if (url.includes('/image/upload/') && !url.includes('/fl_attachment')) {
        candidateUrls.push(url.replace('/image/upload/', '/image/upload/fl_attachment/'));
      }

      // Option D: Direct original URL
      if (!candidateUrls.includes(url)) {
        candidateUrls.push(url);
      }

      // Fetch candidates in priority order
      let response = null;
      for (const targetUrl of candidateUrls) {
        try {
          const resCandidate = await fetch(targetUrl);
          if (resCandidate.ok) {
            response = resCandidate;
            break;
          }
        } catch (e) {
          // Continue to next candidate
        }
      }

      if (!response || !response.ok) {
        return sendError(
          res,
          `Failed to download media file (${response ? response.status : 'network error'}). If this is a PDF or ZIP file on Cloudinary Free plan, enable 'Allow delivery of PDF and ZIP files' under Cloudinary Settings > Security.`,
          response ? response.status : 502
        );
      }

      // Determine accurate MIME type (especially for raw PDF, ZIP, and Office files)
      let contentType = response.headers.get('content-type');
      if (!contentType || contentType === 'application/octet-stream') {
        const ext = path.extname(safeFileName).toLowerCase();
        const mimeMap = {
          '.pdf': 'application/pdf',
          '.zip': 'application/zip',
          '.tar': 'application/x-tar',
          '.gz': 'application/gzip',
          '.7z': 'application/x-7z-compressed',
          '.rar': 'application/x-rar-compressed',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg',
          '.txt': 'text/plain',
          '.json': 'application/json',
          '.csv': 'text/csv',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.ppt': 'application/vnd.ms-powerpoint',
          '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };
        if (mimeMap[ext]) {
          contentType = mimeMap[ext];
        } else {
          contentType = 'application/octet-stream';
        }
      }

      const asciiFileName = safeFileName.replace(/["\r\n\\]/g, '_');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);

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
