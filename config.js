module.exports = {
  // Bot Settings
  prefix: ".",
  owners: ["123456789012345678"],
  
  // Module Toggles
  modules: {
    ai: true,
    moderation: true,
    downloads: true,
    games: true,
    tools: true
  },
  
  // API Keys
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    unsplash: process.env.UNSPLASH_ACCESS_KEY
  },
  
  // Rate Limiting
  rateLimit: {
    enabled: true,
    windowMs: 60000,
    maxRequests: 60
  },
  
  // Logging
  logging: {
    level: "info",
    file: "logs/mayonk.log",
    errorFile: "logs/errors.log"
  }
};
