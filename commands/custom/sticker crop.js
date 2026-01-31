const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const settings = require('../settings');
const webp = require('node-webpmux');
const crypto = require('crypto');

const execAsync = promisify(exec);

// Configuration constants
const CONFIG = {
    TEMP_DIR: path.join(process.cwd(), 'tmp'),
    MAX_STICKER_SIZE_KB: 1000,
    LARGE_FILE_THRESHOLD_KB: 5000,
    STICKER_SIZE: 512,
    COMPRESSION: {
        ANIMATED: {
            LARGE: {
                DURATION: 2,
                FPS: 8,
                QUALITY: 30,
                BITRATE: '100k'
            },
            NORMAL: {
                DURATION: 3,
                FPS: 12,
                QUALITY: 50,
                BITRATE: '150k'
            }
        },
        STATIC: {
            QUALITY: 75
        }
    },
    METADATA: {
        EMOJIS: ['✂️'],
        PACK_NAME: settings.packname || 'KnightBot'
    }
};

class StickerCropService {
    constructor() {
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(CONFIG.TEMP_DIR)) {
            fs.mkdirSync(CONFIG.TEMP_DIR, { recursive: true });
        }
    }

    generateTempPath(prefix, extension = '') {
        const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;
        return path.join(CONFIG.TEMP_DIR, filename);
    }

    async getMediaBuffer(targetMessage, sock) {
        try {
            return await downloadMediaMessage(targetMessage, 'buffer', {}, {
                logger: undefined,
                reuploadRequest: sock.updateMediaMessage
            });
        } catch (error) {
            console.error('Error downloading media:', error);
            throw new Error('Failed to download media');
        }
    }

    isAnimatedMedia(mediaMessage) {
        return mediaMessage.mimetype?.includes('gif') ||
               mediaMessage.mimetype?.includes('video') ||
               (mediaMessage.seconds && mediaMessage.seconds > 0);
    }

    buildFfmpegCommand(inputPath, outputPath, isAnimated, fileSizeKB) {
        const cropFilter = `crop=min(iw\\,ih):min(iw\\,ih)`;
        const scaleFilter = `scale=${CONFIG.STICKER_SIZE}:${CONFIG.STICKER_SIZE}`;
        
        let filters = [cropFilter, scaleFilter];
        
        if (isAnimated) {
            const isLargeFile = fileSizeKB > CONFIG.LARGE_FILE_THRESHOLD_KB;
            const config = isLargeFile ? 
                CONFIG.COMPRESSION.ANIMATED.LARGE : 
                CONFIG.COMPRESSION.ANIMATED.NORMAL;
            
            filters.push(`fps=${config.FPS}`);
            
            return `ffmpeg -i "${inputPath}" -t ${config.DURATION} ` +
                   `-vf "${filters.join(',')}" ` +
                   `-c:v libwebp -preset default -loop 0 -vsync 0 ` +
                   `-pix_fmt yuva420p -quality ${config.QUALITY} ` +
                   `-compression_level 6 -b:v ${config.BITRATE} ` +
                   `-max_muxing_queue_size 1024 -y "${outputPath}"`;
        } else {
            filters.push('format=rgba');
            return `ffmpeg -i "${inputPath}" ` +
                   `-vf "${filters.join(',')}" ` +
                   `-c:v libwebp -preset default -loop 0 -vsync 0 ` +
                   `-pix_fmt yuva420p -quality ${CONFIG.COMPRESSION.STATIC.QUALITY} ` +
                   `-compression_level 6 -y "${outputPath}"`;
        }
    }

    async convertToWebp(inputBuffer, isAnimated) {
        const tempInput = this.generateTempPath('input');
        const tempOutput = this.generateTempPath('output', '.webp');
        
        try {
            // Write input buffer to temp file
            fs.writeFileSync(tempInput, inputBuffer);
            
            // Build and execute ffmpeg command
            const fileSizeKB = inputBuffer.length / 1024;
            const command = this.buildFfmpegCommand(tempInput, tempOutput, isAnimated, fileSizeKB);
            
            await execAsync(command);
            
            // Verify output
            if (!fs.existsSync(tempOutput)) {
                throw new Error('FFmpeg failed to create output file');
            }
            
            const outputStats = fs.statSync(tempOutput);
            if (outputStats.size === 0) {
                throw new Error('FFmpeg created empty output file');
            }
            
            const webpBuffer = fs.readFileSync(tempOutput);
            const finalSizeKB = webpBuffer.length / 1024;
            
            console.log(`Final sticker size: ${Math.round(finalSizeKB)} KB`);
            
            if (finalSizeKB > CONFIG.MAX_STICKER_SIZE_KB) {
                console.log(`⚠️ Warning: Sticker size (${Math.round(finalSizeKB)} KB) exceeds recommended limit`);
            }
            
            return webpBuffer;
            
        } finally {
            // Cleanup temp files
            this.cleanupFile(tempInput);
            this.cleanupFile(tempOutput);
        }
    }

    async addMetadata(webpBuffer) {
        try {
            const img = new webp.Image();
            await img.load(webpBuffer);
            
            // Create metadata
            const metadata = {
                'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
                'sticker-pack-name': CONFIG.METADATA.PACK_NAME,
                'emojis': CONFIG.METADATA.EMOJIS
            };
            
            // Create EXIF buffer
            const exifHeader = Buffer.from([
                0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
                0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x16, 0x00, 0x00, 0x00
            ]);
            
            const jsonBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
            const exif = Buffer.concat([exifHeader, jsonBuffer]);
            exif.writeUIntLE(jsonBuffer.length, 14, 4);
            
            // Set EXIF data
            img.exif = exif;
            
            // Save with metadata
            return await img.save(null);
            
        } catch (error) {
            console.error('Error adding metadata:', error);
            throw error;
        }
    }

    cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error(`Error cleaning up file ${filePath}:`, error);
        }
    }

    getTargetMessage(message, chatId) {
        // If message is a reply, use the quoted message
        const quotedInfo = message.message?.extendedTextMessage?.contextInfo;
        
        if (quotedInfo?.quotedMessage) {
            return {
                key: {
                    remoteJid: chatId,
                    id: quotedInfo.stanzaId,
                    participant: quotedInfo.participant
                },
                message: quotedInfo.quotedMessage
            };
        }
        
        // Otherwise use the original message
        return message;
    }

    validateMediaMessage(message) {
        return message.message?.imageMessage ||
               message.message?.videoMessage ||
               message.message?.documentMessage ||
               message.message?.stickerMessage;
    }

    async sendErrorMessage(sock, chatId, text, quotedMessage) {
        const errorResponse = {
            text,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363161513685998@newsletter',
                    newsletterName: 'KnightBot MD',
                    serverMessageId: -1
                }
            }
        };
        
        await sock.sendMessage(chatId, errorResponse, { quoted: quotedMessage });
    }
}

async function stickercropCommand(sock, chatId, message) {
    const service = new StickerCropService();
    const quotedMessage = message;
    
    try {
        // Get target message (either original or quoted)
        const targetMessage = service.getTargetMessage(message, chatId);
        
        // Validate media
        if (!service.validateMediaMessage(targetMessage)) {
            await service.sendErrorMessage(
                sock,
                chatId,
                'Please reply to an image/video/sticker with .crop, or send an image/video/sticker with .crop as the caption.',
                quotedMessage
            );
            return;
        }
        
        // Get media buffer
        const mediaBuffer = await service.getMediaBuffer(targetMessage, sock);
        if (!mediaBuffer) {
            await service.sendErrorMessage(
                sock,
                chatId,
                'Failed to download media. Please try again.',
                quotedMessage
            );
            return;
        }
        
        // Check if media is animated
        const mediaType = targetMessage.message?.imageMessage ||
                         targetMessage.message?.videoMessage ||
                         targetMessage.message?.documentMessage ||
                         targetMessage.message?.stickerMessage;
        
        const isAnimated = service.isAnimatedMedia(mediaType);
        
        // Convert to WebP
        const webpBuffer = await service.convertToWebp(mediaBuffer, isAnimated);
        
        // Add metadata
        const finalBuffer = await service.addMetadata(webpBuffer);
        
        // Send sticker
        await sock.sendMessage(chatId, { 
            sticker: finalBuffer
        }, { quoted: quotedMessage });
        
    } catch (error) {
        console.error('Error in stickercrop command:', error);
        
        await service.sendErrorMessage(
            sock,
            chatId,
            'Failed to crop sticker! Try with an image.',
            quotedMessage
        );
    }
}

// Export helper function for external use
async function stickercropFromBuffer(inputBuffer, isAnimated) {
    const service = new StickerCropService();
    
    try {
        const webpBuffer = await service.convertToWebp(inputBuffer, isAnimated);
        const finalBuffer = await service.addMetadata(webpBuffer);
        return finalBuffer;
    } catch (error) {
        console.error('Error in stickercropFromBuffer:', error);
        throw error;
    }
}

module.exports = stickercropCommand;
module.exports.stickercropFromBuffer = stickercropFromBuffer;
