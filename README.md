Mayonk is a comprehensive Discord bot built with modular architecture, offering 17 categories of functionality through 321+ plugins. Designed for performance (0.1890ms response time) and scalability.
Mayonk Discord Bot - Deployment Guide

🚀 One-Click Deploy

Free Hosting Options

1. Replit (Recommended for Free Tier)

https://replit.com/badge/github/laurie/mayonk-bot

replit.nix:

```nix
{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.nodePackages.npm
    pkgs.ffmpeg
    pkgs.python3
  ];
}
```

.replit:

```ini
run = "npm start"
language = "nodejs"
entrypoint = "src/index.js"
```

package.json modifications for Replit:

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "replit": "node --max-old-space-size=512 src/index.js"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

2. Glitch

https://cdn.glitch.com/2703baf2-b643-4da7-ab91-7ee2a2d00b5b%2Fremix-button.svg

.env on Glitch:

```env
DISCORD_TOKEN=your_token_here
PORT=3000
```

glitch.json:

```json
{
  "install": "npm install",
  "start": "node src/index.js",
  "watch": {
    "ignore": ["public/*", "logs/*"]
  }
}
```

3. Railway

https://railway.app/button.svg

railway.json:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100
  }
}
```

Paid Hosting Options

4. Heroku

https://www.herokucdn.com/deploy/button.svg

Procfile:

```procfile
worker: npm start
```

app.json:

```json
{
  "name": "Mayonk Discord Bot",
  "description": "Feature-rich Discord bot with 321+ plugins",
  "repository": "https://github.com/laurie/mayonk-bot",
  "logo": "https://i.imgur.com/.../logo.png",
  "keywords": ["discord", "bot", "nodejs", "javascript"],
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ],
  "env": {
    "DISCORD_TOKEN": {
      "description": "Your Discord bot token",
      "required": true
    },
    "PREFIX": {
      "description": "Bot command prefix",
      "value": ".",
      "required": true
    }
  }
}
```

5. Render

https://render.com/images/deploy-to-render-button.svg

render.yaml:

```yaml
services:
  - type: web
    name: mayonk-bot
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: DISCORD_TOKEN
        sync: false
      - key: NODE_ENV
        value: production
    healthCheckPath: /health
    autoDeploy: true
```

6. Fly.io

Dockerfile for Fly.io:

```dockerfile
# Use Node.js LTS
FROM node:18-alpine

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Start the bot
CMD ["node", "src/index.js"]
```

fly.toml:

```toml
app = "mayonk-bot"

[[services]]
  internal_port = 3000
  protocol = "tcp"
  
  [services.concurrency]
    hard_limit = 25
    soft_limit = 20
  
  [[services.ports]]
    port = 80
  
  [[services.ports]]
    port = 443

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

📊 Panel Hosting Configuration

Pterodactyl Panel

egg-mayonk.json:

```json
{
  "_comment": "Mayonk Discord Bot Egg for Pterodactyl",
  "meta": {
    "version": "1.0.0",
    "update_url": null
  },
  "exported_at": "2024-01-23T00:00:00Z",
  "name": "Mayonk Discord Bot",
  "author": "Laurie",
  "description": "Feature-rich Discord bot with 321+ plugins",
  "features": ["nodejs", "discord"],
  "docker_images": {
    "nodejs": "node:18-alpine"
  },
  "file_denylist": [],
  "startup": "node src/index.js",
  "config": {
    "files": "{}",
    "startup": {
      "done": "Online"
    },
    "logs": {
      "custom": false,
      "location": "logs/combined.log"
    },
    "stop": "\\^C",
    "install": [
      {
        "files": "https://raw.githubusercontent.com/laurie/mayonk-bot/main/install.sh",
        "type": "install_script"
      }
    ]
  },
  "scripts": {
    "installation": {
      "script": "#!bin/bash\\ncurl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -\\napt install -y nodejs git\\ngit clone https://github.com/laurie/mayonk-bot.git /mnt/server\\ncd /mnt/server\\nnpm install",
      "container": "node:18-alpine",
      "entrypoint": "ash"
    }
  },
  "variables": [
    {
      "name": "DISCORD_TOKEN",
      "description": "Your Discord bot token",
      "env_variable": "DISCORD_TOKEN",
      "default_value": "",
      "user_viewable": false,
      "user_editable": true,
      "rules": "required|string|min:10|max:200",
      "field_type": "text"
    },
    {
      "name": "PREFIX",
      "description": "Bot command prefix",
      "env_variable": "PREFIX",
      "default_value": ".",
      "user_viewable": true,
      "user_editable": true,
      "rules": "required|string|max:5",
      "field_type": "text"
    }
  ]
}
```

LICENCE 
MIT License

Copyright (c) 2024 Laurie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
