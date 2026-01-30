const fs = require('fs');

class MayonkBot {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.commands = new Map();
    this.plugins = new Map();
  }
  
  // Load all commands
  async loadCommands() {
    const commandFiles = fs.readdirSync('./commands');
    for (const file of commandFiles) {
      const command = require(`./commands/${file}`);
      this.commands.set(command.name, command);
    }
  }
  
  // Handle incoming commands
  async handleCommand(message) {
    const args = message.content.slice(this.config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = this.commands.get(commandName);
    if (!command) return;
    
    try {
      await command.execute(message, args, this.client);
    } catch (error) {
      console.error(error);
      message.reply('There was an error executing that command!');
    }
  }
  
  // Get bot statistics
  getStats() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      commands: this.commands.size,
      plugins: this.plugins.size,
      guilds: this.client.guilds.cache.size
    };
  }
}

module.exports = MayonkBot;
