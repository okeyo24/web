const axios = require('axios');

// Configuration
const CONFIG = {
    // Primary API endpoint
    API_ENDPOINT: 'https://lyricsapi.fly.dev/api/lyrics',
    
    // Fallback API endpoint
    FALLBACK_API: 'https://some-random-api.com/lyrics',
    
    // Request configuration
    REQUEST_CONFIG: {
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (WhatsApp Lyrics Bot/1.0)',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    },
    
    // Response limits
    MAX_LYRICS_LENGTH: 4000, // WhatsApp message limit
    MAX_TITLE_LENGTH: 100
};

/**
 * Sanitize song title for API request
 * @param {string} title - Raw song title
 * @returns {string} Sanitized title
 */
function sanitizeSongTitle(title) {
    if (!title) return '';
    
    return title
        .trim()
        .replace(/\s+/g, ' ')
        .substring(0, CONFIG.MAX_TITLE_LENGTH);
}

/**
 * Format artist and song information
 * @param {object} data - API response data
 * @returns {string} Formatted header
 */
function formatLyricsHeader(data) {
    const artist = data.artist || data.author || 'Unknown Artist';
    const title = data.title || data.song || 'Unknown Song';
    const album = data.album || null;
    const year = data.year || null;
    
    let header = `🎵 *${title}*\n`;
    header += `👤 *Artist:* ${artist}\n`;
    
    if (album) {
        header += `💿 *Album:* ${album}\n`;
    }
    
    if (year) {
        header += `📅 *Year:* ${year}\n`;
    }
    
    header += `━━━━━━━━━━━━━━━━━━\n\n`;
    
    return header;
}

/**
 * Split long lyrics into multiple messages
 * @param {string} lyrics - Full lyrics text
 * @param {string} header - Lyrics header
 * @returns {Array<string>} Array of message chunks
 */
function splitLyricsIntoChunks(lyrics, header) {
    const maxChunkSize = CONFIG.MAX_LYRICS_LENGTH - header.length - 50;
    const chunks = [];
    
    if (lyrics.length <= maxChunkSize) {
        chunks.push(header + lyrics);
        return chunks;
    }
    
    // Split by paragraphs first
    const paragraphs = lyrics.split(/\n\s*\n/);
    let currentChunk = header;
    
    for (const paragraph of paragraphs) {
        const paragraphWithBreaks = paragraph + '\n\n';
        
        if (currentChunk.length + paragraphWithBreaks.length > maxChunkSize) {
            // If adding this paragraph exceeds limit, save current chunk
            if (currentChunk !== header) {
                chunks.push(currentChunk.trim());
                currentChunk = header;
            }
            
            // If single paragraph is too long, split by lines
            if (paragraphWithBreaks.length > maxChunkSize) {
                const lines = paragraph.split('\n');
                for (const line of lines) {
                    if (currentChunk.length + line.length + 2 > maxChunkSize) {
                        chunks.push(currentChunk.trim());
                        currentChunk = header + line + '\n';
                    } else {
                        currentChunk += line + '\n';
                    }
                }
                currentChunk += '\n';
            } else {
                currentChunk += paragraphWithBreaks;
            }
        } else {
            currentChunk += paragraphWithBreaks;
        }
    }
    
    // Add the last chunk if not empty
    if (currentChunk.trim() !== header.trim()) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}

/**
 * Fetch lyrics from primary API
 * @param {string} songTitle - Song title to search
 * @returns {Promise<object>} Lyrics data
 */
async function fetchLyricsPrimary(songTitle) {
    try {
        const response = await axios.get(CONFIG.API_ENDPOINT, {
            params: { q: songTitle },
            ...CONFIG.REQUEST_CONFIG
        });
        
        const data = response.data;
        
        if (!data || !data.result) {
            throw new Error('Invalid API response');
        }
        
        return {
            lyrics: data.result.lyrics,
            title: data.result.title || songTitle,
            artist: data.result.artist,
            album: data.result.album,
            year: data.result.year,
            source: 'Primary API'
        };
    } catch (error) {
        console.error('[Lyrics] Primary API error:', error.message);
        throw error;
    }
}

/**
 * Fetch lyrics from fallback API
 * @param {string} songTitle - Song title to search
 * @returns {Promise<object>} Lyrics data
 */
async function fetchLyricsFallback(songTitle) {
    try {
        const response = await axios.get(CONFIG.FALLBACK_API, {
            params: { title: songTitle },
            ...CONFIG.REQUEST_CONFIG
        });
        
        const data = response.data;
        
        if (!data || !data.lyrics) {
            throw new Error('No lyrics found in fallback');
        }
        
        return {
            lyrics: data.lyrics,
            title: data.title || songTitle,
            artist: data.author || data.artist,
            album: null,
            year: null,
            source: 'Fallback API'
        };
    } catch (error) {
        console.error('[Lyrics] Fallback API error:', error.message);
        throw error;
    }
}

/**
 * Search for lyrics using available APIs
 * @param {string} songTitle - Song title to search
 * @returns {Promise<object>} Lyrics data
 */
async function searchLyrics(songTitle) {
    try {
        return await fetchLyricsPrimary(songTitle);
    } catch (primaryError) {
        console.log('[Lyrics] Trying fallback API...');
        return await fetchLyricsFallback(songTitle);
    }
}

/**
 * Format lyrics with proper structure
 * @param {object} lyricsData - Lyrics data object
 * @returns {Array<string>} Formatted message chunks
 */
function formatLyricsResponse(lyricsData) {
    const { lyrics, title, artist, album, year, source } = lyricsData;
    
    if (!lyrics) {
        throw new Error('No lyrics found');
    }
    
    // Create header
    const header = formatLyricsHeader({ title, artist, album, year });
    
    // Clean up lyrics
    const cleanLyrics = lyrics
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    
    // Split into chunks if needed
    const chunks = splitLyricsIntoChunks(cleanLyrics, header);
    
    // Add footer to last chunk
    if (chunks.length > 0) {
        const lastChunk = chunks[chunks.length - 1];
        chunks[chunks.length - 1] = lastChunk + 
            `\n\n━━━━━━━━━━━━━━━━━━\n` +
            `📡 *Source:* ${source}\n` +
            `✨ *Enjoy your music!*`;
    }
    
    return chunks;
}

/**
 * Main lyrics command handler
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {string} songTitle - Song title (from command args)
 * @param {object} message - Original message
 * @param {Array} args - Command arguments
 */
async function lyricsCommand(sock, chatId, songTitle, message, args = []) {
    try {
        // Extract song title from args if not provided
        const query = songTitle || args.join(' ').trim();
        
        if (!query) {
            const helpText = `🎵 *Lyrics Finder*\n\n` +
                           `Get lyrics for any song\n\n` +
                           `📋 *Usage:*\n` +
                           `• *.lyrics <song name>*\n` +
                           `• *.lyrics <artist> - <song>*\n\n` +
                           `📝 *Examples:*\n` +
                           `• *.lyrics Bohemian Rhapsody*\n` +
                           `• *.lyrics The Weeknd - Blinding Lights*\n` +
                           `• *.lyrics "Hotel California"*\n\n` +
                           `🎤 *Tip:* Include artist name for better results`;
            
            await sock.sendMessage(chatId,
                { text: helpText },
                { quoted: message }
            );
            return;
        }
        
        const sanitizedQuery = sanitizeSongTitle(query);
        
        // Send searching message
        const searchMsg = await sock.sendMessage(chatId,
            { text: `🔍 *Searching lyrics for:*\n"${sanitizedQuery}"\n\nPlease wait...` },
            { quoted: message }
        );
        
        // Fetch lyrics
        const lyricsData = await searchLyrics(sanitizedQuery);
        
        // Format response
        const messageChunks = formatLyricsResponse(lyricsData);
        
        // Send lyrics in chunks
        for (let i = 0; i < messageChunks.length; i++) {
            const chunk = messageChunks[i];
            
            // Add part indicator if multiple chunks
            let finalChunk = chunk;
            if (messageChunks.length > 1) {
                finalChunk = `📄 *Part ${i + 1}/${messageChunks.length}*\n\n${chunk}`;
            }
            
            await sock.sendMessage(chatId,
                { text: finalChunk },
                { quoted: i === 0 ? message : undefined } // Only quote first message
            );
            
            // Small delay between chunks
            if (i < messageChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Send completion message if multiple parts
        if (messageChunks.length > 1) {
            await sock.sendMessage(chatId,
                { text: `✅ *Lyrics Complete!*\n\nSent ${messageChunks.length} parts for "${lyricsData.title}"` },
                { quoted: message }
            );
        }
        
    } catch (error) {
        console.error('[Lyrics Command Error]:', error);
        
        let errorMessage;
        
        if (error.message.includes('No lyrics found') || error.response?.status === 404) {
            errorMessage = `❌ *Lyrics Not Found*\n\nCould not find lyrics for "${query}"\n\nTry:\n• Different spelling\n• Include artist name\n• Check song title\n• Try a more popular song`;
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = `⏰ *Request Timeout*\n\nThe lyrics service is taking too long.\n\nPlease try again in a moment.`;
        } else if (error.message.includes('network') || !error.response) {
            errorMessage = `🌐 *Network Error*\n\nCannot connect to lyrics services.\n\nCheck your internet connection and try again.`;
        } else {
            errorMessage = `❌ *Error Fetching Lyrics*\n\n${error.message || 'Unknown error occurred'}\n\nPlease try a different song.`;
        }
        
        await sock.sendMessage(chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = { lyricsCommand };
