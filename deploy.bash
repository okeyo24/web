#!/bin/bash

echo "🚀 Mayonk Bot Deployment Script"
echo "==============================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Clone repository
echo "📦 Cloning repository..."
git clone https://github.com/laurie/mayonk-bot.git
cd mayonk-bot

# Install dependencies
echo "📥 Installing dependencies..."
npm install --production

# Setup environment
echo "⚙️  Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Please edit .env file with your credentials"
    nano .env
fi

# Create required directories
echo "📁 Creating directories..."
mkdir -p logs data

# Start bot
echo "🤖 Starting Mayonk Bot..."
if command -v pm2 &> /dev/null; then
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    echo "✅ Bot started with PM2"
else
    npm start
fi

echo "🎉 Deployment complete!"
echo "📊 Check logs: tail -f logs/combined.log"
