const axios = require('axios');
const { URL } = require('url');

// Constants
const CONSTANTS = {
    APIS: {
        SIPUTZX: {
            name: 'Siputzx',
            url: (tiktokUrl) => `https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(tiktokUrl)}`,
            parser: (data) => {
                // Parse Siputzx API response
                if (data?.status && data?.data) {
                    const result = {
                        video: null,
                        audio: null,
                        title: data.data.metadata?.title || 'TikTok Video',
                        author: data.data.metadata?.author?.name,
                        duration: data.data.metadata?.duration,
                        description: data.data.metadata?.description,
                        stats: {
                            likes: data.data.metadata?.stats?.likes,
                            comments: data.data.metadata?.stats?.comments,
                            shares: data.data.metadata?.stats?.shares,
                            plays: data.data.metadata?.stats?.plays
                        }
                    };
                    
                    // Extract video URL from different response formats
                    if (Array.isArray(data.data.urls) && data.data.urls.length > 0) {
                        result.video = data.data.urls[0];
                    } else if (data.data.video_url) {
                        result.video = data.data.video_url;
                    } else if (data.data.url) {
                        result.video = data.data.url;
                    } else if (data.data.download_url) {
                        result.video = data.data.download_url;
                    }
                    
                    // Extract audio URL
                    if (data.data.audio_url) {
                        result.audio = data.data.audio_url;
                    }
                    
                    return result;
                }
                return null;
            }
        },
        TIKTOKDL: {
            name: 'TikTokDL',
            url: (tiktokUrl) => `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`,
            parser: (data) => {
                if (data?.code === 0 && data?.data) {
                    return {
                        video: data.data.play,
                        audio: data.data.music,
                        title: data.data.title || 'TikTok Video',
                        author: data.data.author?.nickname,
                        duration: data.data.duration,
                        description: data.data.description,
                        stats: {
                            likes: data.data.digg_count,
                            comments: data.data.comment_count,
                            shares: data.data.share_count,
                            plays: data.data.play_count
                        }
                    };
                }
                return null;
            }
        },
        TIKAPI: {
            name: 'TikAPI',
            url: (tiktokUrl) => `https://api.tikmate.app/api/lookup?url=${encodeURIComponent(tiktokUrl)}`,
            parser: (data) => {
                if (data?.success && data?.video) {
                    return {
                        video: data.video?.url || data.video?.video_url,
                        audio: data.video?.music_url,
                        title: data.video?.title || 'TikTok Video',
                        author: data.video?.author?.name,
                        duration: data.video?.duration,
                        description: data.video?.description
                    };
                }
                return null;
            }
        }
    },
    REQUEST: {
        TIMEOUT: 30000,
        MAX_RETRIES: 2,
        USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ACCEPT_HEADERS: {
            video: 'video/mp4,video/webm,video/*',
            audio: 'audio/mpeg,audio/mp4,audio/*',
            json: 'application/json'
        }
    },
    VALIDATION: {
        MAX_VIDEO_SIZE_MB: 100,
        MAX_AUDIO_SIZE_MB: 10,
        SUPPORTED_VIDEO_FORMATS: ['mp4', 'webm', 'mov'],
        SUPPORTED_AUDIO_FORMATS: ['mp3', 'm4a', 'ogg'],
        URL_PATTERNS: [
            /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
            /https?:\/\/(?:vm|vt|www)\.tiktok\.com\/[\w]+/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\/[\w]+/,
            /https?:\/\/(?:www\.)?tiktok\.com\/[\w]+\/video\/\d+/
        ]
    },
    MESSAGES: {
        NO_INPUT: `🎬 *TIKTOK DOWNLOADER*\n\nUsage: \`.tiktok <tiktok_url>\`\n\n*Examples:*\n• \`.tiktok https://tiktok.com/@user/video/123456789\`\n• \`.tiktok https://vm.tiktok.com/ABCDEFGHIJ/\`\n• \`.tiktok https://www.tiktok.com/t/ZMjR8s9XK/\``,
        INVALID_URL: '❌ Invalid TikTok URL. Please provide a valid TikTok video link.',
        DOWNLOADING: '⏬ Downloading TikTok video...',
        PROCESSING: '🔄 Processing video...',
        SENDING_VIDEO: '📤 Sending video...',
        SENDING_AUDIO: '🎵 Sending audio...',
        SUCCESS: '✅ TikTok video downloaded successfully!',
        FAILED: '❌ Failed to download TikTok video. Please try again.',
        API_UNAVAILABLE: '❌ TikTok download service is currently unavailable.',
        VIDEO_TOO_LARGE: (size, limit) => `❌ Video is too large (${size}MB > ${limit}MB limit).`,
        NO_VIDEO_FOUND: '❌ No video found at the provided URL.',
        WATERMARK_WARNING: '⚠️ Video may contain watermark.',
        DUPLICATE_REQUEST: '🔄 Already processing this request...'
    },
    EMOJIS: {
        VIDEO: '🎬',
        AUDIO: '🎵',
        AUTHOR: '👤',
        DURATION: '⏱️',
        LIKES: '❤️',
        COMMENTS: '💬',
        SHARES: '↪️',
        PLAYS: '👁️',
        MUSIC: '🎶'
    }
};

// Request cache to prevent duplicates
const requestCache = new Map();

/**
 * Clean request cache periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of requestCache.entries()) {
        if (now - timestamp > 5 * 60 * 1000) { // 5 minutes
            requestCache.delete(key);
        }
    }
}, 60000); // Clean every minute

/**
 * Check if request is duplicate
 */
function isDuplicateRequest(messageId, url) {
    const cacheKey = `${messageId}:${url}`;
    
    if (requestCache.has(cacheKey)) {
        return true;
    }
    
    requestCache.set(cacheKey, Date.now());
    return false;
}

/**
 * Extract URL from message
 */
function extractTikTokUrl(message) {
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    
    // Remove command prefix
    const commandMatch = text.match(/^\.\w+\s*/);
    const url = commandMatch ? text.slice(commandMatch[0].length).trim() : text.trim();
    
    return url;
}

/**
 * Validate TikTok URL
 */
function validateTikTokUrl(url) {
    if (!url) return false;
    
    // Check against known TikTok patterns
    return CONSTANTS.VALIDATION.URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Extract video ID from URL
 */
function extractVideoId(url) {
    try {
        const parsedUrl = new URL(url);
        
        // Extract from pathname
        const pathParts = parsedUrl.pathname.split('/');
        
        // Look for video ID in path
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            if (part === 'video' && i + 1 < pathParts.length) {
                return pathParts[i + 1];
            }
        }
        
        // Check for shortened URL formats
        if (pathParts.length > 0) {
            const lastPart = pathParts[pathParts.length - 1];
            if (lastPart && lastPart.length > 5) {
                return lastPart;
            }
        }
        
    } catch {
        return null;
    }
    
    return null;
}

/**
 * Retry operation with exponential backoff
 */
async function retryOperation(operation, maxRetries = CONSTANTS.REQUEST.MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = 1000 * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * Download TikTok video via APIs
 */
async function downloadTikTokVideo(url) {
    const apis = [
        CONSTANTS.APIS.SIPUTZX,
        CONSTANTS.APIS.TIKTOKDL,
        CONSTANTS.APIS.TIKAPI
    ];
    
    for (const api of apis) {
        try {
            console.log(`🔍 Trying ${api.name} API...`);
            
            const response = await retryOperation(async () => {
                const apiResponse = await axios.get(api.url(url), {
                    timeout: CONSTANTS.REQUEST.TIMEOUT,
                    headers: {
                        'User-Agent': CONSTANTS.REQUEST.USER_AGENT,
                        'Accept': CONSTANTS.REQUEST.ACCEPT_HEADERS.json,
                        'Referer': 'https://www.tiktok.com/'
                    }
                });
                
                return apiResponse.data;
            });
            
            const videoInfo = api.parser(response);
            
            if (videoInfo?.video) {
                console.log(`✅ Success with ${api.name} API`);
                return {
                    ...videoInfo,
                    source: api.name
                };
            }
            
            throw new Error(`No video URL from ${api.name}`);
            
        } catch (error) {
            console.warn(`⚠️ ${api.name} API failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('All APIs failed');
}

/**
 * Download media buffer
 */
async function downloadMediaBuffer(url, maxSizeMB, contentType = 'video') {
    const maxSize = maxSizeMB * 1024 * 1024;
    
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: CONSTANTS.REQUEST.TIMEOUT,
        maxContentLength: maxSize,
        headers: {
            'User-Agent': CONSTANTS.REQUEST.USER_AGENT,
            'Accept': CONSTANTS.REQUEST.ACCEPT_HEADERS[contentType],
            'Referer': 'https://www.tiktok.com/'
        }
    });
    
    const buffer = Buffer.from(response.data);
    
    // Validate buffer
    if (!buffer || buffer.length === 0) {
        throw new Error('Empty media buffer');
    }
    
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    console.log(`📥 Downloaded ${sizeMB}MB ${contentType}`);
    
    // Validate video signature
    if (contentType === 'video') {
        const isValid = validateVideoBuffer(buffer);
        if (!isValid) {
            throw new Error('Invalid video format');
        }
    }
    
    return buffer;
}

/**
 * Validate video buffer format
 */
function validateVideoBuffer(buffer) {
    if (buffer.length < 1000) return false;
    
    const hexSignature = buffer.toString('hex', 0, 12);
    
    // Common video file signatures
    const videoSignatures = [
        '000001ba', // MPEG-PS
        '000001b3', // MPEG
        '0000001866747970', // MP4 (ftyp)
        '1a45dfa3', // WebM
        '52494646' // AVI/WAV (RIFF)
    ];
    
    return videoSignatures.some(signature => hexSignature.startsWith(signature));
}

/**
 * Create video caption
 */
function createVideoCaption(videoInfo) {
    const lines = [];
    
    // Title/Description
    if (videoInfo.title || videoInfo.description) {
        const text = videoInfo.title || videoInfo.description;
        lines.push(`${CONSTANTS.EMOJIS.VIDEO} *${text.substring(0, 200)}*`);
    }
    
    // Author
    if (videoInfo.author) {
        lines.push(`${CONSTANTS.EMOJIS.AUTHOR} ${videoInfo.author}`);
    }
    
    // Duration
    if (videoInfo.duration) {
        lines.push(`${CONSTANTS.EMOJIS.DURATION} ${videoInfo.duration}s`);
    }
    
    // Stats
    if (videoInfo.stats) {
        const stats = videoInfo.stats;
        const statLines = [];
        
        if (stats.likes) statLines.push(`${CONSTANTS.EMOJIS.LIKES} ${stats.likes}`);
        if (stats.comments) statLines.push(`${CONSTANTS.EMOJIS.COMMENTS} ${stats.comments}`);
        if (stats.shares) statLines.push(`${CONSTANTS.EMOJIS.SHARES} ${stats.shares}`);
        if (stats.plays) statLines.push(`${CONSTANTS.EMOJIS.PLAYS} ${stats.plays}`);
        
        if (statLines.length > 0) {
            lines.push(statLines.join('  '));
        }
    }
    
    // Source
    if (videoInfo.source) {
        lines.push(`\n⚡ *Source:* ${videoInfo.source}`);
    }
    
    lines.push(`\n📥 *Downloaded by Knight Bot*`);
    
    return lines.join('\n');
}

/**
 * Main TikTok command handler
 */
async function tiktokCommand(sock, chatId, message) {
    try {
        // Extract URL
        const url = extractTikTokUrl(message);
        
        // Validate URL
        if (!url) {
            return await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.NO_INPUT },
                { quoted: message }
            );
        }
        
        if (!validateTikTokUrl(url)) {
            return await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.INVALID_URL },
                { quoted: message }
            );
        }
        
        // Check for duplicate requests
        if (isDuplicateRequest(message.key.id, url)) {
            return await sock.sendMessage(chatId,
                { text: CONSTANTS.MESSAGES.DUPLICATE_REQUEST },
                { quoted: message }
            );
        }
        
        // Send processing message
        await sock.sendMessage(chatId,
            { text: CONSTANTS.MESSAGES.DOWNLOADING },
            { quoted: message }
        );
        
        // Get video info from API
        const videoInfo = await downloadTikTokVideo(url);
        
        if (!videoInfo.video) {
            return await sock.sendMessage(chatId,
                { text: CONSTANTS.MESSAGES.NO_VIDEO_FOUND },
                { quoted: message }
            );
        }
        
        // Create caption
        const caption = createVideoCaption(videoInfo);
        
        // Send processing message
        await sock.sendMessage(chatId,
            { text: CONSTANTS.MESSAGES.PROCESSING },
            { quoted: message }
        );
        
        try {
            // Download video as buffer
            const videoBuffer = await downloadMediaBuffer(
                videoInfo.video,
                CONSTANTS.VALIDATION.MAX_VIDEO_SIZE_MB,
                'video'
            );
            
            // Send video
            await sock.sendMessage(chatId,
                { text: CONSTANTS.MESSAGES.SENDING_VIDEO },
                { quoted: message }
            );
            
            await sock.sendMessage(chatId, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: caption
            }, { quoted: message });
            
            // Send audio if available
            if (videoInfo.audio) {
                try {
                    await sock.sendMessage(chatId,
                        { text: CONSTANTS.MESSAGES.SENDING_AUDIO },
                        { quoted: message }
                    );
                    
                    const audioBuffer = await downloadMediaBuffer(
                        videoInfo.audio,
                        CONSTANTS.VALIDATION.MAX_AUDIO_SIZE_MB,
                        'audio'
                    );
                    
                    await sock.sendMessage(chatId, {
                        audio: audioBuffer,
                        mimetype: 'audio/mpeg',
                        caption: `${CONSTANTS.EMOJIS.MUSIC} Audio from TikTok`
                    }, { quoted: message });
                    
                } catch (audioError) {
                    console.warn('⚠️ Audio download failed:', audioError.message);
                }
            }
            
            // Send success message
            await sock.sendMessage(chatId,
                { text: CONSTANTS.MESSAGES.SUCCESS },
                { quoted: message }
            );
            
            // Log successful download
            console.log('✅ TikTok video downloaded:', {
                url: extractVideoId(url),
                title: videoInfo.title,
                source: videoInfo.source,
                size: `${(videoBuffer.length / (1024 * 1024)).toFixed(2)}MB`,
                timestamp: new Date().toISOString()
            });
            
        } catch (bufferError) {
            console.warn('⚠️ Buffer download failed, trying URL method:', bufferError.message);
            
            // Fallback: send video via URL
            await sock.sendMessage(chatId, {
                video: { url: videoInfo.video },
                mimetype: 'video/mp4',
                caption: caption
            }, { quoted: message });
            
            await sock.sendMessage(chatId,
                { text: CONSTANTS.MESSAGES.WATERMARK_WARNING },
                { quoted: message }
            );
        }
        
    } catch (error) {
        console.error('❌ TikTok command error:', error);
        
        // Determine appropriate error message
        let errorMessage = CONSTANTS.MESSAGES.FAILED;
        
        if (error.message === 'All APIs failed') {
            errorMessage = CONSTANTS.MESSAGES.API_UNAVAILABLE;
        } else if (error.message.includes('Invalid video format')) {
            errorMessage = '❌ Invalid video format received from TikTok.';
        } else if (error.message.includes('Empty media buffer')) {
            errorMessage = '❌ Video file is empty or corrupted.';
        } else if (error.message.includes('maxContentLength')) {
            errorMessage = CONSTANTS.MESSAGES.VIDEO_TOO_LARGE(
                CONSTANTS.VALIDATION.MAX_VIDEO_SIZE_MB,
                CONSTANTS.VALIDATION.MAX_VIDEO_SIZE_MB
            );
        }
        
        await sock.sendMessage(chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = tiktokCommand;
