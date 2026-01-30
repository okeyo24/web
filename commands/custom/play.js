const yts = require('yt-search');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
    API_ENDPOINT: 'https://apis-keith.vercel.app/download/dlmp3',
    MAX_RESULTS: 5,
    TIMEOUT: 30000, // 30 seconds
    TEMP_DIR: path.join(__dirname, '../temp/music')
};

/**
 * Ensure temporary directory exists
 */
async function ensureTempDir() {
    try {
        await fs.mkdir(CONFIG.TEMP_DIR, { recursive: true });
    } catch (error) {
        console.error('[Play] Failed to create temp directory:', error);
    }
}

/**
 * Extract search query from message
 * @param {object} message - WhatsApp message
 * @returns {string|null} Search query
 */
function extractSearchQuery(message) {
    try {
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text ||
                    message.message?.imageMessage?.caption ||
                    '';
        
        const args = text.trim().split(/\s+/);
        if (args.length < 2) return null;
        
        return args.slice(1).join(' ').trim();
    } catch (error) {
        console.error('[Play] Error extracting query:', error);
        return null;
    }
}

/**
 * Search for YouTube videos
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of video results
 */
async function searchYouTube(query) {
    try {
        const searchResults = await yts(query);
        return searchResults.videos || [];
    } catch (error) {
        console.error('[Play] YouTube search error:', error);
        throw new Error('Failed to search YouTube');
    }
}

/**
 * Fetch audio download URL from API
 * @param {string} youtubeUrl - YouTube video URL
 * @returns {Promise<{url: string, title: string, duration: string, thumbnail: string}>} Audio info
 */
async function fetchAudioInfo(youtubeUrl) {
    try {
        const response = await axios.get(CONFIG.API_ENDPOINT, {
            params: { url: youtubeUrl },
            timeout: CONFIG.TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (WhatsApp Music Bot)'
            }
        });

        const data = response.data;

        if (!data || !data.status || !data.result) {
            throw new Error('Invalid API response');
        }

        return {
            url: data.result.downloadUrl,
            title: data.result.title || 'Unknown Title',
            duration: data.result.duration || 'Unknown',
            thumbnail: data.result.thumbnail || null,
            size: data.result.size || null
        };
    } catch (error) {
        console.error('[Play] API fetch error:', error.message);
        
        if (error.code === 'ECONNABORTED') {
            throw new Error('API request timed out');
        } else if (error.response) {
            throw new Error(`API error: ${error.response.status}`);
        } else {
            throw new Error('Failed to fetch audio from service');
        }
    }
}

/**
 * Format duration from seconds to MM:SS
 * @param {string|number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    
    try {
        const totalSeconds = parseInt(seconds);
        const minutes = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    } catch {
        return seconds;
    }
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

/**
 * Send search results for user selection
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {Array} videos - Video results
 * @param {object} originalMessage - Original message
 */
async function sendSearchResults(sock, chatId, videos, originalMessage) {
    const results = videos.slice(0, CONFIG.MAX_RESULTS);
    
    let resultText = `🎵 *Search Results*\n\n`;
    resultText += `Found ${videos.length} results. Here are the top ${results.length}:\n\n`;
    
    results.forEach((video, index) => {
        const duration = formatDuration(video.timestamp || video.duration);
        resultText += `${index + 1}. *${video.title}*\n`;
        resultText += `   👤 ${video.author?.name || 'Unknown Author'}\n`;
        resultText += `   ⏱️ ${duration} | 👁️ ${video.views?.toString()?.replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0'} views\n`;
        resultText += `   🔗 ${video.url}\n\n`;
    });
    
    resultText += `📝 *How to download:*\n`;
    resultText += `Reply with *.play <number>* to download\n`;
    resultText += `Example: *.play 1* for first result\n\n`;
    resultText += `Or use: *.play <song name>* for new search`;
    
    await sock.sendMessage(chatId,
        { text: resultText },
        { quoted: originalMessage }
    );
}

/**
 * Main play command handler
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Original message
 * @param {Array} args - Command arguments
 */
async function playCommand(sock, chatId, message, args = []) {
    try {
        await ensureTempDir();
        
        // Check if user wants to select from previous results
        const firstArg = args[0];
        const isNumberSelection = /^\d+$/.test(firstArg);
        
        // For number selection, we'd need to maintain a session state
        // For now, let's handle regular search
        const searchQuery = isNumberSelection ? 
            (args.slice(1).join(' ') || extractSearchQuery(message)) : 
            (firstArg ? args.join(' ') : extractSearchQuery(message));
        
        // No query provided
        if (!searchQuery) {
            const helpText = `🎵 *Music Downloader*\n\n` +
                           `Download music from YouTube as MP3\n\n` +
                           `📋 *Usage:*\n` +
                           `• *.play <song name>* - Search and download\n` +
                           `• *.play <artist> - <song>* - More specific\n\n` +
                           `📝 *Examples:*\n` +
                           `• *.play Blinding Lights*\n` +
                           `• *.play The Weeknd*\n` +
                           `• *.play Shape of You Ed Sheeran*\n\n` +
                           `⚡ *Powered by YouTube Music API*`;
            
            await sock.sendMessage(chatId,
                { text: helpText },
                { quoted: message }
            );
            return;
        }
        
        // Send searching message
        const searchMessage = await sock.sendMessage(chatId,
            { text: `🔍 *Searching for:* "${searchQuery}"...` },
            { quoted: message }
        );
        
        // Search YouTube
        const videos = await searchYouTube(searchQuery);
        
        if (!videos || videos.length === 0) {
            await sock.sendMessage(chatId,
                { text: `❌ No results found for "${searchQuery}"\n\nTry a different search term.` },
                { quoted: message }
            );
            return;
        }
        
        // If multiple results, let user choose
        if (videos.length > 1 && !isNumberSelection) {
            await sendSearchResults(sock, chatId, videos, message);
            return;
        }
        
        // Get selected video (first one by default)
        const selectedIndex = isNumberSelection ? parseInt(firstArg) - 1 : 0;
        const video = videos[selectedIndex];
        
        if (!video) {
            await sock.sendMessage(chatId,
                { text: `❌ Invalid selection. Please choose a number between 1-${Math.min(videos.length, CONFIG.MAX_RESULTS)}` },
                { quoted: message }
            );
            return;
        }
        
        // Update status to downloading
        await sock.sendMessage(chatId,
            { text: `⬇️ *Downloading:* ${video.title}\n\n⏳ Please wait, this may take a moment...` },
            { quoted: message }
        );
        
        // Fetch audio info
        const audioInfo = await fetchAudioInfo(video.url);
        
        // Send downloading status
        const fileSize = formatFileSize(audioInfo.size);
        const duration = formatDuration(video.duration || video.timestamp || audioInfo.duration);
        
        const downloadInfo = `🎵 *Now Playing*\n\n` +
                           `📝 *Title:* ${audioInfo.title}\n` +
                           `👤 *Artist:* ${video.author?.name || 'Unknown'}\n` +
                           `⏱️ *Duration:* ${duration}\n` +
                           `📊 *Size:* ${fileSize}\n` +
                           `🔗 *Source:* YouTube\n\n` +
                           `📤 *Sending audio...*`;
        
        await sock.sendMessage(chatId,
            { text: downloadInfo },
            { quoted: message }
        );
        
        // Send the audio file
        await sock.sendMessage(chatId,
            {
                audio: { url: audioInfo.url },
                mimetype: 'audio/mpeg',
                fileName: `${audioInfo.title.replace(/[^\w\s]/gi, '')}.mp3`.substring(0, 100), // Limit filename length
                ptt: false // Not a push-to-talk voice message
            },
            { quoted: message }
        );
        
        // Send success confirmation
        await sock.sendMessage(chatId,
            { text: `✅ *Download Complete!*\n\nEnjoy your music! 🎧` },
            { quoted: message }
        );
        
    } catch (error) {
        console.error('[Play Command Error]:', error);
        
        let errorMessage;
        
        if (error.message.includes('timed out')) {
            errorMessage = `⏰ *Request Timeout*\n\nThe download took too long.\nPlease try again with a shorter video.`;
        } else if (error.message.includes('No results') || error.message.includes('Failed to search')) {
            errorMessage = `❌ *No Results Found*\n\nCould not find "${searchQuery}"\n\nTry:\n• Different keywords\n• Artist + song name\n• Check spelling`;
        } else if (error.message.includes('API error')) {
            errorMessage = `🔧 *Service Unavailable*\n\nThe music service is currently down.\nPlease try again in a few minutes.`;
        } else {
            errorMessage = `❌ *Download Failed*\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again later.`;
        }
        
        await sock.sendMessage(chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = playCommand;
