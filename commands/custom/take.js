const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Image: WebpImage } = require('node-webpmux');

// Constants
const CONSTANTS = {
    MESSAGES: {
        NO_REPLY: '❌ Please reply to a sticker with `.take <packname>`',
        INVALID_STICKER: '❌ The replied message is not a sticker',
        DOWNLOAD_FAILED: '❌ Failed to download sticker',
        PROCESSING_ERROR: '❌ Error processing sticker',
        COMMAND_ERROR: '❌ Error processing command',
        SUCCESS: '✅ Sticker metadata updated successfully!',
        PACKNAME_TOO_LONG: '❌ Pack name is too long (max 50 characters)',
        DEFAULT_PACKNAME: 'Knight Bot',
        DEFAULT_EMOJI: '🤖'
    },
    VALIDATION: {
        MAX_PACKNAME_LENGTH: 50,
        MAX_EMOJI_COUNT: 3
    },
    EMOJIS: {
        DEFAULT: '🤖',
        POPULAR: ['😂', '❤️', '😊', '😎', '👍', '🔥', '🎉', '💯', '✨', '🥺']
    },
    METADATA: {
        STICKER_PACK_AUTHOR: 'Knight Bot',
        ANDROID_APPSTORE_LINK: 'https://play.google.com/store/apps/details?id=com.whatsapp',
        IOS_APPSTORE_LINK: 'https://apps.apple.com/app/whatsapp-messenger/id310633997'
    }
};

/**
 * Generate random sticker pack ID
 */
function generateStickerPackId() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate pack name
 */
function validatePackName(packName) {
    if (!packName || packName.trim() === '') {
        return CONSTANTS.MESSAGES.DEFAULT_PACKNAME;
    }
    
    const trimmed = packName.trim();
    
    if (trimmed.length > CONSTANTS.VALIDATION.MAX_PACKNAME_LENGTH) {
        throw new Error(CONSTANTS.MESSAGES.PACKNAME_TOO_LONG);
    }
    
    return trimmed;
}

/**
 * Parse emojis from command arguments
 */
function parseEmojis(args) {
    const emojis = [];
    
    // Extract emojis from args
    for (const arg of args) {
        // Simple emoji detection (can be enhanced with proper regex)
        const emojiRegex = /[\p{Emoji}]/gu;
        const matches = arg.match(emojiRegex);
        
        if (matches) {
            emojis.push(...matches);
        }
    }
    
    // Limit number of emojis
    const limitedEmojis = emojis.slice(0, CONSTANTS.VALIDATION.MAX_EMOJI_COUNT);
    
    // Return default if no emojis found
    return limitedEmojis.length > 0 ? limitedEmojis : [CONSTANTS.MESSAGES.DEFAULT_EMOJI];
}

/**
 * Create sticker metadata
 */
function createStickerMetadata(packName, emojis = [CONSTANTS.EMOJIS.DEFAULT]) {
    return {
        'sticker-pack-id': generateStickerPackId(),
        'sticker-pack-name': packName,
        'sticker-pack-publisher': CONSTANTS.METADATA.STICKER_PACK_AUTHOR,
        'android-app-store-link': CONSTANTS.METADATA.ANDROID_APPSTORE_LINK,
        'ios-app-store-link': CONSTANTS.METADATA.IOS_APPSTORE_LINK,
        'emojis': emojis,
        'preview-image': 'data:image/png;base64,', // Empty preview
        'preview-image-sha256': crypto.createHash('sha256').update('').digest('hex'),
        'preview-image-enc-sha256': crypto.createHash('sha256').update('').digest('hex'),
        'body-sha256': crypto.createHash('sha256').update('').digest('hex'),
        'body-enc-sha256': crypto.createHash('sha256').update('').digest('hex')
    };
}

/**
 * Create EXIF buffer from metadata
 */
function createExifBuffer(metadata) {
    // Create EXIF header
    const exifHeader = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, // TIFF header
        0x08, 0x00, 0x00, 0x00, // Offset to first IFD
        0x01, 0x00,             // Number of directory entries
        0x41, 0x57, 0x07, 0x00, // Tag for sticker metadata (0x5741)
        0x04, 0x00,             // Type: Long
        0x01, 0x00, 0x00, 0x00, // Count: 1
        0x16, 0x00, 0x00, 0x00  // Offset to value
    ]);
    
    // Convert metadata to JSON and create buffer
    const jsonString = JSON.stringify(metadata);
    const jsonBuffer = Buffer.from(jsonString, 'utf8');
    
    // Calculate total length
    const dataLength = jsonBuffer.length;
    exifHeader.writeUInt32LE(dataLength, 14); // Update length at offset 14
    
    // Combine header and data
    return Buffer.concat([exifHeader, jsonBuffer]);
}

/**
 * Process sticker buffer with new metadata
 */
async function processStickerWithMetadata(stickerBuffer, packName, emojis) {
    try {
        // Load the webp image
        const image = new WebpImage();
        await image.load(stickerBuffer);
        
        // Create metadata
        const metadata = createStickerMetadata(packName, emojis);
        
        // Create EXIF buffer
        const exifBuffer = createExifBuffer(metadata);
        
        // Set EXIF data
        image.exif = exifBuffer;
        
        // Save image with new metadata
        return await image.save(null);
        
    } catch (error) {
        console.error('❌ Error processing sticker metadata:', error);
        throw new Error(CONSTANTS.MESSAGES.PROCESSING_ERROR);
    }
}

/**
 * Download sticker from message
 */
async function downloadSticker(sock, message) {
    try {
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quotedMessage?.stickerMessage) {
            throw new Error('No sticker message');
        }
        
        const stickerBuffer = await downloadMediaMessage(
            {
                key: message.key,
                message: quotedMessage,
                messageType: 'stickerMessage'
            },
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            }
        );
        
        if (!stickerBuffer || !Buffer.isBuffer(stickerBuffer)) {
            throw new Error('Invalid sticker buffer');
        }
        
        return stickerBuffer;
        
    } catch (error) {
        console.error('❌ Error downloading sticker:', error);
        throw new Error(CONSTANTS.MESSAGES.DOWNLOAD_FAILED);
    }
}

/**
 * Validate and extract command arguments
 */
function parseCommandArguments(args) {
    const parsed = {
        packName: CONSTANTS.MESSAGES.DEFAULT_PACKNAME,
        emojis: [CONSTANTS.EMOJIS.DEFAULT]
    };
    
    if (!args || args.length === 0) {
        return parsed;
    }
    
    try {
        // First argument is pack name
        parsed.packName = validatePackName(args.join(' '));
        
        // Try to extract emojis
        const extractedEmojis = parseEmojis(args);
        parsed.emojis = extractedEmojis;
        
    } catch (error) {
        // If pack name validation fails, use default
        if (error.message === CONSTANTS.MESSAGES.PACKNAME_TOO_LONG) {
            throw error;
        }
        parsed.packName = CONSTANTS.MESSAGES.DEFAULT_PACKNAME;
    }
    
    return parsed;
}

/**
 * Main take command handler
 */
async function takeCommand(sock, chatId, message, args) {
    try {
        // Check if it's a reply
        if (!message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            return await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.NO_REPLY },
                { quoted: message }
            );
        }
        
        // Check if replied message is a sticker
        const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
        if (!quotedMessage.stickerMessage) {
            return await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.INVALID_STICKER },
                { quoted: message }
            );
        }
        
        // Parse command arguments
        let packName, emojis;
        try {
            const parsed = parseCommandArguments(args);
            packName = parsed.packName;
            emojis = parsed.emojis;
        } catch (error) {
            if (error.message === CONSTANTS.MESSAGES.PACKNAME_TOO_LONG) {
                return await sock.sendMessage(chatId, 
                    { text: CONSTANTS.MESSAGES.PACKNAME_TOO_LONG },
                    { quoted: message }
                );
            }
            packName = CONSTANTS.MESSAGES.DEFAULT_PACKNAME;
            emojis = [CONSTANTS.EMOJIS.DEFAULT];
        }
        
        // Download the sticker
        const stickerBuffer = await downloadSticker(sock, message);
        
        // Process sticker with new metadata
        const finalSticker = await processStickerWithMetadata(stickerBuffer, packName, emojis);
        
        // Send the modified sticker
        await sock.sendMessage(chatId, {
            sticker: finalSticker
        }, {
            quoted: message
        });
        
        // Send success confirmation
        await sock.sendMessage(chatId, {
            text: `${CONSTANTS.MESSAGES.SUCCESS}\n\n` +
                  `📦 *Pack Name:* ${packName}\n` +
                  `😀 *Emojis:* ${emojis.join(' ')}\n` +
                  `👤 *Author:* ${CONSTANTS.METADATA.STICKER_PACK_AUTHOR}`
        });
        
        // Log successful operation
        console.log('✅ Sticker metadata updated:', {
            chatId: chatId.slice(0, 10) + '...',
            packName: packName,
            emojis: emojis,
            size: `${(finalSticker.length / 1024).toFixed(2)} KB`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Take command error:', error);
        
        // Determine appropriate error message
        let errorMessage = CONSTANTS.MESSAGES.COMMAND_ERROR;
        if (error.message === CONSTANTS.MESSAGES.DOWNLOAD_FAILED) {
            errorMessage = CONSTANTS.MESSAGES.DOWNLOAD_FAILED;
        } else if (error.message === CONSTANTS.MESSAGES.PROCESSING_ERROR) {
            errorMessage = CONSTANTS.MESSAGES.PROCESSING_ERROR;
        }
        
        await sock.sendMessage(chatId, 
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = takeCommand;
