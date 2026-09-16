const { pool } = require('../config/db');

class RoomRepository {
  constructor() {
    this.memoryStorage = new Map();
  }

  async create(roomData) {
    try {
      const { code, title = 'General Room' } = roomData;
      const sql = 'INSERT INTO rooms (code, title) VALUES (?, ?)';
      await pool.execute(sql, [code, title]);
      return this.findByCode(code);
    } catch (err) {
      const room = {
        id: Date.now(),
        code: roomData.code,
        title: roomData.title || 'General Room',
        created_at: new Date(),
        last_active_at: new Date()
      };
      this.memoryStorage.set(roomData.code, room);
      return room;
    }
  }

  async findByCode(code) {
    try {
      const sql = 'SELECT * FROM rooms WHERE code = ? LIMIT 1';
      const [rows] = await pool.execute(sql, [code]);
      if (rows && rows.length > 0) {
        return rows[0];
      }
      return this.memoryStorage.get(code) || null;
    } catch (err) {
      return this.memoryStorage.get(code) || null;
    }
  }

  async updateLastActive(code) {
    try {
      const sql = 'UPDATE rooms SET last_active_at = NOW() WHERE code = ?';
      await pool.execute(sql, [code]);
      return this.findByCode(code);
    } catch (err) {
      const room = this.memoryStorage.get(code);
      if (room) {
        room.last_active_at = new Date();
      }
      return room;
    }
  }

  async deleteByCode(code) {
    try {
      const sql = 'DELETE FROM rooms WHERE code = ?';
      const [result] = await pool.execute(sql, [code]);
      this.memoryStorage.delete(code);
      return result.affectedRows > 0;
    } catch (err) {
      return this.memoryStorage.delete(code);
    }
  }
}

module.exports = new RoomRepository();
