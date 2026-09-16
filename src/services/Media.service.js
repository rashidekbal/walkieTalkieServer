const cloudinary = require('../config/cloudinary');
const path = require('path');
const fs = require('fs');

class MediaService {
  async uploadMedia(file) {
    if (!file || (!file.path && !file.buffer)) {
      throw new Error('No file payload provided for upload.');
    }

    const originalName = file.originalname || 'uploaded_file';
    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';

    const ext = path.extname(originalName);
    const basename = path.basename(originalName, ext);
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';
    
    // For raw files (or images), preserving the extension in public_id ensures 
    // Cloudinary URLs include the file extension (e.g., .../filename_12345.pdf).
    const publicIdWithExt = resourceType === 'raw' 
      ? `${sanitizedBasename}_${Date.now()}${ext}`
      : `${sanitizedBasename}_${Date.now()}`;

    try {
      if (process.env.CLOUDINARY_CLOUD_NAME === 'demo' || !process.env.CLOUDINARY_API_KEY) {
        let base64;
        if (file.buffer) {
          base64 = file.buffer.toString('base64');
        } else if (file.path) {
          const fileBuffer = await fs.promises.readFile(file.path);
          base64 = fileBuffer.toString('base64');
        }
        const dataUrl = `data:${file.mimetype};base64,${base64}`;

        return {
          mediaUrl: dataUrl,
          mediaPublicId: `local_${Date.now()}`,
          fileMeta: {
            fileName: originalName,
            fileSize: file.size,
            mimeType: file.mimetype
          }
        };
      }

      const uploadOptions = {
        folder: 'walkie_talkie_media',
        resource_type: resourceType,
        public_id: publicIdWithExt,
        use_filename: true,
        unique_filename: true,
        preserve_filename: true,
        filename_override: originalName
      };

      let result;
      if (file.path) {
        result = await cloudinary.uploader.upload(file.path, uploadOptions);
      } else {
        result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, res) => {
              if (error) return reject(error);
              resolve(res);
            }
          );
          uploadStream.end(file.buffer);
        });
      }

      return {
        mediaUrl: result.secure_url,
        mediaPublicId: result.public_id,
        fileMeta: {
          fileName: originalName,
          fileSize: file.size,
          mimeType: file.mimetype
        }
      };
    } finally {
      // Clean up temp file on disk if uploaded via diskStorage
      if (file.path) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
    }
  }
}

module.exports = new MediaService();


