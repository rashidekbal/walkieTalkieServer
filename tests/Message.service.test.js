const { MessageServiceClass } = require('../src/services/Message.service');

describe('MessageService (Unit Tests)', () => {
  let mockMessageRepo;
  let mockRoomRepo;
  let messageService;

  beforeEach(() => {
    mockMessageRepo = {
      create: jest.fn(data => Promise.resolve({ id: 10, ...data, created_at: new Date() })),
      findByRoomCode: jest.fn(code => Promise.resolve([]))
    };
    mockRoomRepo = {
      findByCode: jest.fn(code => Promise.resolve({ id: 1, code, title: 'Lounge' })),
      updateLastActive: jest.fn()
    };
    messageService = new MessageServiceClass(mockMessageRepo, mockRoomRepo);
  });

  test('sendMessage should throw error if room code is invalid', async () => {
    await expect(messageService.sendMessage({ roomCode: 'invalid', content: 'hello' }))
      .rejects.toThrow('Invalid 8-character room code.');
  });

  test('sendMessage should throw error if room does not exist', async () => {
    mockRoomRepo.findByCode.mockResolvedValue(null);
    await expect(messageService.sendMessage({ roomCode: '12345678', content: 'hello' }))
      .rejects.toThrow('Room does not exist.');
  });

  test('sendMessage should save and return text message when valid', async () => {
    const msg = await messageService.sendMessage({
      roomCode: '12345678',
      senderName: 'Alice',
      content: 'Hello World',
      type: 'text'
    });

    expect(msg.roomCode).toBe('12345678');
    expect(msg.senderName).toBe('Alice');
    expect(msg.content).toBe('Hello World');
    expect(mockMessageRepo.create).toHaveBeenCalledTimes(1);
    expect(mockRoomRepo.updateLastActive).toHaveBeenCalledWith('12345678');
  });

  test('sendMessage should handle image / file media parameters', async () => {
    const msg = await messageService.sendMessage({
      roomCode: '12345678',
      senderName: 'Bob',
      type: 'image',
      content: 'Look at this photo',
      mediaUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      mediaPublicId: 'sample'
    });

    expect(msg.type).toBe('image');
    expect(msg.mediaUrl).toBe('https://res.cloudinary.com/demo/image/upload/sample.jpg');
  });
});
