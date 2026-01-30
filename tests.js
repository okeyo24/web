const { describe, it, expect } = require('@jest/globals');
const MayonkBot = require('../structures/Mayonk');

describe('Mayonk Bot', () => {
  it('should load commands', () => {
    const bot = new MayonkBot(null, { prefix: '.' });
    bot.loadCommands();
    expect(bot.commands.size).toBeGreaterThan(0);
  });
  
  it('should handle ping command', async () => {
    const mockMessage = {
      content: '.ping',
      reply: jest.fn()
    };
    
    await bot.handleCommand(mockMessage);
    expect(mockMessage.reply).toHaveBeenCalled();
  });
});
