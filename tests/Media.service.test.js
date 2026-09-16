const mediaService = require('../src/services/Media.service');
const cloudinary = require('../src/config/cloudinary');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../src/config/cloudinary', () => ({
  uploader: {
    upload_stream: jest.fn(),
    upload: jest.fn()
  }
}));

describe('MediaService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should throw error if file is missing', async () => {
    await expect(mediaService.uploadMedia(null)).rejects.toThrow('No file payload provided for upload.');
  });

  test('should return base64 dataUrl in local fallback mode', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo';
    const mockFile = {
      buffer: Buffer.from('hello world'),
      mimetype: 'application/pdf',
      originalname: 'document.pdf',
      size: 11
    };

    const result = await mediaService.uploadMedia(mockFile);
    expect(result.mediaUrl).toContain('data:application/pdf;base64,');
    expect(result.fileMeta.fileName).toBe('document.pdf');
    expect(result.fileMeta.fileSize).toBe(11);
    expect(result.fileMeta.mimeType).toBe('application/pdf');
  });

  test('should upload raw file to Cloudinary preserving extension in public_id and options', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'real_cloud';
    process.env.CLOUDINARY_API_KEY = 'real_api_key';

    const mockFile = {
      buffer: Buffer.from('pdf data'),
      mimetype: 'application/pdf',
      originalname: 'annual_report_2026.pdf',
      size: 100
    };

    cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
      expect(options.folder).toBe('walkie_talkie_media');
      expect(options.resource_type).toBe('raw');
      expect(options.public_id).toMatch(/^annual_report_2026_\d+\.pdf$/);
      expect(options.use_filename).toBe(true);
      expect(options.unique_filename).toBe(true);
      expect(options.preserve_filename).toBe(true);
      expect(options.filename_override).toBe('annual_report_2026.pdf');

      callback(null, {
        secure_url: `https://res.cloudinary.com/real_cloud/raw/upload/v1234/${options.public_id}`,
        public_id: `walkie_talkie_media/${options.public_id}`
      });

      return {
        end: jest.fn()
      };
    });

    const result = await mediaService.uploadMedia(mockFile);
    expect(result.mediaUrl).toContain('annual_report_2026_');
    expect(result.mediaUrl).toContain('.pdf');
    expect(result.fileMeta.fileName).toBe('annual_report_2026.pdf');
  });

  test('should upload disk file via file.path to Cloudinary and clean up disk file', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'real_cloud';
    process.env.CLOUDINARY_API_KEY = 'real_api_key';

    const tempFilePath = path.join(os.tmpdir(), `test_upload_${Date.now()}.pdf`);
    await fs.promises.writeFile(tempFilePath, 'dummy pdf contents');

    const mockFile = {
      path: tempFilePath,
      mimetype: 'application/pdf',
      originalname: 'disk_doc.pdf',
      size: 20
    };

    cloudinary.uploader.upload.mockImplementation((filePath, options) => {
      expect(filePath).toBe(tempFilePath);
      expect(options.resource_type).toBe('raw');
      expect(options.public_id).toMatch(/^disk_doc_\d+\.pdf$/);
      return Promise.resolve({
        secure_url: `https://res.cloudinary.com/real_cloud/raw/upload/v1234/${options.public_id}`,
        public_id: `walkie_talkie_media/${options.public_id}`
      });
    });

    const result = await mediaService.uploadMedia(mockFile);
    expect(result.mediaUrl).toContain('disk_doc_');
    expect(result.fileMeta.fileName).toBe('disk_doc.pdf');

    // Verify disk file was automatically unlinked/deleted
    const exists = fs.existsSync(tempFilePath);
    expect(exists).toBe(false);
  });
});

