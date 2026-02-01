// ============================================
// Mayonk Bot - Settings & Configuration Module
// ============================================

const fs = require('fs');
const path = require('path');

class SettingsManager {
    constructor(client) {
        this.client = client;
        this.settingsDir = './data/settings';
        this.defaultSettings = this.getDefaultSettings();
        
        // Ensure settings directory exists
        if (!fs.existsSync(this.settingsDir)) {
            fs.mkdirSync(this.settingsDir, { recursive: true });
        }
    }
    
    // ============================================
    // Default Settings
    // ============================================
    getDefaultSettings() {
        return {
            // Bot Global Settings
            bot: {
                prefix: '!',
                language: 'en',
                logChannel: null,
                logLevel: 'info', // debug, info, warn, error
                timezone: 'UTC',
                embedColor: '#5865F2',
                autoUpdate: true
            },
            
            // Guild/Server Settings
            guild: {
                prefix: null, // Overrides global prefix if set
                language: 'en',
                autoMod: {
                    enabled: false,
                    antiSpam: true,
                    antiInvite: false,
                    antiMassMention: true,
                    maxWarns: 5,
                    warnAction: 'mute', // mute, kick, ban, none
                    ignoredChannels: [],
                    ignoredRoles: []
                },
                moderation: {
                    modLogChannel: null,
                    modRole: null,
                    adminRole: null,
                    muteRole: null,
                    warnThreshold: 3,
                    deleteCommands: true
                },
                welcome: {
                    enabled: false,
                    channel: null,
                    message: 'Welcome {user} to {server}!',
                    embed: true,
                    dmWelcome: false,
                    dmMessage: 'Welcome to {server}!',
                    assignRole: null,
                    embedColor: '#5865F2'
                },
                goodbye: {
                    enabled: false,
                    channel: null,
                    message: '{user} has left the server.',
                    embed: true,
                    embedColor: '#ED4245'
                },
                logging: {
                    enabled: false,
                    channel: null,
                    events: {
                        messageDelete: true,
                        messageEdit: true,
                        memberJoin: true,
                        memberLeave: true,
                        memberBan: true,
                        memberUnban: true,
                        memberUpdate: true,
                        channelCreate: true,
                        channelDelete: true,
                        roleCreate: true,
                        roleDelete: true
                    }
                },
                economy: {
                    enabled: false,
                    currency: '🪙',
                    currencyName: 'coins',
                    startingBalance: 100,
                    dailyAmount: 50,
                    workCooldown: 3600000, // 1 hour
                    gamblingEnabled: true
                },
                music: {
                    enabled: true,
                    defaultVolume: 50,
                    maxQueueSize: 50,
                    djRole: null,
                    allowSkipVote: true,
                    voteSkipRatio: 0.5, // 50% of listeners needed
                    leaveOnEmpty: true,
                    leaveTimeout: 300000 // 5 minutes
                },
                reactionRoles: {
                    enabled: false,
                    messages: {}
                },
                tickets: {
                    enabled: false,
                    category: null,
                    supportRoles: [],
                    logChannel: null,
                    ticketMessage: 'Thank you for creating a ticket! Support will be with you shortly.'
                },
                suggestions: {
                    enabled: false,
                    channel: null,
                    requireApproval: false,
                    approvalRole: null
                },
                starboard: {
                    enabled: false,
                    channel: null,
                    threshold: 3,
                    emoji: '⭐',
                    selfStar: false
                },
                automations: {
                    autoRoles: [],
                    leveling: {
                        enabled: false,
                        channel: null,
                        xpRate: 5,
                        xpCooldown: 60000, // 1 minute
                        levelRoles: {}
                    },
                    timedMessages: []
                },
                customCommands: {},
                ignoredChannels: [],
                disabledCommands: []
            },
            
            // User Settings
            user: {
                language: null, // Overrides guild language
                leveling: {
                    xp: 0,
                    level: 1,
                    totalXp: 0
                },
                economy: {
                    balance: 100,
                    bank: 0,
                    dailyStreak: 0,
                    lastDaily: null,
                    lastWork: null
                },
                preferences: {
                    dmNotifications: true,
                    commandNotifications: true,
                    embedStyle: 'default',
                    timezone: 'UTC',
                    privacyMode: false
                },
                statistics: {
                    commandsUsed: 0,
                    messagesSent: 0,
                    joinedAt: new Date().toISOString()
                }
            }
        };
    }
    
    // ============================================
    // Guild Settings Methods
    // ============================================
    
    /**
     * Get guild settings
     * @param {string} guildId - Discord guild ID
     * @returns {Object} Guild settings
     */
    getGuildSettings(guildId) {
        const filePath = path.join(this.settingsDir, `guild_${guildId}.json`);
        
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return { ...this.defaultSettings.guild, ...data };
            }
        } catch (error) {
            console.error(`Error reading guild settings for ${guildId}:`, error);
        }
        
        // Return default settings for new guilds
        const defaultSettings = this.defaultSettings.guild;
        this.setGuildSettings(guildId, defaultSettings);
        return defaultSettings;
    }
    
    /**
     * Set guild settings
     * @param {string} guildId - Discord guild ID
     * @param {Object} settings - New settings object
     */
    setGuildSettings(guildId, settings) {
        const filePath = path.join(this.settingsDir, `guild_${guildId}.json`);
        const mergedSettings = { ...this.defaultSettings.guild, ...settings };
        
        try {
            fs.writeFileSync(filePath, JSON.stringify(mergedSettings, null, 2));
        } catch (error) {
            console.error(`Error saving guild settings for ${guildId}:`, error);
        }
    }
    
    /**
     * Update specific guild setting
     * @param {string} guildId - Discord guild ID
     * @param {string} key - Setting key (e.g., 'prefix', 'welcome.enabled')
     * @param {any} value - New value
     */
    updateGuildSetting(guildId, key, value) {
        const settings = this.getGuildSettings(guildId);
        const keys = key.split('.');
        let current = settings;
        
        // Navigate to the nested key
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        // Set the value
        current[keys[keys.length - 1]] = value;
        this.setGuildSettings(guildId, settings);
        
        return this.getGuildSettings(guildId);
    }
    
    /**
     * Reset guild settings to default
     * @param {string} guildId - Discord guild ID
     */
    resetGuildSettings(guildId) {
        const defaultSettings = this.defaultSettings.guild;
        this.setGuildSettings(guildId, defaultSettings);
        return defaultSettings;
    }
    
    // ============================================
    // User Settings Methods
    // ============================================
    
    /**
     * Get user settings
     * @param {string} userId - Discord user ID
     * @returns {Object} User settings
     */
    getUserSettings(userId) {
        const filePath = path.join(this.settingsDir, `user_${userId}.json`);
        
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return { ...this.defaultSettings.user, ...data };
            }
        } catch (error) {
            console.error(`Error reading user settings for ${userId}:`, error);
        }
        
        // Return default settings for new users
        const defaultSettings = this.defaultSettings.user;
        this.setUserSettings(userId, defaultSettings);
        return defaultSettings;
    }
    
    /**
     * Set user settings
     * @param {string} userId - Discord user ID
     * @param {Object} settings - New settings object
     */
    setUserSettings(userId, settings) {
        const filePath = path.join(this.settingsDir, `user_${userId}.json`);
        const mergedSettings = { ...this.defaultSettings.user, ...settings };
        
        try {
            fs.writeFileSync(filePath, JSON.stringify(mergedSettings, null, 2));
        } catch (error) {
            console.error(`Error saving user settings for ${userId}:`, error);
        }
    }
    
    /**
     * Update specific user setting
     * @param {string} userId - Discord user ID
     * @param {string} key - Setting key
     * @param {any} value - New value
     */
    updateUserSetting(userId, key, value) {
        const settings = this.getUserSettings(userId);
        const keys = key.split('.');
        let current = settings;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        this.setUserSettings(userId, settings);
        
        return this.getUserSettings(userId);
    }
    
    // ============================================
    // Global Bot Settings
    // ============================================
    
    /**
     * Get global bot settings
     * @returns {Object} Global settings
     */
    getGlobalSettings() {
        const filePath = path.join(this.settingsDir, 'global.json');
        
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return { ...this.defaultSettings.bot, ...data };
            }
        } catch (error) {
            console.error('Error reading global settings:', error);
        }
        
        const defaultSettings = this.defaultSettings.bot;
        this.setGlobalSettings(defaultSettings);
        return defaultSettings;
    }
    
    /**
     * Set global bot settings
     * @param {Object} settings - New global settings
     */
    setGlobalSettings(settings) {
        const filePath = path.join(this.settingsDir, 'global.json');
        const mergedSettings = { ...this.defaultSettings.bot, ...settings };
        
        try {
            fs.writeFileSync(filePath, JSON.stringify(mergedSettings, null, 2));
        } catch (error) {
            console.error('Error saving global settings:', error);
        }
    }
    
    /**
     * Get effective prefix for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {string} Prefix to use
     */
    getPrefix(guildId) {
        if (!guildId) return this.getGlobalSettings().prefix;
        
        const guildSettings = this.getGuildSettings(guildId);
        return guildSettings.prefix || this.getGlobalSettings().prefix;
    }
    
    /**
     * Set prefix for a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} prefix - New prefix
     */
    setPrefix(guildId, prefix) {
        return this.updateGuildSetting(guildId, 'prefix', prefix);
    }
    
    // ============================================
    // Command Permissions & Disabled Commands
    // ============================================
    
    /**
     * Check if command is disabled in a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} commandName - Command name
     * @returns {boolean} True if disabled
     */
    isCommandDisabled(guildId, commandName) {
        if (!guildId) return false;
        
        const guildSettings = this.getGuildSettings(guildId);
        return guildSettings.disabledCommands.includes(commandName);
    }
    
    /**
     * Disable a command in a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} commandName - Command name
     */
    disableCommand(guildId, commandName) {
        const guildSettings = this.getGuildSettings(guildId);
        
        if (!guildSettings.disabledCommands.includes(commandName)) {
            guildSettings.disabledCommands.push(commandName);
            this.setGuildSettings(guildId, guildSettings);
        }
    }
    
    /**
     * Enable a command in a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} commandName - Command name
     */
    enableCommand(guildId, commandName) {
        const guildSettings = this.getGuildSettings(guildId);
        guildSettings.disabledCommands = guildSettings.disabledCommands.filter(
            cmd => cmd !== commandName
        );
        this.setGuildSettings(guildId, guildSettings);
    }
    
    // ============================================
    // Channel & Role Ignore Management
    // ============================================
    
    /**
     * Check if channel is ignored
     * @param {string} guildId - Discord guild ID
     * @param {string} channelId - Discord channel ID
     * @returns {boolean} True if ignored
     */
    isChannelIgnored(guildId, channelId) {
        const guildSettings = this.getGuildSettings(guildId);
        return guildSettings.ignoredChannels.includes(channelId);
    }
    
    /**
     * Add channel to ignore list
     * @param {string} guildId - Discord guild ID
     * @param {string} channelId - Discord channel ID
     */
    ignoreChannel(guildId, channelId) {
        const guildSettings = this.getGuildSettings(guildId);
        
        if (!guildSettings.ignoredChannels.includes(channelId)) {
            guildSettings.ignoredChannels.push(channelId);
            this.setGuildSettings(guildId, guildSettings);
        }
    }
    
    /**
     * Remove channel from ignore list
     * @param {string} guildId - Discord guild ID
     * @param {string} channelId - Discord channel ID
     */
    unignoreChannel(guildId, channelId) {
        const guildSettings = this.getGuildSettings(guildId);
        guildSettings.ignoredChannels = guildSettings.ignoredChannels.filter(
            id => id !== channelId
        );
        this.setGuildSettings(guildId, guildSettings);
    }
    
    // ============================================
    // Custom Commands Management
    // ============================================
    
    /**
     * Add custom command
     * @param {string} guildId - Discord guild ID
     * @param {string} trigger - Command trigger
     * @param {string} response - Command response
     * @param {string} type - Command type (text, embed)
     */
    addCustomCommand(guildId, trigger, response, type = 'text') {
        const guildSettings = this.getGuildSettings(guildId);
        guildSettings.customCommands[trigger] = {
            response,
            type,
            created: Date.now(),
            uses: 0
        };
        this.setGuildSettings(guildId, guildSettings);
    }
    
    /**
     * Remove custom command
     * @param {string} guildId - Discord guild ID
     * @param {string} trigger - Command trigger
     */
    removeCustomCommand(guildId, trigger) {
        const guildSettings = this.getGuildSettings(guildId);
        delete guildSettings.customCommands[trigger];
        this.setGuildSettings(guildId, guildSettings);
    }
    
    /**
     * Get custom command
     * @param {string} guildId - Discord guild ID
     * @param {string} trigger - Command trigger
     * @returns {Object|null} Custom command data
     */
    getCustomCommand(guildId, trigger) {
        const guildSettings = this.getGuildSettings(guildId);
        return guildSettings.customCommands[trigger] || null;
    }
    
    // ============================================
    // Statistics & Analytics
    // ============================================
    
    /**
     * Get guild statistics
     * @param {string} guildId - Discord guild ID
     * @returns {Object} Statistics
     */
    getGuildStats(guildId) {
        const filePath = path.join(this.settingsDir, `stats_${guildId}.json`);
        
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (error) {
            console.error(`Error reading guild stats for ${guildId}:`, error);
        }
        
        // Default stats
        const defaultStats = {
            commandsUsed: 0,
            messagesProcessed: 0,
            usersJoined: 0,
            usersLeft: 0,
            warningsGiven: 0,
            mutesGiven: 0,
            kicksGiven: 0,
            bansGiven: 0,
            ticketsCreated: 0,
            songsPlayed: 0,
            economyTransactions: 0,
            lastUpdated: Date.now()
        };
        
        this.setGuildStats(guildId, defaultStats);
        return defaultStats;
    }
    
    /**
     * Update guild statistics
     * @param {string} guildId - Discord guild ID
     * @param {Object} stats - Updated statistics
     */
    setGuildStats(guildId, stats) {
        const filePath = path.join(this.settingsDir, `stats_${guildId}.json`);
        
        try {
            stats.lastUpdated = Date.now();
            fs.writeFileSync(filePath, JSON.stringify(stats, null, 2));
        } catch (error) {
            console.error(`Error saving guild stats for ${guildId}:`, error);
        }
    }
    
    /**
     * Increment a guild statistic
     * @param {string} guildId - Discord guild ID
     * @param {string} statName - Statistic name
     * @param {number} amount - Amount to increment
     */
    incrementGuildStat(guildId, statName, amount = 1) {
        const stats = this.getGuildStats(guildId);
        
        if (typeof stats[statName] === 'number') {
            stats[statName] += amount;
            this.setGuildStats(guildId, stats);
        }
    }
    
    // ============================================
    // Utility Methods
    // ============================================
    
    /**
     * Export all settings for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Object} Complete guild data
     */
    exportGuildData(guildId) {
        return {
            settings: this.getGuildSettings(guildId),
            stats: this.getGuildStats(guildId),
            exportDate: Date.now(),
            version: '2.5.0'
        };
    }
    
    /**
     * Import guild data
     * @param {string} guildId - Discord guild ID
     * @param {Object} data - Guild data to import
     */
    importGuildData(guildId, data) {
        if (data.settings) {
            this.setGuildSettings(guildId, data.settings);
        }
        if (data.stats) {
            this.setGuildStats(guildId, data.stats);
        }
    }
    
    /**
     * Clean up old/unused settings files
     * @param {Array} activeGuildIds - Array of active guild IDs
     */
    cleanupOldFiles(activeGuildIds = []) {
        try {
            const files = fs.readdirSync(this.settingsDir);
            
            for (const file of files) {
                if (file.startsWith('guild_')) {
                    const guildId = file.replace('guild_', '').replace('.json', '');
                    
                    // Remove settings for guilds the bot is no longer in
                    if (!activeGuildIds.includes(guildId)) {
                        fs.unlinkSync(path.join(this.settingsDir, file));
                        
                        // Also remove stats file if exists
                        const statsFile = `stats_${guildId}.json`;
                        if (fs.existsSync(path.join(this.settingsDir, statsFile))) {
                            fs.unlinkSync(path.join(this.settingsDir, statsFile));
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error cleaning up old files:', error);
        }
    }
}

module.exports = SettingsManager;
