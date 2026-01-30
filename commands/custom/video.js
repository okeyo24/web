const axios = require('axios');
const yts = require('yt-search');

// Configuration
const CONFIG = {
    // API endpoints with fallbacks
    API_PROVIDERS: [
        {
            name: 'Yupra',
            url: 'https://api.yupra.my.id/api/downloader/ytmp4',
            extractor: (data) => ({
                download: data?.data?.download_url,
                title: data?.data?.title,
                thumbnail: data?.data?.thumbnail,
                quality: data?.data?.quality,
                size: data?.data?.size
            })
        },
        {
            name: 'Okatsu',
            url: 'https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4',
            extractor: (data) => ({
                download: data?.result?.mp4,
                title: data?.result?.title,
                thumbnail: null,
                quality: null,
                size: null
            })
        }
    ],
    
    // Request configuration
    REQUEST_CONFIG: {
        timeout: 45000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.youtube.com/'
        }
    },
    
    // Search configuration
    MAX_SEARCH_RESULTS: 5,
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

/**
 * Retry a failed request with exponential backoff
 * @param {Function} requestFn - Function that returns a promise
 * @param {number} maxAttempts - Maximum retry attempts
 * @returns {Promise<any>} Request result
 */
async function retryRequest(requestFn, maxAttempts = CONFIG.MAX_RETRY_ATTEMPTS) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await requestFn();
        } catch (error) {
            lastError = error;
            
            if (attempt < maxAttempts) {
                const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * Extract YouTube video ID from URL
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID
 */
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}

/**
 * Validate if string is a YouTube URL
 * @param {string} input - Input string
 * @returns {boolean} True if valid YouTube URL
 */
function isYouTubeUrl(input) {
    return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+/.test(input.trim());
}

/**
 * Search for YouTube videos
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of video results
 */
async function searchYouTube(query) {
    try {
        const searchResults = await yts(query);
        return searchResults.videos?.slice(0, CONFIG.MAX_SEARCH_RESULTS) || [];
    } catch (error) {
        console.error('[Video] YouTube search error:', error.message);
        throw new Error(`Search failed: ${error.message}`);
    }
}

/**
 * Fetch video from API provider
 * @param {string} providerUrl - API provider URL
 * @param {string} youtubeUrl - YouTube URL
 * @param {Function} extractor - Data extractor function
 * @returns {Promise<object>} Video data
 */
async function fetchFromProvider(providerUrl, youtubeUrl, extractor) {
    try {
        const response = await axios.get(providerUrl, {
            params: { url: youtubeUrl },
            ...CONFIG.REQUEST_CONFIG
        });
        
        const videoData = extractor(response.data);
        
        if (!videoData.download) {
            throw new Error('No download URL in response');
        }
        
        return videoData;
    } catch (error) {
        console.error(`[Video] Provider error:`, error.message);
        throw error;
    }
}

/**
 * Get video download URL from available providers
 * @param {string} youtubeUrl - YouTube URL
 * @returns {Promise<object>} Video data
 */
async function getVideoDownload(youtubeUrl) {
    for (const provider of CONFIG.API_PROVIDERS) {
        try {
            console.log(`[Video] Trying ${provider.name}...`);
            const videoData = await retryRequest(
                () => fetchFromProvider(provider.url, youtubeUrl, provider.extractor)
            );
            
            console.log(`[Video] Success from ${provider.name}`);
            return {
                ...videoData,
                provider: provider.name
            };
        } catch (error) {
            console.log(`[Video] ${provider.name} failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('All video providers failed');
}

/**
 * Get YouTube thumbnail URL
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Thumbnail quality (default, hq, sd, maxres)
 * @returns {string} Thumbnail URL
 */
function getYouTubeThumbnail(videoId, quality = 'sd') {
    const qualities = {
        'default': `https://i.ytimg.com/vi/${videoId}/default.jpg`,
        'hq': `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        'sd': `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
        'maxres': `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    };
    
    return qualities[quality] || qualities.sd;
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Send search results for selection
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {Array} videos - Video results
 * @param {object} message - Original message
 */
async function sendSearchResults(sock, chatId, videos, message) {
    let resultText = `🎬 *YouTube Search Results*\n\n`;
    resultText += `Found ${videos.length} videos:\n\n`;
    
    videos.forEach((video, index) => {
        const duration = video.timestamp || video.duration || 'Unknown';
        const views = video.views ? video.views.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : 'Unknown';
        
        resultText += `${index + 1}. *${video.title}*\n`;
        resultText += `   👤 ${video.author?.name || 'Unknown'}\n`;
        resultText += `   ⏱️ ${duration} | 👁️ ${views} views\n`;
        resultText += `   🔗 ${video.url}\n\n`;
    });
    
    resultText += `📝 *How to download:*\n`;
    resultText += `Reply with *.video <number>*\n`;
    resultText += `Example: *.video 1* for first result\n\n`;
    resultText += `Or use *.video <search term>* for new search`;
    
    await sock.sendMessage(chatId,
        { text: resultText },
        { quoted: message }
    );
}

/**
 * Main video command handler
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Original message
 * @param {Array} args - Command arguments
 */
async function videoCommand(sock, chatId, message, args = []) {
    try {
        const input = args.join(' ').trim();
        
        // No input provided
        if (!input) {
            const helpText = `🎬 *YouTube Video Downloader*\n\n` +
                           `Download videos from YouTube\n\n` +
                           `📋 *Usage:*\n` +
                           `• *.video <search term>* - Search and download\n` +
                           `• *.video <youtube url>* - Download from URL\n` +
                           `• *.video <number>* - Select from search results\n\n` +
                           `📝 *Examples:*\n` +
                           `• *.video never gonna give you up*\n` +
                           `• *.video https://youtu.be/dQw4w9WgXcQ*\n` +
                           `• *.video 1* (after search)\n\n` +
                           `⚡ *Supports:* MP4 format, various qualities`;
            
            await sock.sendMessage(chatId,
                { text: helpText },
                { quoted: message }
            );
            return;
        }
        
        // Check if input is a number (for selection)
        const isNumberSelection = /^\d+$/.test(args[0]);
        let videoUrl, videoTitle, videoThumbnail, videoId;
        
        if (isNumberSelection) {
            // Number selection would require maintaining search context
            // For now, treat as regular search
            await sock.sendMessage(chatId,
                { text: '⚠️ Number selection requires previous search. Please use *.video <search term>* first.' },
                { quoted: message }
            );
            return;
        }
        
        // Check if input is YouTube URL
        if (isYouTubeUrl(input)) {
            videoUrl = input;
            videoId = extractYouTubeId(input);
            
            if (!videoId) {
                await sock.sendMessage(chatId,
                    { text: '❌ Invalid YouTube URL\n\nPlease provide a valid YouTube video link.' },
                    { quoted: message }
                );
                return;
            }
            
            // Get video info from YouTube (would need additional API)
            videoTitle = `YouTube Video (${videoId})`;
            videoThumbnail = getYouTubeThumbnail(videoId);
        } else {
            // Search YouTube
            await sock.sendMessage(chatId,
                { text: `🔍 *Searching YouTube for:*\n"${input}"` },
                { quoted: message }
            );
            
            const videos = await searchYouTube(input);
            
            if (videos.length === 0) {
                await sock.sendMessage(chatId,
                    { text: `❌ No videos found for "${input}"\n\nTry different keywords.` },
                    { quoted: message }
                );
                return;
            }
            
            // If multiple results, show selection
            if (videos.length > 1) {
                await sendSearchResults(sock, chatId, videos, message);
                return;
            }
            
            // Use first result
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
            videoId = extractYouTubeId(videoUrl);
        }
        
        // Send thumbnail preview
        if (videoThumbnail) {
            await sock.sendMessage(chatId,
                {
                    image: { url: videoThumbnail },
                    caption: `🎬 *${videoTitle}*\n\n⬇️ *Downloading video...*\n⏳ Please wait, this may take a minute`
                },
                { quoted: message }
            );
        }
        
        // Fetch video download
        await sock.sendMessage(chatId,
            { text: '⚡ *Fetching video from servers...*\n\nThis may take a moment for longer videos.' },
            { quoted: message }
        );
        
        const videoData = await getVideoDownload(videoUrl);
        
        // Prepare file info
        const fileSize = formatFileSize(videoData.size);
        const qualityInfo = videoData.quality ? ` | 📊 ${videoData.quality}` : '';
        const sizeInfo = fileSize !== 'Unknown' ? ` | 💾 ${fileSize}` : '';
        
        // Send video
        await sock.sendMessage(chatId,
            {
                video: { url: videoData.download },
                mimetype: 'video/mp4',
                fileName: `${videoData.title || videoTitle}.mp4`.replace(/[^\w\s.-]/gi, '').substring(0, 100),
                caption: `🎬 *${videoData.title || videoTitle}*\n\n` +
                        `📊 *Quality:* ${videoData.quality || 'Standard'}${sizeInfo}\n` +
                        `⚡ *Provider:* ${videoData.provider}\n\n` +
                        `✅ *Download Complete!*`
            },
            { quoted: message }
        );
        
    } catch (error) {
        console.error('[Video Command Error]:', error);
        
        let errorMessage;
        
        if (error.message.includes('All video providers failed')) {
            errorMessage = `❌ *Download Failed*\n\nAll video services are currently unavailable.\n\nPossible reasons:\n• Service maintenance\n• Video too long\n• Region restrictions\n\nTry again later or with a different video.`;
        } else if (error.message.includes('Invalid YouTube URL')) {
            errorMessage = `❌ *Invalid URL*\n\nPlease provide a valid YouTube video URL.\n\nExamples:\n• https://youtu.be/dQw4w9WgXcQ\n• https://www.youtube.com/watch?v=dQw4w9WgXcQ`;
        } else if (error.message.includes('Search failed')) {
            errorMessage = `❌ *Search Failed*\n\nYouTube search is currently unavailable.\nTry using direct YouTube URL instead.`;
        } else if (error.message.includes('timeout')) {
            errorMessage = `⏰ *Request Timeout*\n\nThe video is taking too long to process.\n\nTry:\n• Shorter videos\n• Lower quality (if available)\n• Try again later`;
        } else {
            errorMessage = `❌ *Download Error*\n\n${error.message || 'Unknown error occurred'}\n\nPlease try again with a different video.`;
        }
        
        await sock.sendMessage(chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = videoCommand;
