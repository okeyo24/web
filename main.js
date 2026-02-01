// ============================================
// Mayonk Discord Bot - Main Entry Point
// ============================================

// Import required modules
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { readdirSync } = require('fs');
require('dotenv').config();

// Configuration
const config = {
    prefix: process.env.PREFIX || '!',
    owners: process.env.OWNERS ? process.env.OWNERS.split(',') : [],
    colors: {
        primary: '#5865F2',
        success: '#57F287',
        warning: '#FEE75C',
        error: '#ED4245',
        info: '#5865F2'
    }
};

// Create a new Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildInvites
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
    ],
    allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: true
    },
    presence: {
        status: 'online',
        activities: [{
            name: 'Starting up...',
            type: 0 // PLAYING
        }]
    }
});

// Attach config to client
client.config = config;

// Collections for commands, events, and cooldowns
client.commands = new Collection();
client.slashCommands = new Collection();
client.aliases = new Collection();
client.events = new Collection();
client.cooldowns = new Collection();
client.categories = new Set();

// ============================================
// Load Command Handler
// ============================================
const loadCommands = () => {
    console.log('📁 Loading commands...');
    
    const commandFolders = readdirSync('./commands');
    
    for (const folder of commandFolders) {
        client.categories.add(folder);
        const commandFiles = readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
        
        console.log(`  📂 Category: ${folder} (${commandFiles.length} commands)`);
        
        for (const file of commandFiles) {
            const command = require(`./commands/${folder}/${file}`);
            
            // Validate command structure
            if (!command.name || !command.execute) {
                console.warn(`⚠️  Command ${file} is missing name or execute function`);
                continue;
            }
            
            // Set command in collection
            client.commands.set(command.name, command);
            
            // Set aliases if they exist
            if (command.aliases && Array.isArray(command.aliases)) {
                for (const alias of command.aliases) {
                    client.aliases.set(alias, command.name);
                }
            }
            
            // Set category
            command.category = folder;
        }
    }
    
    console.log(`✅ Loaded ${client.commands.size} commands from ${client.categories.size} categories\n`);
};

// ============================================
// Load Slash Commands
// ============================================
const loadSlashCommands = () => {
    console.log('📁 Loading slash commands...');
    
    try {
        const slashCommands = readdirSync('./slash-commands');
        
        for (const folder of slashCommands) {
            const commandFiles = readdirSync(`./slash-commands/${folder}`).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const command = require(`./slash-commands/${folder}/${file}`);
                
                if (!command.data || !command.execute) {
                    console.warn(`⚠️  Slash command ${file} is missing data or execute function`);
                    continue;
                }
                
                client.slashCommands.set(command.data.name, command);
                console.log(`  ✅ Loaded slash command: /${command.data.name}`);
            }
        }
        
        console.log(`✅ Loaded ${client.slashCommands.size} slash commands\n`);
    } catch (error) {
        console.log('ℹ️  No slash commands folder found\n');
    }
};

// ============================================
// Load Event Handler
// ============================================
const loadEvents = () => {
    console.log('📁 Loading events...');
    
    const eventFiles = readdirSync('./events').filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const event = require(`./events/${file}`);
        
        if (!event.name || !event.execute) {
            console.warn(`⚠️  Event ${file} is missing name or execute function`);
            continue;
        }
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        
        console.log(`  ✅ Loaded event: ${event.name}`);
    }
    
    console.log(`✅ Loaded ${eventFiles.length} events\n`);
};

// ============================================
// Load Functions/Utilities
// ============================================
const loadFunctions = () => {
    console.log('📁 Loading utilities...');
    
    // Create utils object on client if it doesn't exist
    client.utils = client.utils || {};
    
    const functionFiles = readdirSync('./functions').filter(file => file.endsWith('.js'));
    
    for (const file of functionFiles) {
        const functionName = file.split('.')[0];
        client.utils[functionName] = require(`./functions/${file}`);
        console.log(`  ✅ Loaded utility: ${functionName}`);
    }
    
    console.log(`✅ Loaded ${functionFiles.length} utilities\n`);
};

// ============================================
// Error Handling
// ============================================
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('uncaughtExceptionMonitor', (error) => {
    console.error('❌ Uncaught Exception Monitor:', error);
});

client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

client.on('warn', (warning) => {
    console.warn('⚠️  Discord Client Warning:', warning);
});

client.on('shardError', (error) => {
    console.error('❌ Shard Error:', error);
});

// ============================================
// Bot Status Rotation
// ============================================
const updateStatus = () => {
    const statuses = [
        { name: `${client.guilds.cache.size} servers`, type: 3 }, // WATCHING
        { name: `${client.commands.size} commands`, type: 2 }, // LISTENING
        { name: 'Version 2.5.0', type: 0 }, // PLAYING
        { name: '321+ plugins', type: 5 }, // COMPETING
        { name: '/help for commands', type: 0 }, // PLAYING
        { name: 'Moderation Tools', type: 0 }, // PLAYING
        { name: `${client.users.cache.size} users`, type: 3 } // WATCHING
    ];
    
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    client.user.setPresence({
        activities: [status],
        status: 'online'
    });
};

// ============================================
// Bot Startup Sequence
// ============================================
const startup = async () => {
    console.log('🚀 Starting Mayonk Bot...');
    console.log('='.repeat(50));
    
    // Load all handlers
    loadCommands();
    loadSlashCommands();
    loadEvents();
    loadFunctions();
    
    // Database connection example (uncomment if using)
    /*
    const { connectDatabase } = require('./database/connection');
    await connectDatabase();
    */
    
    console.log('='.repeat(50));
    console.log('✅ All systems loaded successfully!');
    console.log('='.repeat(50));
};

// ============================================
// Bot Login
// ============================================
const token = process.env.DISCORD_TOKEN || require('./config.json').token;

if (!token) {
    console.error('❌ ERROR: Discord token not found!');
    console.error('Please add your token to:');
    console.error('1. .env file as DISCORD_TOKEN=your_token_here');
    console.error('2. Or config.json as { "token": "your_token_here" }');
    process.exit(1);
}

// Initialize bot
startup().then(() => {
    client.login(token)
        .then(() => {
            console.log(`✅ Logged in as ${client.user.tag}`);
            console.log(`📊 Guilds: ${client.guilds.cache.size}`);
            console.log(`👥 Users: ${client.users.cache.size}`);
            
            // Set initial status and rotate every 60 seconds
            updateStatus();
            setInterval(updateStatus, 60000);
            
            // Export client for use in other modules
            module.exports = client;
        })
        .catch(error => {
            console.error('❌ Failed to login:', error);
            process.exit(1);
        });
});
