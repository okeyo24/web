const fs = require('fs');
const path = require('path');

class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.loadCommands();
    }
    
    loadCommands() {
        const commandsDir = path.join(__dirname, 'commands');
        const categories = fs.readdirSync(commandsDir);
        
        categories.forEach(category => {
            const categoryPath = path.join(commandsDir, category);
            if (fs.statSync(categoryPath).isDirectory()) {
                const commandFiles = fs.readdirSync(categoryPath)
                    .filter(file => file.endsWith('.js'));
                
                commandFiles.forEach(file => {
                    try {
                        const command = require(path.join(categoryPath, file));
                        
                        if (command.name && command.execute) {
                            this.commands.set(command.name, command);
                            
                            // Add aliases if they exist
                            if (command.aliases) {
                                command.aliases.forEach(alias => {
                                    this.aliases.set(alias, command.name);
                                });
                            }
                            
                            console.log(`✅ Loaded command: ${command.name}`);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to load command ${file}:`, error);
                    }
                });
            }
        });
        
        console.log(`📦 Loaded ${this.commands.size} commands`);
    }
    
    async handleCommand(sock, chatId, message) {
        try {
            const text = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || '';
            
            if (!text.startsWith('.') && !text.startsWith('!')) return;
            
            const args = text.slice(1).split(' ');
            const commandName = args[0].toLowerCase();
            const commandArgs = args.slice(1);
            
            // Find command
            let command = this.commands.get(commandName) || 
                         this.commands.get(this.aliases.get(commandName));
            
            if (!command) return;
            
            // Execute command
            await command.execute(sock, chatId, message, commandArgs);
            
            // Track command usage
            global.commandStats = global.commandStats || {};
            global.commandStats[commandName] = (global.commandStats[commandName] || 0) + 1;
            
        } catch (error) {
            console.error('Command Handler Error:', error);
        }
    }
}

module.exports = CommandHandler;
