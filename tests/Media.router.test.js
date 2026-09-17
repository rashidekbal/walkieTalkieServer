const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const mediaRouter = require('../src/routers/Media.router');

// Mock cloudinary to avoid external calls
jest.mock('../src/config/cloudinary', () => ({
  uploader: {
    upload_stream: jest.fn(),
    upload: jest.fn().mockImplementation((filePath, options) => {
      const nodePath = require('path');
      const nodeFs = require('fs');
      const publicDir = nodePath.resolve(__dirname, '../public');
      expect(filePath.startsWith(publicDir)).toBe(true);
      expect(nodeFs.existsSync(filePath)).toBe(true);

      return Promise.resolve({
        secure_url: `https://res.cloudinary.com/test_cloud/image/upload/v1234/${options.public_id}`,
        public_id: `walkie_talkie_media/${options.public_id}`
      });
    })
  },
  url: jest.fn().mockImplementation((publicId) => `https://res.cloudinary.com/test_cloud/raw/upload/s--test--/v1234/${publicId}`),
  utils: {
    private_download_url: jest.fn().mockImplementation((publicId) => `https://api.cloudinary.com/v1_1/test_cloud/raw/download?public_id=${publicId}`)
  }
}));

describe('Media Router with multer diskStorage in public folder', () => {
  let app;
  const originalEnv = process.env;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/media', mediaRouter);
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
    process.env.CLOUDINARY_API_KEY = 'test_key';
    process.env.CLOUDINARY_API_SECRET = 'test_secret';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('POST /api/media/upload should store file in public folder using diskStorage and delete it on complete', async () => {
    const publicDir = path.resolve(__dirname, '../public');
    
    // Count files in public folder before upload (excluding .gitkeep)
    const filesBefore = fs.readdirSync(publicDir).filter(f => f !== '.gitkeep');

    const response = await request(app)
      .post('/api/media/upload')
      .attach('file', Buffer.from('test file contents'), 'test_image.png');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.fileMeta.fileName).toBe('test_image.png');

    // After upload finishes, the temporary file must be removed from public folder
    const filesAfter = fs.readdirSync(publicDir).filter(f => f !== '.gitkeep');
    expect(filesAfter.length).toBe(filesBefore.length);
  });

  test('POST /api/media/upload in local fallback mode should read file and clean up from disk', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo';
    const publicDir = path.resolve(__dirname, '../public');
    const filesBefore = fs.readdirSync(publicDir).filter(f => f !== '.gitkeep');

    const response = await request(app)
      .post('/api/media/upload')
      .attach('file', Buffer.from('fallback buffer content'), 'fallback.txt');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.mediaUrl).toContain('data:');

    // After upload finishes, temporary file must be removed
    const filesAfter = fs.readdirSync(publicDir).filter(f => f !== '.gitkeep');
    expect(filesAfter.length).toBe(filesBefore.length);
  });

  test('POST /api/media/upload should reject files exceeding 10 MB limit for non-videos with 400 and clean up', async () => {
    const publicDir = path.resolve(__dirname, '../public');
    const filesBefore = fs.readdirSync(publicDir).filter(f => f !== '.gitkeep');

    // Create 11 MB buffer
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 'a');

    const response = await request(app)
      .post('/api/media/upload')
      .attach('file', bigBuffer, 'oversized.pdf');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('exceeds the 10 MB limit');

    // Temporary file must not linger in public folder
    const filesAfter = fs.readdirSync(publicDir).filter(f => f !== '.gitkeep');
    expect(filesAfter.length).toBe(filesBefore.length);
  });

  test('GET /api/media/download should require url query parameter', async () => {
    const response = await request(app).get('/api/media/download');
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('GET /api/media/download should download base64 data URLs with attachment headers', async () => {
    const base64Data = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 dummy pdf').toString('base64');
    const response = await request(app)
      .get(`/api/media/download?url=${encodeURIComponent(base64Data)}&name=mydoc.pdf`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('mydoc.pdf');
    expect(response.body.toString()).toContain('%PDF-1.4 dummy pdf');
  });

  test('GET /api/media/download should fetch raw PDF/ZIP and set proper Content-Type and Disposition', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation((targetUrl) => {
      if (targetUrl.includes('api.cloudinary.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: (key) => (key.toLowerCase() === 'content-type' ? 'application/pdf' : null)
          },
          arrayBuffer: () => Promise.resolve(Buffer.from('%PDF-1.4 test file content'))
        });
      }
      return Promise.resolve({ ok: false, status: 401 });
    });

    const response = await request(app)
      .get(`/api/media/download?url=${encodeURIComponent('https://res.cloudinary.com/test_cloud/raw/upload/v12345/walkie_talkie_media/doc_999.pdf')}&name=important_doc.pdf`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain('important_doc.pdf');
    expect(response.body.toString()).toContain('%PDF-1.4 test file content');

    global.fetch = originalFetch;
  });
});
