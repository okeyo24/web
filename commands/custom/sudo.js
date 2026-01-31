const { addSudo, removeSudo, getSudoList } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');

// Constants
const CONSTANTS = {
    MESSAGES: {
        USAGE: `🤖 *SUDO COMMAND USAGE*\n\n` +
               `• \`.sudo add @mention/number\` - Add sudo user\n` +
               `• \`.sudo del @mention/number\` - Remove sudo user\n` +
               `• \`.sudo remove @mention/number\` - Remove sudo user\n` +
               `• \`.sudo list\` - List all sudo users\n\n` +
               `*Example:* \`.sudo add 91702395XXXX\``,
        ONLY_OWNER: '❌ Only the bot owner can add/remove sudo users.',
        NO_TARGET: '👤 Please mention a user or provide a phone number.',
        OWNER_PROTECTED: '👑 The owner cannot be removed from sudo list.',
        NO_SUDO_USERS: '📭 No sudo users found.',
        SUCCESS_ADD: (jid) => `✅ Added sudo user:\n\`${jid}\``,
        SUCCESS_REMOVE: (jid) => `✅ Removed sudo user:\n\`${jid}\``,
        FAILED_ADD: '❌ Failed to add sudo user.',
        FAILED_REMOVE: '❌ Failed to remove sudo user.',
        INVALID_COMMAND: '❌ Invalid subcommand. Use `.sudo` for usage.'
    },
    COMMANDS: {
        ADD: 'add',
        DELETE: 'del',
        REMOVE: 'remove',
        LIST: 'list'
    }
};

/**
 * Extract JID from message (mention or phone number)
 */
function extractTargetJid(message) {
    // Try to get mentioned JID
    const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentionedJids.length > 0) {
        return mentionedJids[0];
    }

    // Try to extract phone number from text
    const messageText = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || 
                       '';
    
    const phoneMatch = messageText.match(/\b(\d{7,15})\b/);
    if (phoneMatch) {
        const phone = phoneMatch[1];
        return phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    }

    return null;
}

/**
 * Validate JID format
 */
function isValidJid(jid) {
    if (!jid) return false;
    
    const patterns = [
        /^\d+@s\.whatsapp\.net$/,
        /^\d+@whatsapp\.net$/,
        /^\d+@lid$/,
        /^\d+:\d+@s\.whatsapp\.net$/
    ];
    
    return patterns.some(pattern => pattern.test(jid));
}

/**
 * Format sudo list for display
 */
function formatSudoList(sudoList) {
    if (!sudoList || sudoList.length === 0) {
        return CONSTANTS.MESSAGES.NO_SUDO_USERS;
    }

    const lines = ['👥 *SUDO USERS LIST*', ''];
    
    sudoList.forEach((jid, index) => {
        const number = jid.split('@')[0];
        const formattedNumber = number.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
        lines.push(`${index + 1}. \`${formattedNumber}\``);
    });
    
    lines.push('', `📊 Total: ${sudoList.length} user(s)`);
    return lines.join('\n');
}

/**
 * Validate command arguments
 */
function validateCommand(subCommand, targetJid = null) {
    // Check if subcommand is valid
    const validCommands = Object.values(CONSTANTS.COMMANDS);
    if (!validCommands.includes(subCommand)) {
        return { valid: false, message: CONSTANTS.MESSAGES.INVALID_COMMAND };
    }

    // For add/del/remove commands, need target JID
    const needsTarget = [CONSTANTS.COMMANDS.ADD, CONSTANTS.COMMANDS.DELETE, CONSTANTS.COMMANDS.REMOVE];
    if (needsTarget.includes(subCommand) && !targetJid) {
        return { valid: false, message: CONSTANTS.MESSAGES.NO_TARGET };
    }

    // Validate JID format if provided
    if (targetJid && !isValidJid(targetJid)) {
        return { valid: false, message: '❌ Invalid JID format.' };
    }

    return { valid: true };
}

/**
 * Main sudo command handler
 */
async function sudoCommand(sock, chatId, message) {
    try {
        // Extract sender information
        const senderJid = message.key.participant || message.key.remoteJid;
        const isFromMe = message.key.fromMe;
        
        // Check authorization
        const isAuthorized = isFromMe || await isOwnerOrSudo(senderJid, sock, chatId);
        
        // Extract command arguments
        const messageText = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || 
                           '';
        const args = messageText.trim().split(' ').slice(1);
        const subCommand = (args[0] || '').toLowerCase();

        // Show help if no subcommand
        if (!subCommand) {
            await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.USAGE }, 
                { quoted: message }
            );
            return;
        }

        // Extract target JID if needed
        const targetJid = extractTargetJid(message);

        // Validate command
        const validation = validateCommand(subCommand, targetJid);
        if (!validation.valid) {
            await sock.sendMessage(chatId, 
                { text: validation.message }, 
                { quoted: message }
            );
            return;
        }

        // Handle list command
        if (subCommand === CONSTANTS.COMMANDS.LIST) {
            const sudoList = await getSudoList();
            const listText = formatSudoList(sudoList);
            
            await sock.sendMessage(chatId, 
                { text: listText }, 
                { quoted: message }
            );
            return;
        }

        // Check owner authorization for add/remove commands
        if (!isAuthorized) {
            await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.ONLY_OWNER }, 
                { quoted: message }
            );
            return;
        }

        // Handle add command
        if (subCommand === CONSTANTS.COMMANDS.ADD) {
            const success = await addSudo(targetJid);
            
            await sock.sendMessage(chatId, 
                { 
                    text: success ? 
                        CONSTANTS.MESSAGES.SUCCESS_ADD(targetJid) : 
                        CONSTANTS.MESSAGES.FAILED_ADD 
                }, 
                { quoted: message }
            );
            return;
        }

        // Handle delete/remove commands
        if (subCommand === CONSTANTS.COMMANDS.DELETE || subCommand === CONSTANTS.COMMANDS.REMOVE) {
            // Prevent removing yourself if you're the owner
            if (isFromMe) {
                await sock.sendMessage(chatId, 
                    { text: CONSTANTS.MESSAGES.OWNER_PROTECTED }, 
                    { quoted: message }
                );
                return;
            }

            const success = await removeSudo(targetJid);
            
            await sock.sendMessage(chatId, 
                { 
                    text: success ? 
                        CONSTANTS.MESSAGES.SUCCESS_REMOVE(targetJid) : 
                        CONSTANTS.MESSAGES.FAILED_REMOVE 
                }, 
                { quoted: message }
            );
            return;
        }

    } catch (error) {
        console.error('❌ Error in sudo command:', error);
        
        // Determine appropriate error message
        let errorMessage = '❌ An error occurred while processing the command.';
        if (error.message && error.message.includes('permission')) {
            errorMessage = '❌ Permission denied.';
        } else if (error.message && error.message.includes('database')) {
            errorMessage = '❌ Database error. Please try again.';
        }

        try {
            await sock.sendMessage(chatId, 
                { text: errorMessage }, 
                { quoted: message }
            );
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
    }
}

module.exports = sudoCommand;
