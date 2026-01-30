const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const webp = require('node-webpmux');
const crypto = require('crypto');

const ANIMU_BASE = 'https://api.some-random-api.com/animu';

// Supported anime action types
const SUPPORTED_TYPES = [
    'nom', 'poke', 'cry', 'kiss', 'pat', 
    'hug', 'wink', 'face-palm', 'quote'
];

// Type normalization mapping
const TYPE_ALIASES = {
    'facepalm': 'face-palm',
    'face_palm': 'face-palm',
    'animu-quote': 'quote',
    'animuquote': 'quote'
};

/**
 * Normalize user input to supported type
 * @param {string} input - User input type
 * @returns {string} Normalized type
 */
function normalizeType(input) {
    if (!input) return '';
    
    const lower = input.toLowerCase().trim();
    return TYPE_ALIASES[lower] || lower;
}

/**
 * Convert media buffer to WhatsApp sticker
 * @param {Buffer} mediaBuffer - Input media buffer
 * @param {boolean} isAnimated - Whether media is animated (GIF)
 * @returns {Promise<Buffer>} Sticker buffer
 */
async function convertMediaToSticker(mediaBuffer, isAnimated) {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString('hex');
    const fileId = `${timestamp}_${randomId}`;
    
    const inputExt = isAnimated ? 'gif' : 'jpg';
    const inputPath = path.join(tmpDir, `${fileId}.${inputExt}`);
    const outputPath = path.join(tmpDir, `${fileId}.webp`);
    
    try {
        // Write input file
        fs.writeFileSync(inputPath, mediaBuffer);

        // FFmpeg conversion command
        const ffmpegCmd = isAnimated 
            ? `ffmpeg -y -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=15" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 60 -compression_level 6 "${outputPath}"`
            : `ffmpeg -y -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCmd, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Read converted WebP
        const webpBuffer = fs.readFileSync(outputPath);

        // Add sticker metadata
        const image = new webp.Image();
        await image.load(webpBuffer);

        const stickerMetadata = {
            'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
            'sticker-pack-name': 'Anime Stickers',
            'sticker-pack-publisher': 'Anime Bot',
            'emojis': ['🎌', '🌸', '✨']
        };

        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ]);
        
        const jsonBuffer = Buffer.from(JSON.stringify(stickerMetadata), 'utf8');
        const exifBuffer = Buffer.concat([exifAttr, jsonBuffer]);
        exifBuffer.writeUIntLE(jsonBuffer.length, 14, 4);
        
        image.exif = exifBuffer;
        const finalBuffer = await image.save(null);

        return finalBuffer;
    } finally {
        // Cleanup temporary files
        try { fs.unlinkSync(inputPath); } catch {}
        try { fs.unlinkSync(outputPath); } catch {}
    }
}

/**
 * Fetch and send anime content
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Original message
 * @param {string} type - Anime action type
 */
async function sendAnimeContent(sock, chatId, message, type) {
    try {
        const endpoint = `${ANIMU_BASE}/${type}`;
        const response = await axios.get(endpoint, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Anime-Bot/1.0)' }
        });

        const data = response.data || {};

        // Handle media links (images/GIFs)
        if (data.link) {
            const mediaUrl = data.link;
            const urlLower = mediaUrl.toLowerCase();
            const isGif = urlLower.endsWith('.gif');
            const isImage = /\.(jpg|jpeg|png|webp)$/i.test(urlLower);

            if (isGif || isImage) {
                try {
                    // Download media
                    const mediaResponse = await axios.get(mediaUrl, {
                        responseType: 'arraybuffer',
                        timeout: 15000,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });

                    const mediaBuffer = Buffer.from(mediaResponse.data);
                    
                    // Convert to sticker and send
                    const stickerBuffer = await convertMediaToSticker(mediaBuffer, isGif);
                    
                    await sock.sendMessage(chatId, 
                        { sticker: stickerBuffer },
                        { quoted: message }
                    );
                    return;
                } catch (stickerError) {
                    console.error('Sticker conversion failed:', stickerError.message);
                    // Fallback to sending as image
                }
            }

            // Send as image if sticker conversion fails or not applicable
            try {
                await sock.sendMessage(chatId,
                    {
                        image: { url: mediaUrl },
                        caption: `🎌 Anime: ${type.charAt(0).toUpperCase() + type.slice(1)}`
                    },
                    { quoted: message }
                );
                return;
            } catch (imageError) {
                console.error('Image sending failed:', imageError.message);
            }
        }

        // Handle quotes
        if (data.quote) {
            const quoteText = `💬 Anime Quote:\n\n"${data.quote}"\n\n─ 🎌 Anime Bot`;
            await sock.sendMessage(chatId,
                { text: quoteText },
                { quoted: message }
            );
            return;
        }

        // No valid content found
        await sock.sendMessage(chatId,
            { text: '❌ No anime content found for this type.' },
            { quoted: message }
        );

    } catch (error) {
        console.error(`Error fetching anime ${type}:`, error.message);
        throw new Error(`Failed to fetch anime ${type}`);
    }
}

/**
 * Main anime command handler
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Original message
 * @param {string[]} args - Command arguments
 */
async function animeCommand(sock, chatId, message, args) {
    const userInput = args && args[0] ? args[0] : '';
    const type = normalizeType(userInput);

    try {
        // No type provided - show help
        if (!type) {
            let availableTypes = SUPPORTED_TYPES.join(', ');
            
            try {
                // Try to fetch types from API for dynamic help
                const apiResponse = await axios.get(ANIMU_BASE, { timeout: 5000 });
                if (apiResponse.data && apiResponse.data.types) {
                    availableTypes = apiResponse.data.types
                        .map(t => t.replace('/animu/', ''))
                        .join(', ');
                }
            } catch (apiError) {
                console.log('Using default types for help:', apiError.message);
            }

            const helpText = `🎌 *Anime Bot Commands*\n\n` +
                           `Usage: *.anime <type>*\n\n` +
                           `📋 *Available Types:*\n` +
                           `${availableTypes}\n\n` +
                           `Example: *.anime hug*\n` +
                           `Example: *.anime quote*`;
            
            await sock.sendMessage(chatId,
                { text: helpText },
                { quoted: message }
            );
            return;
        }

        // Validate type
        if (!SUPPORTED_TYPES.includes(type)) {
            const errorText = `❌ *Unsupported anime type:* ${type}\n\n` +
                            `📋 *Supported Types:*\n` +
                            `${SUPPORTED_TYPES.join(', ')}\n\n` +
                            `Use *.anime* without arguments to see all available types.`;
            
            await sock.sendMessage(chatId,
                { text: errorText },
                { quoted: message }
            );
            return;
        }

        // Send anime content
        await sendAnimeContent(sock, chatId, message, type);

    } catch (error) {
        console.error('Anime command error:', error);
        
        const errorMessage = error.response 
            ? '❌ Anime API is currently unavailable. Please try again later.'
            : '❌ An unexpected error occurred while processing your request.';
        
        await sock.sendMessage(chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = { animeCommand };
