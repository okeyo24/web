const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const fsAsync = fs.promises;
const path = require('path');
const { UploadFileUgu, TelegraPh } = require('../lib/uploader');

// Media type to extension mapping
const MEDIA_TYPE_MAP = {
    imageMessage: { type: 'image', ext: '.jpg', format: 'image' },
    videoMessage: { type: 'video', ext: '.mp4', format: 'video' },
    audioMessage: { type: 'audio', ext: '.mp3', format: 'audio' },
    stickerMessage: { type: 'sticker', ext: '.webp', format: 'image' },
    documentMessage: { type: 'document', ext: null, format: 'document' }
};

// Supported image extensions for Telegraph
const SUPPORTED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/**
 * Extract media buffer and extension from a message
 * @param {object} message - WhatsApp message object
 * @returns {Promise<{buffer: Buffer, ext: string, type: string}|null>}
 */
async function extractMediaFromMessage(message) {
    const m = message.message || {};
    
    for (const [msgType, info] of Object.entries(MEDIA_TYPE_MAP)) {
        if (m[msgType]) {
            try {
                const stream = await downloadContentFromMessage(m[msgType], info.type);
                const chunks = [];
                
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                
                const buffer = Buffer.concat(chunks);
                
                // Handle document message specially for file extension
                let extension = info.ext;
                if (msgType === 'documentMessage') {
                    const fileName = m.documentMessage.fileName || 'file.bin';
                    extension = path.extname(fileName).toLowerCase() || '.bin';
                }
                
                return {
                    buffer,
                    ext: extension,
                    type: info.type,
                    format: info.format
                };
            } catch (error) {
                console.error(`Error extracting ${info.type}:`, error.message);
                return null;
            }
        }
    }
    
    return null;
}

/**
 * Get quoted message media if present
 * @param {object} message - Original message
 * @returns {Promise<{buffer: Buffer, ext: string, type: string}|null>}
 */
async function getQuotedMedia(message) {
    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (!quotedMessage) {
        return null;
    }
    
    return await extractMediaFromMessage({ message: quotedMessage });
}

/**
 * Upload file to appropriate service based on type
 * @param {string} filePath - Path to temporary file
 * @param {string} extension - File extension
 * @returns {Promise<string>} Uploaded URL
 */
async function uploadToService(filePath, extension) {
    // Use TelegraPh for images if supported
    if (SUPPORTED_IMAGE_EXTS.includes(extension.toLowerCase())) {
        try {
            return await TelegraPh(filePath);
        } catch (telegraphError) {
            console.log('TelegraPh failed, trying Uguu:', telegraphError.message);
        }
    }
    
    // Use Uguu for all other files or as fallback
    try {
        const result = await UploadFileUgu(filePath);
        
        // Handle different response formats
        if (typeof result === 'string') {
            return result;
        } else if (result && result.url) {
            return result.url;
        } else if (result && result.url_full) {
            return result.url_full;
        } else {
            throw new Error('Invalid response from upload service');
        }
    } catch (uguError) {
        console.error('Uguu upload failed:', uguError.message);
        throw new Error(`Both upload services failed: ${uguError.message}`);
    }
}

/**
 * Create temporary file with unique name
 * @param {Buffer} buffer - File buffer
 * @param {string} extension - File extension
 * @returns {Promise<string>} Temporary file path
 */
async function createTempFile(buffer, extension) {
    const tempDir = path.join(__dirname, '../temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
        await fsAsync.mkdir(tempDir, { recursive: true });
    }
    
    // Create unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `upload_${timestamp}_${random}${extension}`;
    const tempPath = path.join(tempDir, filename);
    
    // Write file
    await fsAsync.writeFile(tempPath, buffer);
    
    return tempPath;
}

/**
 * Clean up temporary file
 * @param {string} filePath - Path to temporary file
 */
async function cleanupTempFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            await fsAsync.unlink(filePath);
        }
    } catch (error) {
        console.error('Error cleaning up temp file:', error.message);
    }
}

/**
 * Main URL command handler
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Original message
 */
async function urlCommand(sock, chatId, message) {
    let tempFilePath = null;
    
    try {
        // Try to get media from current message
        let media = await extractMediaFromMessage(message);
        
        // If no media in current message, try quoted message
        if (!media) {
            media = await getQuotedMedia(message);
        }
        
        // No media found
        if (!media) {
            const helpText = `📤 *Media Uploader*\n\n` +
                           `Please send or reply to a media file with one of these commands:\n\n` +
                           `• Image (JPG, PNG, WEBP)\n` +
                           `• Video (MP4, etc.)\n` +
                           `• Audio (MP3, etc.)\n` +
                           `• Sticker (WEBP)\n` +
                           `• Document (Any file type)\n\n` +
                           `I'll upload it and give you a shareable URL!`;
            
            await sock.sendMessage(chatId,
                { text: helpText },
                { quoted: message }
            );
            return;
        }
        
        // Create temporary file
        tempFilePath = await createTempFile(media.buffer, media.ext);
        
        // Send processing message
        const processingText = `🔄 *Processing ${media.type}...*\n\n` +
                              `File: ${media.ext.toUpperCase()}\n` +
                              `Size: ${(media.buffer.length / 1024).toFixed(2)} KB\n` +
                              `Please wait while I upload...`;
        
        await sock.sendMessage(chatId,
            { text: processingText },
            { quoted: message }
        );
        
        // Upload to service
        const uploadUrl = await uploadToService(tempFilePath, media.ext);
        
        // Prepare response based on file type
        let responseText;
        const fileSize = (media.buffer.length / 1024 / 1024).toFixed(2);
        
        if (media.type === 'image') {
            responseText = `🖼️ *Image Uploaded Successfully!*\n\n` +
                          `🔗 URL: ${uploadUrl}\n` +
                          `📁 Type: Image (${media.ext.toUpperCase()})\n` +
                          `📊 Size: ${fileSize} MB\n\n` +
                          `📋 *Quick Actions:*\n` +
                          `• Copy: \`${uploadUrl}\`\n` +
                          `• View: ${uploadUrl.replace('https://', '')}`;
        } else if (media.type === 'video') {
            responseText = `🎥 *Video Uploaded Successfully!*\n\n` +
                          `🔗 URL: ${uploadUrl}\n` +
                          `📁 Type: Video (${media.ext.toUpperCase()})\n` +
                          `📊 Size: ${fileSize} MB\n\n` +
                          `📋 *Quick Actions:*\n` +
                          `• Copy: \`${uploadUrl}\`\n` +
                          `• Download: ${uploadUrl}`;
        } else if (media.type === 'audio') {
            responseText = `🎵 *Audio Uploaded Successfully!*\n\n` +
                          `🔗 URL: ${uploadUrl}\n` +
                          `📁 Type: Audio (${media.ext.toUpperCase()})\n` +
                          `📊 Size: ${fileSize} MB\n\n` +
                          `📋 *Quick Actions:*\n` +
                          `• Copy: \`${uploadUrl}\`\n` +
                          `• Play: ${uploadUrl}`;
        } else {
            responseText = `📄 *File Uploaded Successfully!*\n\n` +
                          `🔗 URL: ${uploadUrl}\n` +
                          `📁 Type: ${media.type} (${media.ext.toUpperCase()})\n` +
                          `📊 Size: ${fileSize} MB\n\n` +
                          `📋 *Download Link:*\n${uploadUrl}`;
        }
        
        // Send success message
        await sock.sendMessage(chatId,
            { text: responseText },
            { quoted: message }
        );
        
    } catch (error) {
        console.error('[URL Command Error]:', error);
        
        const errorMessage = error.message.includes('upload services failed')
            ? `❌ *Upload Failed*\n\nBoth upload services are currently unavailable.\nPlease try again in a few minutes.`
            : `❌ *Upload Failed*\n\nError: ${error.message || 'Unknown error occurred'}\n\nPlease try again or use a different file.`;
        
        await sock.sendMessage(chatId,
            { text: errorMessage },
            { quoted: message }
        );
        
    } finally {
        // Cleanup temporary file
        if (tempFilePath) {
            setTimeout(() => {
                cleanupTempFile(tempFilePath).catch(() => {});
            }, 5000); // Delay cleanup to ensure upload is complete
        }
    }
}

module.exports = urlCommand;
