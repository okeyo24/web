const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    discord: {
      ready: req.client?.isReady() || false,
      ping: req.client?.ws.ping || 0,
      guilds: req.client?.guilds.cache.size || 0
    }
  };
  
  res.status(200).json(health);
});

router.get('/metrics', async (req, res) => {
  const metrics = {
    commands: {
      total: req.bot?.commands.size || 0,
      executed: req.bot?.stats.commandsExecuted || 0
    },
    plugins: {
      total: req.bot?.plugins.size || 0,
      active: req.bot?.plugins.filter(p => p.enabled).size || 0
    },
    performance: {
      responseTime: req.bot?.stats.avgResponseTime || 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    }
  };
  
  res.status(200).json(metrics);
});

module.exports = router;
