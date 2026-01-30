const os = require('os');
const settings = require('../settings.js');

/**
 * Format seconds into human readable time
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}

/**
 * Get system information
 * @returns {object} System metrics
 */
function getSystemInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = ((usedMem / totalMem) * 100).toFixed(1);

    return {
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        totalMemory: (totalMem / 1024 / 1024 / 1024).toFixed(2),
        usedMemory: (usedMem / 1024 / 1024 / 1024).toFixed(2),
        memoryUsage: memoryUsage,
        loadAvg: os.loadavg()[0].toFixed(2)
    };
}

/**
 * Get bot performance metrics
 * @returns {object} Performance data
 */
function getPerformanceMetrics() {
    const memoryUsage = process.memoryUsage();
    
    return {
        rss: (memoryUsage.rss / 1024 / 1024).toFixed(2), // Resident Set Size
        heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        external: (memoryUsage.external / 1024 / 1024).toFixed(2),
        arrayBuffers: (memoryUsage.arrayBuffers / 1024 / 1024).toFixed(2)
    };
}

/**
 * Format response message with box styling
 * @param {object} data - Bot and system data
 * @returns {string} Formatted message
 */
function formatStatusMessage(data) {
    const { ping, uptime, system, performance } = data;
    
    return `
╔═══════════════════════════╗
║     🤖 𝐁𝐨𝐭 𝐒𝐭𝐚𝐭𝐮𝐬       ║
╠═══════════════════════════╣
║ 📶 Ping       : ${ping.toString().padEnd(6)} ms
║ ⏱️ Uptime     : ${uptime}
║ 🔖 Version    : v${settings.version}
╠═══════════════════════════╣
║     🖥️ 𝐒𝐲𝐬𝐭𝐞𝐦 𝐈𝐧𝐟𝐨       ║
╠═══════════════════════════╣
║ 🏷️ Platform   : ${system.platform}
║ 🏗️ Architecture : ${system.arch}
║ 🧠 CPU Cores  : ${system.cpuCount}
║ 📊 CPU Load   : ${system.loadAvg}
║ 💾 RAM Usage  : ${system.memoryUsage}%
║ 💿 RAM Total  : ${system.totalMemory} GB
╠═══════════════════════════╣
║     📈 𝐏𝐞𝐫𝐟𝐨𝐫𝐦𝐚𝐧𝐜𝐞      ║
╠═══════════════════════════╣
║ 📊 RSS Memory : ${performance.rss} MB
║ 🧠 Heap Used  : ${performance.heapUsed} MB
║ 🧾 Heap Total : ${performance.heapTotal} MB
║ 🔗 External   : ${performance.external} MB
╚═══════════════════════════╝`.trim();
}

/**
 * Main ping command handler
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Original message
 */
async function pingCommand(sock, chatId, message) {
    try {
        // Initial ping test
        const startTime = Date.now();
        const pingMessage = await sock.sendMessage(chatId, 
            { text: '🏓 Pinging...' },
            { quoted: message }
        );
        const endTime = Date.now();
        
        // Calculate round-trip ping
        const pingTime = Math.round((endTime - startTime) / 2);
        
        // Calculate response time (server processing)
        const responseTime = endTime - startTime;
        
        // Get system information
        const uptime = formatUptime(process.uptime());
        const systemInfo = getSystemInfo();
        const performanceMetrics = getPerformanceMetrics();
        
        // Prepare status data
        const statusData = {
            ping: pingTime,
            response: responseTime,
            uptime: uptime,
            system: systemInfo,
            performance: performanceMetrics
        };
        
        // Format and send status message
        const statusMessage = formatStatusMessage(statusData);
        
        await sock.sendMessage(chatId,
            { text: statusMessage },
            { quoted: message }
        );
        
    } catch (error) {
        console.error('[Ping Command Error]:', error);
        
        // Try to send simplified error message
        try {
            const errorMessage = `
⚠️ *Bot Status Error*

❌ Failed to retrieve complete status.
📊 Basic Info:
• Version: v${settings.version}
• Uptime: ${formatUptime(process.uptime())}
• Error: ${error.message || 'Unknown'}

Try again in a moment.`.trim();
            
            await sock.sendMessage(chatId,
                { text: errorMessage },
                { quoted: message }
            );
        } catch (sendError) {
            console.error('Failed to send error message:', sendError);
        }
    }
}

module.exports = pingCommand;
