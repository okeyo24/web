const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command')
    .addStringOption(option =>
      option.setName('input')
        .setDescription('Input text')
        .setRequired(true)),
  
  async execute(interaction, client) {
    const input = interaction.options.getString('input');
    
    // Command logic here
    const response = `You said: ${input}`;
    
    await interaction.reply({
      content: response,
      ephemeral: true
    });
  },
  
  config: {
    cooldown: 5, // seconds
    category: 'utility',
    permissions: ['SEND_MESSAGES']
  }
};
