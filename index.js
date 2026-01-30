const { Client, IntentsBitField } = require('discord.js');
const config = require('./config/config');
const MayonkBot = require('./structures/Mayonk');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers
  ]
});

const bot = new MayonkBot(client, config);

client.on('ready', () => {
  console.log(`✅ ${client.user.tag} is online!`);
  console.log(`📊 Loaded ${bot.commands.size} commands`);
  console.log(`🔌 ${bot.plugins.size} plugins active`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  // Handle commands
  if (message.content.startsWith(config.prefix)) {
    await bot.handleCommand(message);
  }
  
  // Handle AI chat
  if (bot.config.modules.ai && message.mentions.has(client.user.id)) {
    await bot.handleAIResponse(message);
  }
});

client.login(process.env.DISCORD_TOKEN);
