/**
 * Mayonk Bot Configuration
 * Version: 1.8.7
 * Owner: Laurie
 * 
 * This is the main configuration file for Mayonk Discord Bot.
 * All settings are centralized here for easy management.
 */

require('dotenv').config();
const path = require('path');

const config = {
  // =============================================
  // BOT CORE CONFIGURATION
  // =============================================
  bot: {
    // Basic Information
    name: process.env.BOT_NAME || "Mayonk",
    version: "1.8.7",
    prefix: process.env.BOT_PREFIX || ".",
    status: process.env.BOT_STATUS || "online",
    
    // Owner Information
    owner: {
      name: process.env.BOT_OWNER_NAME || "Laurie",
      id: process.env.BOT_OWNER_ID || "",
      username: process.env.BOT_OWNER_USERNAME || ""
    },
    
    // Activity Settings
    activity: {
      type: process.env.BOT_ACTIVITY_TYPE || "PLAYING",
      name: process.env.BOT_ACTIVITY_NAME || "with 321 plugins",
      url: process.env.BOT_ACTIVITY_URL || ""
    },
    
    // Colors for Embeds
    colors: {
      primary: "#5865F2",    // Discord Blurple
      success: "#57F287",    // Discord Green
      warning: "#FEE75C",    // Discord Yellow
      error: "#ED4245",      // Discord Red
      info: "#5865F2"        // Discord Blurple
    },
    
    // Performance
    responseTime: 0.1890, // ms
    plugins: 321,
    maxMemory: 62 * 1024, // MB
    currentMemory: 107    // MB
  },

  // =============================================
  // DISCORD CLIENT SETTINGS
  // =============================================
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID, // For development
    
    // Intents (All intents for full functionality)
    intents: [
      "Guilds",
      "GuildMembers",
      "GuildMessages",
      "MessageContent",
      "GuildMessageReactions",
      "GuildVoiceStates",
      "DirectMessages",
      "GuildPresences",
      "GuildMessageTyping",
      "DirectMessageReactions",
      "DirectMessageTyping"
    ],
    
    partials: [
      "Channel",
      "Message",
      "User",
      "Reaction",
      "GuildMember"
    ],
    
    // Sharding
    sharding: {
      enabled: process.env.SHARDING_ENABLED === "true" || false,
      totalShards: "auto"
    }
  },

  // =============================================
  // DATABASE CONFIGURATION
  // =============================================
  database: {
    // MongoDB (Primary Database)
    mongo: {
      enabled: process.env.MONGO_ENABLED !== "false",
      uri: process.env.MONGODB_URI || "mongodb://localhost:27017/mayonk",
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    },
    
    // Redis (Caching)
    redis: {
      enabled: process.env.REDIS_ENABLED === "true" || true,
      uri: process.env.REDIS_URI || "redis://localhost:6379",
      password: process.env.REDIS_PASSWORD || null,
      db: 0
    },
    
    // SQLite (Local Storage)
    sqlite: {
      enabled: process.env.SQLITE_ENABLED === "true" || false,
      path: path.join(__dirname, '../data/database.sqlite')
    }
  },

  // =============================================
  // API KEYS & EXTERNAL SERVICES
  // =============================================
  api: {
    // AI Services
    openai: {
      key: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
      model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7
    },
    
    google: {
      gemini: process.env.GEMINI_API_KEY,
      youtube: process.env.YOUTUBE_API_KEY
    },
    
    // Image Processing
    stabilityai: process.env.STABILITYAI_API_KEY,
    deepai: process.env.DEEPAI_API_KEY,
    remini: process.env.REMINI_API_KEY,
    
    // Other Services
    weather: process.env.WEATHER_API_KEY,
    imdb: process.env.IMDB_API_KEY,
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    },
    
    // Sports
    footballData: process.env.FOOTBALL_DATA_API_KEY
  },

  // =============================================
  // FEATURE TOGGLES
  // =============================================
  features: {
    // AI Features
    ai: {
      enabled: process.env.FEATURE_AI !== "false",
      chat: process.env.FEATURE_AI_CHAT !== "false",
      imageGeneration: process.env.FEATURE_AI_IMAGE === "true",
      translation: process.env.FEATURE_AI_TRANSLATE !== "false"
    },
    
    // Media Features
    media: {
      downloads: process.env.FEATURE_DOWNLOADS !== "false",
      imageProcessing: process.env.FEATURE_IMAGE_PROCESSING !== "false",
      audioProcessing: process.env.FEATURE_AUDIO_PROCESSING !== "false"
    },
    
    // Utility Features
    utility: {
      moderation: process.env.FEATURE_MODERATION !== "false",
      tools: process.env.FEATURE_TOOLS !== "false",
      games: process.env.FEATURE_GAMES !== "false",
      sports: process.env.FEATURE_SPORTS === "true"
    },
    
    // Group Features
    group: {
      welcomeMessages: process.env.FEATURE_WELCOME !== "false",
      autoModeration: process.env.FEATURE_AUTO_MOD === "true"
    }
  },

  // =============================================
  // PLUGIN SYSTEM
  // =============================================
  plugins: {
    total: 321,
    enabledByDefault: true,
    
    // Plugin Categories
    categories: {
      ai: ["gpt", "gemini", "deepseek", "llama", "dalle"],
      audio: ["bass", "deep", "robot", "earrape", "tomp3"],
      download: ["youtube", "tiktok", "instagram", "facebook"],
      image: ["remini", "ephoto360", "wallpaper"],
      group: ["antilink", "welcome", "kick", "ban", "poll"],
      tools: ["qrcode", "translate", "calculator", "weather"],
      games: ["truth", "dare", "trivia"],
      fun: ["jokes", "memes", "quotes", "facts"]
    }
  },

  // =============================================
  // SECURITY CONFIGURATION
  // =============================================
  security: {
    // Bot Owners
    owners: (process.env.BOT_OWNERS || "").split(",").filter(Boolean),
    
    // Rate Limiting
    rateLimiting: {
      enabled: process.env.RATE_LIMIT_ENABLED !== "false",
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
      max: parseInt(process.env.RATE_LIMIT_MAX) || 30
    },
    
    // Anti-Spam
    antiSpam: {
      enabled: process.env.ANTI_SPAM_ENABLED !== "false",
      threshold: parseInt(process.env.ANTI_SPAM_THRESHOLD) || 5,
      interval: parseInt(process.env.ANTI_SPAM_INTERVAL) || 5000
    },
    
    // Blacklist
    blacklist: {
      users: (process.env.BLACKLIST_USERS || "").split(",").filter(Boolean),
      guilds: (process.env.BLACKLIST_GUILDS || "").split(",").filter(Boolean)
    }
  },

  // =============================================
  // PERFORMANCE OPTIMIZATION
  // =============================================
  performance: {
    // Caching
    cache: {
      enabled: process.env.CACHE_ENABLED !== "false",
      ttl: parseInt(process.env.CACHE_TTL) || 3600,
      maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000
    },
    
    // Concurrency
    concurrency: {
      maxDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS) || 3,
      maxAiRequests: parseInt(process.env.MAX_CONCURRENT_AI_REQUESTS) || 5
    },
    
    // Timeouts
    timeouts: {
      command: parseInt(process.env.COMMAND_TIMEOUT) || 30000,
      download: parseInt(process.env.DOWNLOAD_TIMEOUT) || 60000,
      api: parseInt(process.env.API_TIMEOUT) || 15000
    }
  },

  // =============================================
  // LOGGING CONFIGURATION
  // =============================================
  logging: {
    // Console Logging
    console: {
      enabled: process.env.LOG_CONSOLE_ENABLED !== "false",
      level: process.env.LOG_CONSOLE_LEVEL || "info",
      timestamp: process.env.LOG_TIMESTAMP !== "false"
    },
    
    // File Logging
    file: {
      enabled: process.env.LOG_FILE_ENABLED === "true",
      level: process.env.LOG_FILE_LEVEL || "debug",
      directory: path.join(__dirname, '../logs'),
      maxSize: parseInt(process.env.LOG_MAX_SIZE_MB) || 10
    },
    
    // Discord Webhook Logging
    discord: {
      enabled: process.env.LOG_DISCORD_ENABLED === "true",
      webhookUrl: process.env.LOG_DISCORD_WEBHOOK,
      level: process.env.LOG_DISCORD_LEVEL || "error"
    }
  },

  // =============================================
  // PATHS & DIRECTORIES
  // =============================================
  paths: {
    root: __dirname,
    base: path.join(__dirname, '..'),
    
    // Source Directories
    src: path.join(__dirname, '../src'),
    commands: path.join(__dirname, '../commands'),
    events: path.join(__dirname, '../events'),
    plugins: path.join(__dirname, '../plugins'),
    utils: path.join(__dirname, '../utils'),
    
    // Data Directories
    data: path.join(__dirname, '../data'),
    temp: path.join(__dirname, '../temp'),
    cache: path.join(__dirname, '../cache'),
    logs: path.join(__dirname, '../logs')
  },

  // =============================================
  // COMMAND CONFIGURATION
  // =============================================
  commands: {
    // Command Categories
    categories: {
      ai: "🤖 AI",
      audio: "🎵 Audio",
      download: "📥 Download",
      image: "🖼️ Image",
      group: "👥 Group",
      tools: "🛠️ Tools",
      games: "🎮 Games",
      fun: "😄 Fun",
      sports: "⚽ Sports",
      owner: "👑 Owner"
    },
    
    // Cooldowns
    cooldowns: {
      enabled: true,
      default: 3, // seconds
      user: 5,
      guild: 2
    }
  },

  // =============================================
  // MESSAGE CONFIGURATION
  // =============================================
  messages: {
    // Default Messages
    defaults: {
      error: "❌ An error occurred. Please try again later.",
      noPermission: "🚫 You don't have permission to use this command.",
      commandDisabled: "🔒 This command is currently disabled.",
      rateLimited: "⏳ You're being rate limited. Please wait a moment.",
      maintenance: "🔧 The bot is currently under maintenance."
    },
    
    // Welcome Messages
    welcome: {
      enabled: process.env.WELCOME_MESSAGES !== "false",
      message: "Welcome {user} to {server}! 🎉",
      channel: "general"
    }
  },

  // =============================================
  // ENVIRONMENT & DEPLOYMENT
  // =============================================
  environment: {
    nodeEnv: process.env.NODE_ENV || "development",
    isProduction: process.env.NODE_ENV === "production",
    isDevelopment: process.env.NODE_ENV === "development",
    isTesting: process.env.NODE_ENV === "test"
  }
};

// =============================================
// HELPER METHODS
// =============================================

/**
 * Validate configuration
 * @returns {Object} Validation result
 */
config.validate = function() {
  const errors = [];
  const warnings = [];

  // Check required environment variables
  if (!this.discord.token) {
    errors.push("DISCORD_TOKEN is required in environment variables");
  }

  if (!this.discord.clientId) {
    warnings.push("DISCORD_CLIENT_ID is not set, some features may not work");
  }

  // Check database connections
  if (this.database.mongo.enabled && !this.database.mongo.uri) {
    warnings.push("MongoDB URI not set, using default localhost");
  }

  // Check API keys for enabled features
  if (this.features.ai.enabled && !this.api.openai.key && !this.api.google.gemini) {
    warnings.push("AI features enabled but no AI API keys provided");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date().toISOString()
  };
};

/**
 * Get configuration for a specific module
 * @param {string} module - Module name
 * @returns {Object} Module configuration
 */
config.getModuleConfig = function(module) {
  const modules = {
    ai: {
      ...this.api.openai,
      ...this.api.google,
      ...this.features.ai
    },
    download: {
      ...this.features.media,
      ...this.performance.concurrency
    },
    moderation: {
      ...this.security,
      ...this.features.group
    },
    database: this.database,
    logging: this.logging
  };

  return modules[module] || {};
};

/**
 * Apply environment-specific configuration
 */
config.applyEnvironmentConfig = function() {
  const env = this.environment.nodeEnv;
  
  const envConfigs = {
    development: {
      logging: {
        console: { level: 'debug' },
        file: { level: 'debug' }
      },
      performance: {
        cache: { ttl: 300 } // 5 minutes in dev
      }
    },
    production: {
      logging: {
        console: { level: 'info' },
        file: { level: 'warn' }
      },
      performance: {
        cache: { ttl: 3600 } // 1 hour in prod
      },
      security: {
        rateLimiting: { max: 10 } // More strict in prod
      }
    },
    test: {
      logging: {
        console: { enabled: false },
        file: { enabled: false }
      },
      features: {
        ai: { enabled: false },
        media: { downloads: false }
      }
    }
  };

  const envConfig = envConfigs[env] || {};
  
  // Deep merge configuration
  const merge = (target, source) => {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        merge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  };
  
  merge(this, envConfig);
};

// Apply environment-specific configuration
config.applyEnvironmentConfig();

module.exports = config;
