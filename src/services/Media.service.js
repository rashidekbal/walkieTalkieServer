const cloudinary = require('../config/cloudinary');

class MediaService {
  async uploadMedia(file) {
    if (!file || !file.buffer) {
      throw new Error('No file payload provided for upload.');
    }

    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';

    if (process.env.CLOUDINARY_CLOUD_NAME === 'demo' || !process.env.CLOUDINARY_API_KEY) {
      const base64 = file.buffer.toString('base64');
      const dataUrl = `data:${file.mimetype};base64,${base64}`;
      return {
        mediaUrl: dataUrl,
        mediaPublicId: `local_${Date.now()}`,
        fileMeta: {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype
        }
      };
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'walkie_talkie_media',
          resource_type: resourceType
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            mediaUrl: result.secure_url,
            mediaPublicId: result.public_id,
            fileMeta: {
              fileName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype
            }
          });
        }
      );
      uploadStream.end(file.buffer);
    });
  }
}

module.exports = new MediaService();
