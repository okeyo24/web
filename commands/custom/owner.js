const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'owner',
    description: 'Bot owner commands',
    
    async execute(sock, chatId, message, args) {
        const text = message.message?.conversation || '';
        
        // Check if sender is owner
        const ownerNumber = process.env.OWNER_NUMBER;
        const sender = message.key.participant || message.key.remoteJid;
        
        if (!sender.includes(ownerNumber)) {
            return await sock.sendMessage(chatId, {
                text: '❌ Owner only command'
            }, { quoted: message });
        }
        
        if (text.startsWith('.bc') || text.startsWith('.broadcast')) {
            return await this.broadcast(sock, chatId, message, args);
        } else if (text.startsWith('.restart')) {
            return await this.restartBot(sock, chatId, message);
        } else if (text.startsWith('.shutdown')) {
            return await this.shutdownBot(sock, chatId, message);
        } else if (text.startsWith('.eval')) {
            return await this.evalCode(sock, chatId, message, args);
        } else if (text.startsWith('.shell')) {
            return await this.shellCommand(sock, chatId, message, args);
        } else if (text.startsWith('.backup')) {
            return await this.backupData(sock, chatId, message);
        } else if (text.startsWith('.stats')) {
            return await this.showStats(sock, chatId, message);
        } else if (text.startsWith('.listgroups')) {
            return await this.listGroups(sock, chatId, message);
        }
    },
    
    async broadcast(sock, chatId, message, args) {
        try {
            const broadcastMessage = args.join(' ');
            if (!broadcastMessage) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Please provide a message to broadcast\nExample: .bc Hello everyone!'
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, {
                text: '📢 Starting broadcast...'
            });
            
            // Get all chats
            const chats = await sock.groupFetchAllParticipating();
            let sentCount = 0;
            let failedCount = 0;
            
            for (const groupId in chats) {
                try {
                    await sock.sendMessage(groupId, {
                        text: `📢 *Broadcast from Bot Owner*\n\n${broadcastMessage}\n\n_This is a broadcast message to all groups._`
                    });
                    sentCount++;
                    
                    // Delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`Failed to send to ${groupId}:`, error);
                    failedCount++;
                }
            }
            
            await sock.sendMessage(chatId, {
                text: `✅ Broadcast complete!\n\nSent: ${sentCount} groups\nFailed: ${failedCount} groups`
            });
            
        } catch (error) {
            console.error('Broadcast Error:', error);
            await sock.sendMessage(chatId, {
                text: '❌ Broadcast failed'
            }, { quoted: message });
        }
    },
    
    async restartBot(sock, chatId, message) {
        try {
            await sock.sendMessage(chatId, {
                text: '🔄 Restarting bot...'
            });
            
            // Restart process
            process.exit(0);
            
        } catch (error) {
            console.error('Restart Error:', error);
        }
    },
    
    async shutdownBot(sock, chatId, message) {
        try {
            await sock.sendMessage(chatId, {
                text: '🛑 Shutting down bot...'
            });
            
            // Close connection and exit
            await sock.end();
            process.exit(0);
            
        } catch (error) {
            console.error('Shutdown Error:', error);
        }
    },
    
    async showStats(sock, chatId, message) {
        try {
            const stats = {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                groups: Object.keys(await sock.groupFetchAllParticipating()).length,
                commands: global.commandStats || {}
            };
            
            const statsText = `
📊 *Bot Statistics*
          
⏱️ Uptime: ${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m
💾 Memory: ${Math.round(stats.memory.rss / 1024 / 1024)}MB
👥 Groups: ${stats.groups}
📈 Commands Today: ${Object.values(stats.commands).reduce((a, b) => a + b, 0)}
            `.trim();
            
            await sock.sendMessage(chatId, {
                text: statsText
            }, { quoted: message });
            
        } catch (error) {
            console.error('Stats Error:', error);
        }
    }
};
