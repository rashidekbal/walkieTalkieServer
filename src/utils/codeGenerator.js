const crypto = require('crypto');

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function validateRoomCode(code) {
  if (typeof code !== 'string') return false;
  const regex = /^[A-Za-z0-9]{8}$/;
  return regex.test(code);
}

module.exports = {
  generateRoomCode,
  validateRoomCode
};
