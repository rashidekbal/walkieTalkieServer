require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { initDb } = require('./src/config/db');
const roomRouter = require('./src/routers/Room.router');
const messageRouter = require('./src/routers/Message.router');
const mediaRouter = require('./src/routers/Media.router');
const setupSocketRouter = require('./src/routers/socket.router');

const app = express();
const server = http.createServer(app);

// Configure CORS for production deployment (Render.com)
const allowedOrigins = process.env.CLIENT_URL 
  ? [process.env.CLIENT_URL, 'http://localhost:5173']
  : '*';

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REST API Routers (RCSR Architecture)
app.use('/api/rooms', roomRouter);
app.use('/api/messages', messageRouter);
app.use('/api/media', mediaRouter);

// Socket Router
setupSocketRouter(io);

// Health check endpoint for Render.com zero-downtime health monitors
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WalkieTalkie Backend Server',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

// Start Server & Initialize Database
const PORT = process.env.PORT || 8001;

server.listen(PORT, async () => {
  console.log(`=================================================`);
  console.log(`[WalkieTalkie Server] Listening on port ${PORT}`);
  console.log(`[Environment] ${process.env.NODE_ENV || 'production'}`);
  console.log(`=================================================`);
  await initDb();
});

module.exports = { app, server };
