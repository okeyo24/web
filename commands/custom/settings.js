const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

/**
 * Safely reads and parses a JSON file
 * @param {string} filePath - Path to the JSON file
 * @param {any} fallback - Default value if reading fails
 * @returns {any} Parsed JSON or fallback value
 */
function readJsonSafe(filePath, fallback = {}) {
    try {
        const text = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(text);
    } catch (error) {
        console.warn(`Failed to read ${filePath}:`, error.message);
        return fallback;
    }
}

/**
 * Reads all configuration files from the data directory
 * @param {string} dataDir - Path to data directory
 * @returns {Object} All configuration objects
 */
function loadConfigurations(dataDir) {
    const configs = {
        messageCount: readJsonSafe(path.join(dataDir, 'messageCount.json'), { isPublic: true }),
        autoStatus: readJsonSafe(path.join(dataDir, 'autoStatus.json'), { enabled: false }),
        autoread: readJsonSafe(path.join(dataDir, 'autoread.json'), { enabled: false }),
        autotyping: readJsonSafe(path.join(dataDir, 'autotyping.json'), { enabled: false }),
        pmblocker: readJsonSafe(path.join(dataDir, 'pmblocker.json'), { enabled: false }),
        anticall: readJsonSafe(path.join(dataDir, 'anticall.json'), { enabled: false }),
        userGroupData: readJsonSafe(path.join(dataDir, 'userGroupData.json'), {
            antilink: {}, 
            antibadword: {}, 
            welcome: {}, 
            goodbye: {}, 
            chatbot: {}, 
            antitag: {}
        })
    };
    
    return configs;
}

/**
 * Extracts group-specific settings from userGroupData
 * @param {Object} userGroupData - The userGroupData configuration
 * @param {string|null} groupId - Group ID or null for private chat
 * @returns {Object} Group-specific settings
 */
function getGroupSettings(userGroupData, groupId) {
    if (!groupId) return null;
    
    return {
        antilink: userGroupData.antilink[groupId],
        antibadword: userGroupData.antibadword[groupId],
        welcome: userGroupData.welcome[groupId],
        goodbye: userGroupData.goodbye[groupId],
        chatbot: userGroupData.chatbot[groupId],
        antitag: userGroupData.antitag[groupId]
    };
}

/**
 * Creates settings message text
 * @param {Object} configs - All configurations
 * @param {boolean} isGroup - Whether this is a group chat
 * @param {string|null} groupId - Group ID or null
 * @returns {string} Formatted settings message
 */
function createSettingsMessage(configs, isGroup, groupId) {
    const lines = [];
    const { 
        messageCount, 
        autoStatus, 
        autoread, 
        autotyping, 
        pmblocker, 
        anticall, 
        userGroupData 
    } = configs;
    
    lines.push('*🤖 BOT SETTINGS*');
    lines.push('');
    
    // Global settings
    lines.push('*Global Settings:*');
    lines.push(`• Mode: ${messageCount.isPublic ? '🌐 Public' : '🔒 Private'}`);
    lines.push(`• Auto Status: ${autoStatus.enabled ? '✅ ON' : '❌ OFF'}`);
    lines.push(`• Autoread: ${autoread.enabled ? '✅ ON' : '❌ OFF'}`);
    lines.push(`• Autotyping: ${autotyping.enabled ? '✅ ON' : '❌ OFF'}`);
    lines.push(`• PM Blocker: ${pmblocker.enabled ? '✅ ON' : '❌ OFF'}`);
    lines.push(`• Anticall: ${anticall.enabled ? '✅ ON' : '❌ OFF'}`);
    lines.push(`• Auto Reaction: ${userGroupData.autoReaction ? '✅ ON' : '❌ OFF'}`);
    
    // Group-specific settings
    if (isGroup && groupId) {
        lines.push('');
        lines.push(`*Group Settings (${groupId}):*`);
        
        const groupSettings = getGroupSettings(userGroupData, groupId);
        const settingsList = [
            { name: 'Antilink', data: groupSettings.antilink },
            { name: 'Antibadword', data: groupSettings.antibadword },
            { name: 'Welcome', data: groupSettings.welcome },
            { name: 'Goodbye', data: groupSettings.goodbye },
            { name: 'Chatbot', data: groupSettings.chatbot },
            { name: 'Antitag', data: groupSettings.antitag }
        ];
        
        settingsList.forEach(setting => {
            if (setting.data && typeof setting.data === 'object') {
                if (setting.data.enabled !== undefined) {
                    // For antitag which has enabled property
                    lines.push(`• ${setting.name}: ${setting.data.enabled ? `✅ ON (action: ${setting.data.action || 'delete'})` : '❌ OFF'}`);
                } else {
                    // For others where presence means enabled
                    lines.push(`• ${setting.name}: ✅ ON (action: ${setting.data.action || 'delete'})`);
                }
            } else {
                lines.push(`• ${setting.name}: ❌ OFF`);
            }
        });
    } else if (isGroup) {
        lines.push('');
        lines.push('*Note:* Group settings could not be loaded.');
    } else {
        lines.push('');
        lines.push('*Note:* Per-group settings are available when used inside a group.');
    }
    
    return lines.join('\n');
}

/**
 * Main settings command handler
 * @param {Object} sock - Socket connection
 * @param {string} chatId - Chat ID
 * @param {Object} message - Message object
 */
async function settingsCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        // Authorization check
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(
                chatId, 
                { text: '🚫 Only bot owner can use this command!' }, 
                { quoted: message }
            );
            return;
        }
        
        const isGroup = chatId.endsWith('@g.us');
        const dataDir = './data';
        
        // Load all configurations
        const configs = loadConfigurations(dataDir);
        
        // Create and send settings message
        const settingsText = createSettingsMessage(configs, isGroup, isGroup ? chatId : null);
        
        await sock.sendMessage(
            chatId, 
            { text: settingsText }, 
            { quoted: message }
        );
        
    } catch (error) {
        console.error('❌ Error in settings command:', error);
        
        try {
            await sock.sendMessage(
                chatId, 
                { text: '❌ Failed to read settings. Please check the configuration files.' }, 
                { quoted: message }
            );
        } catch (sendError) {
            console.error('Failed to send error message:', sendError);
        }
    }
}

module.exports = settingsCommand;
