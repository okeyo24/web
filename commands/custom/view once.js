const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs').promises;
const path = require('path');

// Constants
const TEMP_DIR = path.join(__dirname, '../temp/viewonce');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

/**
 * Ensure temporary directory exists
 */
async function ensureTempDir() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
        console.error('[ViewOnce] Failed to create temp directory:', error);
    }
}

/**
 * Get quoted message from context
 * @param {object} message - WhatsApp message
 * @returns {object|null} Quoted message data
 */
function getQuotedMessage(message) {
    try {
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        if (!contextInfo || !contextInfo.quotedMessage) {
            return null;
        }

        const quoted = contextInfo.quotedMessage;
        const quotedImage = quoted.imageMessage;
        const quotedVideo = quoted.videoMessage;

        return {
            image: quotedImage,
            video: quotedVideo,
            sender: contextInfo.participant || null,
            timestamp: contextInfo.stanzaId ? new Date(parseInt(contextInfo.stanzaId.substring(0, 8), 16) * 1000) : null
        };
    } catch (error) {
        console.error('[ViewOnce] Error extracting quoted message:', error);
        return null;
    }
}

/**
 * Download media from message
 * @param {object} mediaMessage - Image or video message
 * @param {string} mediaType - 'image' or 'video'
 * @returns {Promise<Buffer>} Media buffer
 */
async function downloadMedia(mediaMessage, mediaType) {
    try {
        const stream = await downloadContentFromMessage(mediaMessage, mediaType);
        const chunks = [];
        
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        
        return Buffer.concat(chunks);
    } catch (error) {
        console.error(`[ViewOnce] Failed to download ${mediaType}:`, error);
        throw new Error(`Failed to download ${mediaType}: ${error.message}`);
    }
}

/**
 * Save media to temporary file (for debugging/logging)
 * @param {Buffer} buffer - Media buffer
 * @param {string} extension - File extension
 * @returns {Promise<string|null>} File path or null
 */
async function saveToTempFile(buffer, extension) {
    try {
        await ensureTempDir();
        
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 10);
        const filename = `viewonce_${timestamp}_${randomId}${extension}`;
        const filepath = path.join(TEMP_DIR, filename);
        
        await fs.writeFile(filepath, buffer);
        
        // Schedule cleanup after 5 minutes
        setTimeout(async () => {
            try {
                await fs.unlink(filepath);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
        }, 5 * 60 * 1000);
        
        return filepath;
    } catch (error) {
        console.error('[ViewOnce] Failed to save temp file:', error);
        return null;
    }
}

/**
 * Get file extension based on media type
 * @param {object} mediaMessage - Media message
 * @param {string} mediaType - 'image' or 'video'
 * @returns {string} File extension
 */
function getFileExtension(mediaMessage, mediaType) {
    if (mediaType === 'image') {
        // Check for specific mimetypes
        if (mediaMessage.mimetype === 'image/jpeg') return '.jpg';
        if (mediaMessage.mimetype === 'image/png') return '.png';
        if (mediaMessage.mimetype === 'image/webp') return '.webp';
        if (mediaMessage.mimetype === 'image/gif') return '.gif';
        return '.jpg'; // Default
    } else if (mediaType === 'video') {
        if (mediaMessage.mimetype === 'video/mp4') return '.mp4';
        if (mediaMessage.mimetype === 'video/3gp') return '.3gp';
        if (mediaMessage.mimetype === 'video/quicktime') return '.mov';
        return '.mp4'; // Default
    }
    return '.bin';
}

/**
 * Get media info for caption
 * @param {object} mediaMessage - Media message
 * @param {string} mediaType - 'image' or 'video'
 * @param {Buffer} buffer - Media buffer
 * @returns {string} Formatted media info
 */
function getMediaInfo(mediaMessage, mediaType, buffer) {
    const fileSize = (buffer.length / 1024 / 1024).toFixed(2);
    const dimensions = mediaMessage.height && mediaMessage.width 
        ? `${mediaMessage.width}x${mediaMessage.height}` 
        : 'Unknown';
    
    const info = [];
    info.push(`📁 Type: ${mediaType.toUpperCase()}`);
    info.push(`📊 Size: ${fileSize} MB`);
    
    if (dimensions !== 'Unknown') {
        info.push(`📐 Dimensions: ${dimensions}`);
    }
    
    if (mediaMessage.mimetype) {
        info.push(`🎞️ Format: ${mediaMessage.mimetype.split('/')[1].toUpperCase()}`);
    }
    
    if (mediaMessage.seconds) {
        const minutes = Math.floor(mediaMessage.seconds / 60);
        const seconds = mediaMessage.seconds % 60;
        info.push(`⏱️ Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
    
    return info.join('\n');
}

/**
 * Main viewonce command handler
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Original message
 */
async function viewonceCommand(sock, chatId, message) {
    try {
        // Get quoted message
        const quotedData = getQuotedMessage(message);
        
        if (!quotedData) {
            const helpMessage = `👁️ *View Once Revealer*\n\n` +
                              `Reply to a view-once media message to reveal it.\n\n` +
                              `📋 *How to use:*\n` +
                              `1. Find a view-once image/video\n` +
                              `2. Reply to it with: *.viewonce*\n` +
                              `3. The media will be revealed\n\n` +
                              `⚠️ *Note:* Only works on view-once media`;
            
            await sock.sendMessage(chatId,
                { text: helpMessage },
                { quoted: message }
            );
            return;
        }

        const { image: quotedImage, video: quotedVideo, sender, timestamp } = quotedData;

        // Check if it's view-once media
        const isViewOnceImage = quotedImage && quotedImage.viewOnce === true;
        const isViewOnceVideo = quotedVideo && quotedVideo.viewOnce === true;

        if (!isViewOnceImage && !isViewOnceVideo) {
            const errorMessage = `❌ *Not a View-Once Message*\n\n` +
                                `The message you replied to is not a view-once media.\n\n` +
                                `🔍 *What to look for:*\n` +
                                `• Message with "VIEW ONCE" label\n` +
                                `• Image/video that disappears after opening\n` +
                                `• Has an eye icon with slash`;
            
            await sock.sendMessage(chatId,
                { text: errorMessage },
                { quoted: message }
            );
            return;
        }

        // Send processing message
        await sock.sendMessage(chatId,
            { text: '🔍 *Processing view-once media...*' },
            { quoted: message }
        );

        let mediaBuffer;
        let mediaType;
        let mediaMessage;

        if (isViewOnceImage) {
            mediaType = 'image';
            mediaMessage = quotedImage;
            
            // Check file size
            const fileSize = quotedImage.fileLength || 0;
            if (fileSize > MAX_FILE_SIZE) {
                throw new Error(`Image too large (${(fileSize / 1024 / 1024).toFixed(2)}MB). Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
            }
            
            mediaBuffer = await downloadMedia(quotedImage, 'image');
        } else if (isViewOnceVideo) {
            mediaType = 'video';
            mediaMessage = quotedVideo;
            
            // Check file size
            const fileSize = quotedVideo.fileLength || 0;
            if (fileSize > MAX_FILE_SIZE) {
                throw new Error(`Video too large (${(fileSize / 1024 / 1024).toFixed(2)}MB). Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
            }
            
            mediaBuffer = await downloadMedia(quotedVideo, 'video');
        }

        // Save to temp file for debugging (optional)
        const extension = getFileExtension(mediaMessage, mediaType);
        await saveToTempFile(mediaBuffer, extension);

        // Get media info for caption
        const mediaInfo = getMediaInfo(mediaMessage, mediaType, mediaBuffer);
        const timestampStr = timestamp ? timestamp.toLocaleTimeString() : 'Unknown time';
        
        const caption = `🔓 *View Once Media Revealed*\n\n` +
                       `${mediaInfo}\n\n` +
                       `👤 From: ${sender ? sender.split('@')[0] : 'Unknown'}\n` +
                       `🕒 Sent: ${timestampStr}\n\n` +
                       `⚠️ *Remember:* View-once media is meant to be private`;

        // Send the media
        if (mediaType === 'image') {
            await sock.sendMessage(chatId,
                {
                    image: mediaBuffer,
                    caption: caption,
                    fileName: `viewonce_${Date.now()}${extension}`
                },
                { quoted: message }
            );
        } else if (mediaType === 'video') {
            await sock.sendMessage(chatId,
                {
                    video: mediaBuffer,
                    caption: caption,
                    fileName: `viewonce_${Date.now()}${extension}`
                },
                { quoted: message }
            );
        }

        // Send success confirmation
        await sock.sendMessage(chatId,
            { text: '✅ *View-once media has been revealed successfully!*' },
            { quoted: message }
        );

    } catch (error) {
        console.error('[ViewOnce Command Error]:', error);
        
        let errorMessage;
        
        if (error.message.includes('too large')) {
            errorMessage = `❌ *File Too Large*\n\n${error.message}\n\nTry with a smaller media file.`;
        } else if (error.message.includes('Failed to download')) {
            errorMessage = `❌ *Download Failed*\n\nCould not download the media.\n\nPossible reasons:\n• Media expired\n• Network issue\n• Server problem`;
        } else {
            errorMessage = `❌ *Error Revealing Media*\n\n${error.message || 'Unknown error occurred'}`;
        }
        
        await sock.sendMessage(chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = viewonceCommand;
