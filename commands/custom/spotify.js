const axios = require('axios');
const { URL } = require('url');

// Constants
const CONSTANTS = {
    APIS: {
        OKATSU: {
            name: 'Okatsu',
            url: (query) => `https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(query)}`,
            parser: (data) => ({
                audio: data?.audio,
                title: data?.title || data?.name,
                artist: data?.artist,
                album: data?.album,
                duration: data?.duration,
                url: data?.url,
                thumbnail: data?.thumbnails,
                explicit: data?.explicit,
                popularity: data?.popularity,
                preview: data?.preview_url
            })
        },
        STARGAY: {
            name: 'Stargay',
            url: (query) => `https://api.stargay.my.id/api/search/spotify?q=${encodeURIComponent(query)}`,
            parser: (data) => ({
                audio: data?.result?.audio,
                title: data?.result?.title,
                artist: data?.result?.artist,
                album: data?.result?.album,
                duration: data?.result?.duration,
                url: data?.result?.url,
                thumbnail: data?.result?.thumbnail,
                explicit: data?.result?.explicit,
                trackId: data?.result?.id
            })
        },
        YUPRA: {
            name: 'Yupra',
            url: (query) => `https://api.yupra.my.id/api/search/spotify?q=${encodeURIComponent(query)}`,
            parser: (data) => ({
                audio: data?.data?.audio_url,
                title: data?.data?.title,
                artist: data?.data?.artist,
                album: data?.data?.album,
                duration: data?.data?.duration,
                url: data?.data?.url,
                thumbnail: data?.data?.thumbnail,
                releaseDate: data?.data?.release_date
            })
        }
    },
    REQUEST: {
        TIMEOUT: 30000,
        MAX_RETRIES: 2,
        USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ACCEPT_HEADERS: {
            'audio': 'audio/mpeg, audio/mp4, audio/wav',
            'image': 'image/jpeg, image/png, image/webp'
        }
    },
    VALIDATION: {
        MAX_QUERY_LENGTH: 200,
        MIN_QUERY_LENGTH: 1,
        SUPPORTED_AUDIO_FORMATS: ['mp3', 'm4a', 'mp4', 'wav'],
        MAX_AUDIO_SIZE_MB: 25
    },
    MESSAGES: {
        NO_INPUT: `🎵 *SPOTIFY DOWNLOADER*\n\nUsage: \`.spotify <song/artist/keywords>\`\n\n*Examples:*\n• \`.spotify Blinding Lights\`\n• \`.spotify The Weeknd\`\n• \`.spotify Dance Monkey Tones and I\`\n• \`.spotify https://open.spotify.com/track/...\``,
        QUERY_TOO_SHORT: '❌ Please provide a search query or Spotify URL.',
        QUERY_TOO_LONG: (length, max) => `❌ Query is too long (${length} > ${max} characters).`,
        NO_RESULTS: '❌ No results found. Try a different search.',
        NO_AUDIO: '❌ No downloadable audio found for this track.',
        DOWNLOADING: (title) => `⏬ Downloading: *${title}*`,
        PROCESSING: '🔄 Processing Spotify track...',
        SENDING: '📤 Sending audio...',
        SUCCESS: '✅ Track sent successfully!',
        FAILED: '❌ Failed to fetch Spotify audio. Try again later.',
        API_UNAVAILABLE: '❌ Spotify service is currently unavailable.',
        FILE_TOO_LARGE: (limit) => `❌ Audio file exceeds size limit (${limit}MB).`,
        INVALID_URL: '❌ Invalid Spotify URL. Use a track URL or search query.'
    },
    EMOJIS: {
        MUSIC: '🎵',
        ARTIST: '👤',
        ALBUM: '💿',
        DURATION: '⏱️',
        LINK: '🔗',
        EXPLICIT: '🔞',
        POPULAR: '🔥',
        CALENDAR: '📅'
    }
};

/**
 * Extract query from message
 */
function extractQuery(message) {
    const rawText = message.message?.conversation?.trim() ||
                   message.message?.extendedTextMessage?.text?.trim() ||
                   message.message?.imageMessage?.caption?.trim() ||
                   message.message?.videoMessage?.caption?.trim() ||
                   '';
    
    // Remove command prefix
    const commandMatch = rawText.match(/^\.\w+\s*/);
    const command = commandMatch ? commandMatch[0] : '';
    const query = rawText.slice(command.length).trim();
    
    return { command, query };
}

/**
 * Validate search query
 */
function validateQuery(query) {
    if (!query || query.length < CONSTANTS.VALIDATION.MIN_QUERY_LENGTH) {
        throw new Error(CONSTANTS.MESSAGES.QUERY_TOO_SHORT);
    }
    
    if (query.length > CONSTANTS.VALIDATION.MAX_QUERY_LENGTH) {
        throw new Error(CONSTANTS.MESSAGES.QUERY_TOO_LONG(
            query.length, 
            CONSTANTS.VALIDATION.MAX_QUERY_LENGTH
        ));
    }
    
    return query;
}

/**
 * Check if query is a Spotify URL
 */
function isSpotifyUrl(query) {
    try {
        const url = new URL(query);
        return url.hostname.includes('spotify.com') && 
               (url.pathname.includes('/track/') || 
                url.pathname.includes('/album/') || 
                url.pathname.includes('/artist/'));
    } catch {
        return false;
    }
}

/**
 * Extract track ID from Spotify URL
 */
function extractTrackId(url) {
    try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/');
        const trackIndex = pathParts.indexOf('track');
        
        if (trackIndex !== -1 && trackIndex + 1 < pathParts.length) {
            return pathParts[trackIndex + 1];
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
 * Search Spotify via API
 */
async function searchSpotify(query) {
    const apis = [
        CONSTANTS.APIS.OKATSU,
        CONSTANTS.APIS.STARGAY,
        CONSTANTS.APIS.YUPRA
    ];
    
    for (const api of apis) {
        try {
            console.log(`🔍 Trying ${api.name} API...`);
            
            const response = await retryOperation(async () => {
                const apiResponse = await axios.get(api.url(query), {
                    timeout: CONSTANTS.REQUEST.TIMEOUT,
                    headers: {
                        'User-Agent': CONSTANTS.REQUEST.USER_AGENT,
                        'Accept': 'application/json'
                    }
                });
                
                return apiResponse.data;
            });
            
            const trackInfo = api.parser(response);
            
            if (trackInfo.audio) {
                console.log(`✅ Success with ${api.name} API`);
                return {
                    ...trackInfo,
                    source: api.name
                };
            }
            
            throw new Error(`No audio URL from ${api.name}`);
            
        } catch (error) {
            console.warn(`⚠️ ${api.name} API failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('All APIs failed');
}

/**
 * Create track info caption
 */
function createTrackCaption(trackInfo) {
    const lines = [];
    
    // Title
    if (trackInfo.title) {
        const explicit = trackInfo.explicit ? ` ${CONSTANTS.EMOJIS.EXPLICIT}` : '';
        lines.push(`${CONSTANTS.EMOJIS.MUSIC} *${trackInfo.title}*${explicit}`);
    }
    
    // Artist
    if (trackInfo.artist) {
        lines.push(`${CONSTANTS.EMOJIS.ARTIST} ${trackInfo.artist}`);
    }
    
    // Album
    if (trackInfo.album) {
        lines.push(`${CONSTANTS.EMOJIS.ALBUM} ${trackInfo.album}`);
    }
    
    // Duration
    if (trackInfo.duration) {
        lines.push(`${CONSTANTS.EMOJIS.DURATION} ${trackInfo.duration}`);
    }
    
    // Popularity
    if (trackInfo.popularity) {
        const stars = '★'.repeat(Math.floor(trackInfo.popularity / 20)) + 
                     '☆'.repeat(5 - Math.floor(trackInfo.popularity / 20));
        lines.push(`${CONSTANTS.EMOJIS.POPULAR} ${stars} (${trackInfo.popularity}%)`);
    }
    
    // Release date
    if (trackInfo.releaseDate) {
        lines.push(`${CONSTANTS.EMOJIS.CALENDAR} ${trackInfo.releaseDate}`);
    }
    
    // Spotify link
    if (trackInfo.url) {
        lines.push(`${CONSTANTS.EMOJIS.LINK} [Open in Spotify](${trackInfo.url})`);
    }
    
    return lines.join('\n');
}

/**
 * Generate safe filename
 */
function generateFileName(trackInfo) {
    const title = trackInfo.title || 'track';
    const artist = trackInfo.artist || '';
    
    let fileName = title;
    if (artist) {
        fileName = `${artist} - ${title}`;
    }
    
    // Remove invalid characters and limit length
    return fileName
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100) + '.mp3';
}

/**
 * Validate audio URL
 */
function validateAudioUrl(url) {
    if (!url) return false;
    
    try {
        const parsed = new URL(url);
        const extension = parsed.pathname.split('.').pop().toLowerCase();
        
        return CONSTANTS.VALIDATION.SUPPORTED_AUDIO_FORMATS.includes(extension);
    } catch {
        return false;
    }
}

/**
 * Main Spotify command handler
 */
async function spotifyCommand(sock, chatId, message) {
    try {
        // Extract and validate query
        const { query } = extractQuery(message);
        
        if (!query) {
            return await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.NO_INPUT },
                { quoted: message }
            );
        }
        
        // Validate query length
        try {
            validateQuery(query);
        } catch (validationError) {
            return await sock.sendMessage(chatId, 
                { text: validationError.message },
                { quoted: message }
            );
        }
        
        // Check if it's a Spotify URL
        if (isSpotifyUrl(query)) {
            const trackId = extractTrackId(query);
            if (!trackId) {
                return await sock.sendMessage(chatId,
                    { text: CONSTANTS.MESSAGES.INVALID_URL },
                    { quoted: message }
                );
            }
        }
        
        // Send searching message
        await sock.sendMessage(chatId,
            { text: `🔍 Searching Spotify for "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"...` },
            { quoted: message }
        );
        
        // Search for track
        const trackInfo = await searchSpotify(query);
        
        if (!trackInfo.audio) {
            return await sock.sendMessage(chatId,
                { text: CONSTANTS.MESSAGES.NO_AUDIO },
                { quoted: message }
            );
        }
        
        // Validate audio URL
        if (!validateAudioUrl(trackInfo.audio)) {
            console.warn(`⚠️ Invalid audio URL format: ${trackInfo.audio}`);
        }
        
        // Create caption
        const caption = createTrackCaption(trackInfo);
        
        // Send track info with thumbnail
        if (trackInfo.thumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: trackInfo.thumbnail },
                    caption: caption
                }, { quoted: message });
            } catch (imageError) {
                console.warn('⚠️ Could not send thumbnail:', imageError.message);
                await sock.sendMessage(chatId,
                    { text: caption },
                    { quoted: message }
                );
            }
        } else {
            await sock.sendMessage(chatId,
                { text: caption },
                { quoted: message }
            );
        }
        
        // Send downloading message
        await sock.sendMessage(chatId,
            { text: CONSTANTS.MESSAGES.DOWNLOADING(trackInfo.title) },
            { quoted: message }
        );
        
        // Generate filename
        const fileName = generateFileName(trackInfo);
        
        // Send audio
        await sock.sendMessage(chatId, {
            audio: { url: trackInfo.audio },
            mimetype: 'audio/mpeg',
            fileName: fileName,
            ptt: false,
            contextInfo: {
                mentionedJid: [message.key.participant || message.key.remoteJid]
            }
        }, { quoted: message });
        
        // Send success message
        await sock.sendMessage(chatId,
            { text: CONSTANTS.MESSAGES.SUCCESS },
            { quoted: message }
        );
        
        // Log successful download
        console.log('✅ Spotify track downloaded:', {
            title: trackInfo.title,
            artist: trackInfo.artist,
            source: trackInfo.source,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Spotify command error:', error);
        
        // Determine appropriate error message
        let errorMessage = CONSTANTS.MESSAGES.FAILED;
        
        if (error.message === 'All APIs failed') {
            errorMessage = CONSTANTS.MESSAGES.API_UNAVAILABLE;
        } else if (error.message === CONSTANTS.MESSAGES.NO_AUDIO) {
            errorMessage = CONSTANTS.MESSAGES.NO_AUDIO;
        } else if (error.message === CONSTANTS.MESSAGES.QUERY_TOO_SHORT) {
            errorMessage = CONSTANTS.MESSAGES.NO_INPUT;
        } else if (error.message.includes('Query is too long')) {
            errorMessage = error.message;
        } else if (error.message.includes('No results')) {
            errorMessage = CONSTANTS.MESSAGES.NO_RESULTS;
        }
        
        await sock.sendMessage(chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = spotifyCommand;
