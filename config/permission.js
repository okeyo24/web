const permissions = {
  user: [
    "ping", "help", "weather", "jokes",
    "memes", "quotes", "fact", "trivia"
  ],
  
  moderator: [
    "kick", "warn", "clear", "slowmode",
    "lock", "unlock", "addrole", "removerole"
  ],
  
  admin: [
    "ban", "mute", "setprefix", "settings",
    "autorole", "welcome", "antiraid"
  ],
  
  owner: [
    "eval", "exec", "restart", "shutdown",
    "blacklist", "broadcast", "update"
  ]
};

module.exports = permissions;
