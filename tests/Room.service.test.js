const { RoomServiceClass } = require('../src/services/Room.service');

describe('RoomService (Unit Tests)', () => {
  let mockRoomRepo;
  let roomService;

  beforeEach(() => {
    mockRoomRepo = {
      create: jest.fn(data => Promise.resolve({ id: 1, ...data, created_at: new Date() })),
      findByCode: jest.fn(code => Promise.resolve(null)),
      updateLastActive: jest.fn(code => Promise.resolve(true))
    };
    roomService = new RoomServiceClass(mockRoomRepo);
  });

  test('createRoom should generate an 8-character unique code and save room', async () => {
    const room = await roomService.createRoom('Test Room');
    expect(room.code).toBeDefined();
    expect(room.code.length).toBe(8);
    expect(room.title).toBe('Test Room');
    expect(mockRoomRepo.create).toHaveBeenCalledTimes(1);
  });

  test('joinRoom should throw an error for invalid 8-character codes', async () => {
    await expect(roomService.joinRoom('short')).rejects.toThrow('Invalid room code format');
    await expect(roomService.joinRoom('1234567!')).rejects.toThrow('Invalid room code format');
  });

  test('joinRoom should throw error if room does not exist in DB', async () => {
    mockRoomRepo.findByCode.mockResolvedValue(null);
    await expect(roomService.joinRoom('A1B2C3D4')).rejects.toThrow('Room not found');
  });

  test('joinRoom should return room if 8-character code exists', async () => {
    const existing = { id: 2, code: 'A1B2C3D4', title: 'Lounge' };
    mockRoomRepo.findByCode.mockResolvedValue(existing);

    const room = await roomService.joinRoom('A1B2C3D4');
    expect(room).toEqual(existing);
    expect(mockRoomRepo.updateLastActive).toHaveBeenCalledWith('A1B2C3D4');
  });
});
