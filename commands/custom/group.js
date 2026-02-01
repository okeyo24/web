module.exports = {
    name: 'group',
    description: 'Group management commands',
    
    async execute(sock, chatId, message, args) {
        const text = message.message?.conversation || '';
        
        if (text.startsWith('.add')) {
            return await this.addMember(sock, chatId, message, args);
        } else if (text.startsWith('.kick')) {
            return await this.kickMember(sock, chatId, message, args);
        } else if (text.startsWith('.promote')) {
            return await this.promoteMember(sock, chatId, message, args);
        } else if (text.startsWith('.demote')) {
            return await this.demoteMember(sock, chatId, message, args);
        } else if (text.startsWith('.tagall')) {
            return await this.tagAllMembers(sock, chatId, message);
        } else if (text.startsWith('.mute')) {
            return await this.muteGroup(sock, chatId, message, args);
        } else if (text.startsWith('.unmute')) {
            return await this.unmuteGroup(sock, chatId, message);
        } else if (text.startsWith('.setdesc')) {
            return await this.setDescription(sock, chatId, message, args);
        } else if (text.startsWith('.setname')) {
            return await this.setGroupName(sock, chatId, message, args);
        } else if (text.startsWith('.welcome')) {
            return await this.setWelcome(sock, chatId, message, args);
        }
    },
    
    async addMember(sock, chatId, message, args) {
        try {
            // Check if sender is admin
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(p => p.id === message.key.participant);
            
            if (!participant || !participant.admin) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Only admins can add members'
                }, { quoted: message });
            }
            
            const phoneNumber = args[0];
            if (!phoneNumber || !phoneNumber.match(/^\d+$/)) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Invalid phone number\nExample: .add 919876543210'
                }, { quoted: message });
            }
            
            const jid = `${phoneNumber}@s.whatsapp.net`;
            await sock.groupParticipantsUpdate(chatId, [jid], 'add');
            
            await sock.sendMessage(chatId, { 
                text: `✅ Added ${phoneNumber} to the group`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Add Member Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to add member. Check if number is registered on WhatsApp.'
            }, { quoted: message });
        }
    },
    
    async kickMember(sock, chatId, message, args) {
        try {
            // Check admin status
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(p => p.id === message.key.participant);
            
            if (!participant || !participant.admin) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Only admins can kick members'
                }, { quoted: message });
            }
            
            const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mentionedJid) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Please mention the user to kick\nExample: .kick @username'
                }, { quoted: message });
            }
            
            await sock.groupParticipantsUpdate(chatId, [mentionedJid], 'remove');
            
            await sock.sendMessage(chatId, { 
                text: `✅ Kicked user from the group`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Kick Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to kick member'
            }, { quoted: message });
        }
    },
    
    async promoteMember(sock, chatId, message, args) {
        try {
            const metadata = await sock.groupMetadata(chatId);
            const sender = metadata.participants.find(p => p.id === message.key.participant);
            
            // Only admins can promote
            if (!sender || !sender.admin) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Only admins can promote members'
                }, { quoted: message });
            }
            
            const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mentionedJid) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Please mention the user to promote\nExample: .promote @username'
                }, { quoted: message });
            }
            
            await sock.groupParticipantsUpdate(chatId, [mentionedJid], 'promote');
            
            await sock.sendMessage(chatId, { 
                text: `✅ Promoted user to admin`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Promote Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to promote member'
            }, { quoted: message });
        }
    },
    
    async tagAllMembers(sock, chatId, message) {
        try {
            // Check if sender is admin
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(p => p.id === message.key.participant);
            
            if (!participant || !participant.admin) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Only admins can tag all members'
                }, { quoted: message });
            }
            
            const members = metadata.participants;
            let mentions = '';
            
            // Create mentions
            members.forEach(member => {
                mentions += `@${member.id.split('@')[0]} `;
            });
            
            const text = message.message?.extendedTextMessage?.text || '';
            const customMessage = text.replace('.tagall', '').trim();
            
            await sock.sendMessage(chatId, {
                text: customMessage ? `${customMessage}\n\n${mentions}` : `📢 Attention everyone!\n${mentions}`,
                mentions: members.map(m => m.id)
            }, { quoted: message });
            
        } catch (error) {
            console.error('TagAll Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to tag all members'
            }, { quoted: message });
        }
    },
    
    async muteGroup(sock, chatId, message, args) {
        try {
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(p => p.id === message.key.participant);
            
            if (!participant || !participant.admin) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Only admins can mute the group'
                }, { quoted: message });
            }
            
            const duration = args[0] || '60m';
            let seconds = 60 * 60; // Default 1 hour
            
            if (duration.endsWith('m')) {
                seconds = parseInt(duration) * 60;
            } else if (duration.endsWith('h')) {
                seconds = parseInt(duration) * 60 * 60;
            } else if (duration.endsWith('d')) {
                seconds = parseInt(duration) * 24 * 60 * 60;
            }
            
            await sock.groupSettingUpdate(chatId, 'announcement');
            
            await sock.sendMessage(chatId, { 
                text: `🔇 Group muted for ${duration}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Mute Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to mute group'
            }, { quoted: message });
        }
    },
    
    async unmuteGroup(sock, chatId, message) {
        try {
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(p => p.id === message.key.participant);
            
            if (!participant || !participant.admin) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Only admins can unmute the group'
                }, { quoted: message });
            }
            
            await sock.groupSettingUpdate(chatId, 'not_announcement');
            
            await sock.sendMessage(chatId, { 
                text: `🔊 Group unmuted`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Unmute Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to unmute group'
            }, { quoted: message });
        }
    },
    
    async setDescription(sock, chatId, message, args) {
        try {
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(p => p.id === message.key.participant);
            
            if (!participant || !participant.admin) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Only admins can change group description'
                }, { quoted: message });
            }
            
            const description = args.join(' ');
            if (!description) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Please provide a description\nExample: .setdesc Welcome to our group!'
                }, { quoted: message });
            }
            
            await sock.groupUpdateDescription(chatId, description);
            
            await sock.sendMessage(chatId, { 
                text: `✅ Group description updated`
            }, { quoted: message });
            
        } catch (error) {
            console.error('SetDesc Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to update description'
            }, { quoted: message });
        }
    },
    
    async setWelcome(sock, chatId, message, args) {
        try {
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(p => p.id === message.key.participant);
            
            if (!participant || !participant.admin) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Only admins can set welcome message'
                }, { quoted: message });
            }
            
            const welcomeMessage = args.join(' ');
            if (!welcomeMessage) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Please provide a welcome message\nExample: .welcome Welcome {user} to {group}!'
                }, { quoted: message });
            }
            
            // Store welcome message (you'd use a database in production)
            global.welcomeMessages = global.welcomeMessages || {};
            global.welcomeMessages[chatId] = welcomeMessage;
            
            await sock.sendMessage(chatId, { 
                text: `✅ Welcome message set:\n"${welcomeMessage}"`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Welcome Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to set welcome message'
            }, { quoted: message });
        }
    }
};
