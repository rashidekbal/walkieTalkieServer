const { generateRoomCode, validateRoomCode } = require('../src/utils/codeGenerator');

describe('Room Code Generator & Validator', () => {
  test('should generate an 8-character string', () => {
    const code = generateRoomCode();
    expect(typeof code).toBe('string');
    expect(code.length).toBe(8);
  });

  test('should generate unique codes across multiple calls', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateRoomCode());
    }
    expect(codes.size).toBe(100);
  });

  test('should validate correct 8-character alphanumeric codes', () => {
    expect(validateRoomCode('k9X2mP7q')).toBe(true);
    expect(validateRoomCode('12345678')).toBe(true);
    expect(validateRoomCode('ABCDEFGH')).toBe(true);
  });

  test('should reject invalid room codes', () => {
    expect(validateRoomCode('12347')).toBe(false);
    expect(validateRoomCode('123456789')).toBe(false);
    expect(validateRoomCode('k9X2mP7!')).toBe(false);
    expect(validateRoomCode(null)).toBe(false);
    expect(validateRoomCode(undefined)).toBe(false);
  });
});
