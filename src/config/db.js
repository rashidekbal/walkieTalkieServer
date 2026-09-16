const mysql = require('mysql2/promise');

const host = process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306', 10);
const user = process.env.MYSQL_USER || process.env.DB_USER || 'root';
const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '';
const database = process.env.MYSQL_DATABASE || process.env.DB || 'walkietalkie';

const isCloud = host.includes('aivencloud.com') || host.includes('amazonaws.com') || host.includes('azure') || process.env.MYSQL_SSL === 'true';

const poolConfig = {
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

if (isCloud) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolConfig);

async function initDb() {
  try {
    console.log(`[MySQL] Connecting to ${host}:${port} (${database})...`);

    // 1. Create walkietalkie_rooms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS walkietalkie_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(8) NOT NULL UNIQUE,
        title VARCHAR(255) DEFAULT 'General Room',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Create walkietalkie_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS walkietalkie_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_code VARCHAR(8) NOT NULL,
        sender_name VARCHAR(100) NOT NULL DEFAULT 'Guest',
        type ENUM('text', 'image', 'file') DEFAULT 'text',
        content TEXT,
        media_url TEXT,
        media_public_id VARCHAR(255),
        file_name VARCHAR(255),
        file_size INT,
        mime_type VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_room_code (room_code),
        FOREIGN KEY (room_code) REFERENCES walkietalkie_rooms(code) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('[MySQL] Connected! Live tables (walkietalkie_rooms, walkietalkie_messages) initialized successfully.');
  } catch (error) {
    console.warn('[MySQL Warning] Connection or table initialization error:', error.message);
  }
}

module.exports = {
  pool,
  initDb
};
