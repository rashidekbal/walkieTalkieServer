const { pool } = require('../config/db');

class MessageRepository {
  constructor() {
    this.memoryStorage = [];
  }

  async create(msgData) {
    const {
      roomCode,
      senderName = 'Guest',
      senderSocketId = null,
      type = 'text',
      content = '',
      mediaUrl = null,
      mediaPublicId = null,
      fileMeta = {}
    } = msgData;

    try {
      const sql = `
        INSERT INTO walkietalkie_messages 
        (room_code, sender_name, sender_socket_id, type, content, media_url, media_public_id, file_name, file_size, mime_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await pool.execute(sql, [
        roomCode,
        senderName,
        senderSocketId,
        type,
        content,
        mediaUrl,
        mediaPublicId,
        fileMeta.fileName || null,
        fileMeta.fileSize || null,
        fileMeta.mimeType || null
      ]);

      return {
        id: result.insertId,
        room_code: roomCode,
        sender_name: senderName,
        sender_socket_id: senderSocketId,
        senderSocketId: senderSocketId,
        type,
        content,
        media_url: mediaUrl,
        media_public_id: mediaPublicId,
        file_name: fileMeta.fileName || null,
        file_size: fileMeta.fileSize || null,
        mime_type: fileMeta.mimeType || null,
        created_at: new Date()
      };
    } catch (err) {
      const msg = {
        id: Date.now() + Math.random(),
        room_code: roomCode,
        sender_name: senderName,
        sender_socket_id: senderSocketId,
        senderSocketId: senderSocketId,
        type,
        content,
        media_url: mediaUrl,
        media_public_id: mediaPublicId,
        file_name: fileMeta.fileName || null,
        file_size: fileMeta.fileSize || null,
        mime_type: fileMeta.mimeType || null,
        created_at: new Date()
      };
      this.memoryStorage.push(msg);
      return msg;
    }
  }

  async findByRoomCode(roomCode, limit = 100) {
    try {
      const sql = 'SELECT * FROM walkietalkie_messages WHERE room_code = ? ORDER BY created_at ASC LIMIT ?';
      const [rows] = await pool.execute(sql, [roomCode, limit]);
      if (rows && rows.length > 0) {
        return rows;
      }
      return this.memoryStorage.filter(m => m.room_code === roomCode);
    } catch (err) {
      return this.memoryStorage.filter(m => m.room_code === roomCode);
    }
  }

  async deleteByRoomCode(roomCode) {
    try {
      const sql = 'DELETE FROM walkietalkie_messages WHERE room_code = ?';
      const [result] = await pool.execute(sql, [roomCode]);
      this.memoryStorage = this.memoryStorage.filter(m => m.room_code !== roomCode);
      return result.affectedRows > 0;
    } catch (err) {
      this.memoryStorage = this.memoryStorage.filter(m => m.room_code !== roomCode);
      return true;
    }
  }
}

module.exports = new MessageRepository();
