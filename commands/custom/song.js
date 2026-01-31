const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { toAudio } = require('../lib/converter');

// Constants
const CONSTANTS = {
    APIS: {
        YUPRA: {
            name: 'Yupra',
            url: (youtubeUrl) => `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
            parser: (data) => ({
                download: data?.data?.download_url,
                title: data?.data?.title,
                thumbnail: data?.data?.thumbnail,
                duration: data?.data?.duration,
                quality: data?.data?.quality
            })
        },
        OKATSU: {
            name: 'Okatsu',
            url: (youtubeUrl) => `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
            parser: (data) => ({
                download: data?.dl,
                title: data?.title,
                thumbnail: data?.thumb,
                duration: data?.duration,
                format: data?.format
            })
        },
        STARGAY: {
            name: 'Stargay',
            url: (youtubeUrl) => `https://api.stargay.my.id/api/downloader/youtube?url=${encodeURIComponent(youtubeUrl)}&type=mp3`,
            parser: (data) => ({
                download: data?.result?.download,
                title: data?.result?.title,
                thumbnail: data?.result?.thumbnail,
                duration: data?.result?.duration
            })
        }
    },
    REQUEST: {
        TIMEOUT: 90000,
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000,
        USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ACCEPT_HEADERS: {
            'audio/*': 'audio/mpeg, audio/mp4, audio/wav, audio/ogg',
            'stream': 'application/octet-stream'
        }
    },
    AUDIO: {
        MAX_SIZE_MB: 50,
        SUPPORTED_FORMATS: {
            MP3: { mime: 'audio/mpeg', extensions: ['mp3'], signatures: ['494433', 'fffb', 'fff3'] },
            M4A: { mime: 'audio/mp4', extensions: ['m4a', 'mp4'], signatures: ['66747970'] },
            OGG: { mime: 'audio/ogg', extensions: ['ogg'], signatures: ['4f676753'] },
            WAV: { mime: 'audio/wav', extensions: ['wav'], signatures: ['52494646'] },
            WEBM: { mime: 'audio/webm', extensions: ['webm'], signatures: ['1a45dfa3'] }
        },
        DEFAULT_FORMAT: 'MP3',
        DEFAULT_EXTENSION: 'mp3'
    },
    MESSAGES: {
        NO_INPUT: '🎵 *SONG DOWNLOADER*\n\nUsage: `.song <song name or YouTube link>`\n\n*Examples:*\n• `.song Shape of You`\n• `.song https://youtube.com/watch?v=...`\n• `.song Bad Habits`',
        NO_RESULTS: '❌ No results found. Please try a different search term.',
        DOWNLOADING: (title) => `⏬ Downloading: *${title}*`,
        PROCESSING: '🔄 Processing audio...',
        CONVERTING: '🎛 Converting to MP3...',
        SENDING: '📤 Sending audio...',
        SUCCESS: '✅ Song sent successfully!',
        FAILED: '❌ Failed to download song. Please try again.',
        API_FAILED: '❌ Download service unavailable. Please try again later.',
        FILE_TOO_LARGE: (sizeMB, limitMB) => `❌ File is too large (${sizeMB}MB > ${limitMB}MB limit)`,
        INVALID_FORMAT: (format) => `❌ Unsupported audio format: ${format}`,
        CONVERSION_FAILED: '❌ Failed to convert audio format.'
    },
    PATHS: {
        TEMP: path.join(__dirname, '../temp/songs'),
        CACHE: path.join(__dirname, '../cache/audio')
    }
};

/**
 * Create necessary directories
 */
async function ensureDirectories() {
    const directories = [
        CONSTANTS.PATHS.TEMP,
        CONSTANTS.PATHS.CACHE
    ];
    
    for (const dir of directories) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            console.warn(`⚠️ Could not create directory ${dir}:`, error.message);
        }
    }
}

/**
 * Retry function with exponential backoff
 */
async function retryOperation(operation, maxRetries = CONSTANTS.REQUEST.MAX_RETRIES, baseDelay = CONSTANTS.REQUEST.RETRY_DELAY) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * Detect audio format from buffer
 */
function detectAudioFormat(buffer) {
    if (!buffer || buffer.length < 12) {
        return CONSTANTS.AUDIO.DEFAULT_FORMAT;
    }
    
    const hexSignature = buffer.slice(0, 12).toString('hex').toLowerCase();
    const asciiSignature = buffer.slice(4, 8).toString('ascii');
    
    // Check for known signatures
    for (const [format, info] of Object.entries(CONSTANTS.AUDIO.SUPPORTED_FORMATS)) {
        for (const signature of info.signatures) {
            if (hexSignature.startsWith(signature.toLowerCase())) {
                return format;
            }
        }
    }
    
    // Check for M4A/MP4 (ftyp box)
    if (asciiSignature === 'ftyp') {
        return 'M4A';
    }
    
    // Check for MP3 (ID3 or MPEG sync)
    if (buffer.toString('ascii', 0, 3) === 'ID3') {
        return 'MP3';
    }
    
    // Check for MPEG frame sync
    if ((buffer[0] === 0xFF) && ((buffer[1] & 0xE0) === 0xE0)) {
        return 'MP3';
    }
    
    return CONSTANTS.AUDIO.DEFAULT_FORMAT;
}

/**
 * Convert buffer to MP3 if needed
 */
async function convertToMP3(buffer, originalFormat) {
    try {
        if (originalFormat === 'MP3') {
            return buffer; // Already MP3
        }
        
        const formatInfo = CONSTANTS.AUDIO.SUPPORTED_FORMATS[originalFormat];
        if (!formatInfo) {
            throw new Error(`Unsupported format: ${originalFormat}`);
        }
        
        // Get appropriate extension for conversion
        const extension = formatInfo.extensions[0];
        console.log(`🎛 Converting ${originalFormat} to MP3...`);
        
        const mp3Buffer = await toAudio(buffer, extension);
        
        if (!mp3Buffer || mp3Buffer.length === 0) {
            throw new Error('Conversion returned empty buffer');
        }
        
        return mp3Buffer;
        
    } catch (error) {
        console.error('❌ Conversion failed:', error);
        throw new Error(CONSTANTS.MESSAGES.CONVERSION_FAILED);
    }
}

/**
 * Search for video on YouTube
 */
async function searchVideo(query) {
    try {
        const search = await yts(query);
        
        if (!search?.videos?.length) {
            throw new Error('No results');
        }
        
        const video = search.videos[0];
        return {
            url: video.url,
            title: video.title,
            thumbnail: video.thumbnail,
            duration: video.timestamp,
            views: video.views,
            author: video.author?.name,
            uploaded: video.ago
        };
    } catch (error) {
        console.error('❌ YouTube search failed:', error);
        throw new Error(CONSTANTS.MESSAGES.NO_RESULTS);
    }
}

/**
 * Extract video info from YouTube URL
 */
function extractVideoInfo(url) {
    // Basic YouTube URL parsing
    let videoId = null;
    
    if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('youtube.com/watch')) {
        const urlParams = new URL(url).searchParams;
        videoId = urlParams.get('v');
    }
    
    return {
        url,
        videoId,
        isDirectLink: !!videoId
    };
}

/**
 * Download audio from API
 */
async function downloadAudioFromAPI(youtubeUrl) {
    const apis = [
        CONSTANTS.APIS.YUPRA,
        CONSTANTS.APIS.OKATSU,
        CONSTANTS.APIS.STARGAY
    ];
    
    for (const api of apis) {
        try {
            console.log(`🔍 Trying ${api.name} API...`);
            
            const response = await retryOperation(async () => {
                const apiResponse = await axios.get(api.url(youtubeUrl), {
                    timeout: CONSTANTS.REQUEST.TIMEOUT,
                    headers: {
                        'User-Agent': CONSTANTS.REQUEST.USER_AGENT,
                        'Accept': 'application/json'
                    }
                });
                
                return apiResponse.data;
            });
            
            const audioInfo = api.parser(response);
            
            if (audioInfo.download) {
                console.log(`✅ Success with ${api.name} API`);
                return audioInfo;
            }
            
            throw new Error(`No download URL from ${api.name}`);
            
        } catch (error) {
            console.warn(`⚠️ ${api.name} API failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('All APIs failed');
}

/**
 * Download audio buffer from URL
 */
async function downloadAudioBuffer(audioUrl) {
    try {
        const response = await retryOperation(async () => {
            const audioResponse = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: CONSTANTS.REQUEST.TIMEOUT,
                maxContentLength: CONSTANTS.AUDIO.MAX_SIZE_MB * 1024 * 1024,
                headers: {
                    'User-Agent': CONSTANTS.REQUEST.USER_AGENT,
                    'Accept': CONSTANTS.REQUEST.ACCEPT_HEADERS['audio/*']
                }
            });
            
            return audioResponse;
        });
        
        const buffer = Buffer.from(response.data);
        
        // Validate buffer
        if (!buffer || buffer.length === 0) {
            throw new Error('Empty audio buffer');
        }
        
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        console.log(`📥 Downloaded ${sizeMB}MB audio`);
        
        return buffer;
        
    } catch (error) {
        if (error.message.includes('maxContentLength')) {
            throw new Error(CONSTANTS.MESSAGES.FILE_TOO_LARGE(
                (error.config.maxContentLength / (1024 * 1024)).toFixed(0),
                CONSTANTS.AUDIO.MAX_SIZE_MB
            ));
        }
        throw error;
    }
}

/**
 * Clean temporary files
 */
async function cleanupTempFiles() {
    try {
        const files = await fs.readdir(CONSTANTS.PATHS.TEMP);
        const now = Date.now();
        
        for (const file of files) {
            const filePath = path.join(CONSTANTS.PATHS.TEMP, file);
            
            try {
                const stats = await fs.stat(filePath);
                
                // Delete files older than 5 minutes
                if (now - stats.mtimeMs > 5 * 60 * 1000) {
                    await fs.unlink(filePath);
                    console.log(`🧹 Cleaned up: ${file}`);
                }
            } catch {
                // Ignore individual file errors
            }
        }
    } catch (error) {
        console.warn('⚠️ Cleanup failed:', error.message);
    }
}

/**
 * Main song command handler
 */
async function songCommand(sock, chatId, message) {
    try {
        // Ensure directories exist
        await ensureDirectories();
        
        // Extract query from message
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
        
        // Validate input
        if (!text || text.trim() === '') {
            return await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.NO_INPUT },
                { quoted: message }
            );
        }
        
        const query = text.trim();
        
        // Determine if it's a YouTube URL or search query
        let videoInfo;
        const isYoutubeUrl = query.includes('youtube.com') || query.includes('youtu.be');
        
        if (isYoutubeUrl) {
            videoInfo = extractVideoInfo(query);
            videoInfo.title = 'YouTube Audio';
            videoInfo.thumbnail = `https://img.youtube.com/vi/${videoInfo.videoId}/maxresdefault.jpg`;
        } else {
            // Search for video
            await sock.sendMessage(chatId, 
                { text: `🔍 Searching for "${query}"...` },
                { quoted: message }
            );
            
            videoInfo = await searchVideo(query);
        }
        
        // Send downloading message with thumbnail
        await sock.sendMessage(chatId, {
            image: { url: videoInfo.thumbnail },
            caption: CONSTANTS.MESSAGES.DOWNLOADING(videoInfo.title) + 
                    (videoInfo.duration ? `\n⏱ Duration: ${videoInfo.duration}` : '') +
                    (videoInfo.author ? `\n👤 Artist: ${videoInfo.author}` : '')
        }, { quoted: message });
        
        // Download audio info from API
        await sock.sendMessage(chatId, 
            { text: CONSTANTS.MESSAGES.PROCESSING }
        );
        
        const audioInfo = await downloadAudioFromAPI(videoInfo.url);
        
        // Download audio buffer
        const audioBuffer = await downloadAudioBuffer(audioInfo.download);
        
        // Detect and convert format if needed
        const detectedFormat = detectAudioFormat(audioBuffer);
        console.log(`🎵 Detected format: ${detectedFormat}`);
        
        let finalBuffer = audioBuffer;
        let finalMimeType = CONSTANTS.AUDIO.SUPPORTED_FORMATS[detectedFormat]?.mime || 'audio/mpeg';
        
        if (detectedFormat !== 'MP3') {
            await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.CONVERTING }
            );
            
            finalBuffer = await convertToMP3(audioBuffer, detectedFormat);
            finalMimeType = 'audio/mpeg';
        }
        
        // Generate safe filename
        const safeTitle = (audioInfo.title || videoInfo.title || 'song')
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
        
        const fileExtension = detectedFormat === 'MP3' ? 'mp3' : CONSTANTS.AUDIO.DEFAULT_EXTENSION;
        const fileName = `${safeTitle}.${fileExtension}`;
        
        // Send audio
        await sock.sendMessage(chatId, 
            { text: CONSTANTS.MESSAGES.SENDING }
        );
        
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: finalMimeType,
            fileName: fileName,
            ptt: false,
            contextInfo: {
                mentionedJid: [message.key.participant || message.key.remoteJid]
            }
        }, { quoted: message });
        
        // Send success message
        await sock.sendMessage(chatId, 
            { text: CONSTANTS.MESSAGES.SUCCESS }
        );
        
        // Log successful download
        console.log('✅ Song downloaded successfully:', {
            title: audioInfo.title || videoInfo.title,
            format: detectedFormat,
            size: `${(finalBuffer.length / (1024 * 1024)).toFixed(2)}MB`,
            timestamp: new Date().toISOString()
        });
        
        // Cleanup
        setTimeout(() => {
            cleanupTempFiles().catch(console.error);
        }, 5000);
        
    } catch (error) {
        console.error('❌ Song command error:', error);
        
        // Determine error message
        let errorMessage = CONSTANTS.MESSAGES.FAILED;
        
        if (error.message === CONSTANTS.MESSAGES.NO_RESULTS) {
            errorMessage = CONSTANTS.MESSAGES.NO_RESULTS;
        } else if (error.message.includes('File is too large')) {
            errorMessage = error.message;
        } else if (error.message.includes('All APIs failed')) {
            errorMessage = CONSTANTS.MESSAGES.API_FAILED;
        } else if (error.message === CONSTANTS.MESSAGES.CONVERSION_FAILED) {
            errorMessage = CONSTANTS.MESSAGES.CONVERSION_FAILED;
        }
        
        await sock.sendMessage(chatId, 
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = songCommand;
