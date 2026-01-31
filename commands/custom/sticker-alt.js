const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Constants
const CONSTANTS = {
    PATHS: {
        TEMP: path.join(__dirname, '../temp/stickers'),
        CACHE: path.join(__dirname, '../cache/stickers')
    },
    FFMPEG: {
        IMAGE: {
            SCALE: 'scale=\'min(512,iw)\':\'min(512,ih)\':force_original_aspect_ratio=decrease',
            QUALITY: 80,
            COMPRESSION: 6
        },
        VIDEO: {
            SCALE: 'scale=\'min(512,iw)\':\'min(512,ih)\':force_original_aspect_ratio=decrease',
            DURATION: 6,
            FPS: 10,
            QUALITY: 80,
            COMPRESSION: 6,
            LOOP: 0,
            PRESET: 'default'
        },
        TIMEOUT: 30000 // 30 seconds
    },
    VALIDATION: {
        MAX_IMAGE_SIZE_MB: 10,
        MAX_VIDEO_SIZE_MB: 30,
        MAX_DURATION_SECONDS: 15,
        SUPPORTED_FORMATS: {
            IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
            VIDEO: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'gif']
        }
    },
    MESSAGES: {
        NO_REPLY: '🖼️ *STICKER MAKER*\n\nPlease reply to an image or video with `.sticker`',
        INVALID_TYPE: '❌ Please reply to an image or video only!',
        DOWNLOADING: '📥 Downloading media...',
        PROCESSING: '🎨 Creating sticker...',
        SENDING: '📤 Sending sticker...',
        SUCCESS: '✅ Sticker created successfully!',
        FAILED: '❌ Failed to create sticker. Please try again.',
        FFMPEG_NOT_FOUND: '❌ FFmpeg is not installed. Required for sticker creation.',
        FILE_TOO_LARGE: (type, size, max) => `❌ ${type} is too large (${size}MB > ${max}MB limit)`,
        DURATION_TOO_LONG: (duration, max) => `❌ Video is too long (${duration}s > ${max}s limit)`,
        CLEANUP_ERROR: '⚠️ Could not clean up temporary files.'
    },
    EMOJIS: {
        IMAGE: '🖼️',
        VIDEO: '🎬',
        STICKER: '🔄',
        SUCCESS: '✅',
        ERROR: '❌'
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
 * Generate unique filename
 */
function generateFileName(extension = 'webp') {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString('hex');
    return `sticker_${timestamp}_${randomId}.${extension}`;
}

/**
 * Validate media type and size
 */
async function validateMedia(buffer, mediaType) {
    const bufferSizeMB = buffer.length / (1024 * 1024);
    
    if (mediaType === 'image') {
        if (bufferSizeMB > CONSTANTS.VALIDATION.MAX_IMAGE_SIZE_MB) {
            throw new Error(CONSTANTS.MESSAGES.FILE_TOO_LARGE(
                'Image',
                bufferSizeMB.toFixed(2),
                CONSTANTS.VALIDATION.MAX_IMAGE_SIZE_MB
            ));
        }
    } else if (mediaType === 'video') {
        if (bufferSizeMB > CONSTANTS.VALIDATION.MAX_VIDEO_SIZE_MB) {
            throw new Error(CONSTANTS.MESSAGES.FILE_TOO_LARGE(
                'Video',
                bufferSizeMB.toFixed(2),
                CONSTANTS.VALIDATION.MAX_VIDEO_SIZE_MB
            ));
        }
        
        // Note: For duration validation, we'd need to parse the video metadata
        // This is a simplified check
    }
    
    return true;
}

/**
 * Check if FFmpeg is available
 */
async function checkFFmpeg() {
    return new Promise((resolve) => {
        exec('ffmpeg -version', (error) => {
            resolve(!error);
        });
    });
}

/**
 * Execute FFmpeg command with timeout
 */
async function executeFFmpeg(command) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('FFmpeg timeout'));
        }, CONSTANTS.FFMPEG.TIMEOUT);
        
        exec(command, (error, stdout, stderr) => {
            clearTimeout(timeout);
            
            if (error) {
                console.error('FFmpeg error:', stderr);
                reject(new Error(`FFmpeg failed: ${error.message}`));
                return;
            }
            
            resolve();
        });
    });
}

/**
 * Create sticker from image
 */
async function createImageSticker(inputPath, outputPath) {
    const command = `ffmpeg -i "${inputPath}" ` +
                   `-vf "${CONSTANTS.FFMPEG.IMAGE.SCALE},format=rgba" ` +
                   `-compression_level ${CONSTANTS.FFMPEG.IMAGE.COMPRESSION} ` +
                   `-quality ${CONSTANTS.FFMPEG.IMAGE.QUALITY} ` +
                   `-y "${outputPath}"`;
    
    await executeFFmpeg(command);
}

/**
 * Create sticker from video
 */
async function createVideoSticker(inputPath, outputPath) {
    const command = `ffmpeg -i "${inputPath}" ` +
                   `-vf "${CONSTANTS.FFMPEG.VIDEO.SCALE},fps=${CONSTANTS.FFMPEG.VIDEO.FPS},format=rgba" ` +
                   `-c:v libwebp ` +
                   `-loop ${CONSTANTS.FFMPEG.VIDEO.LOOP} ` +
                   `-t ${CONSTANTS.FFMPEG.VIDEO.DURATION} ` +
                   `-preset ${CONSTANTS.FFMPEG.VIDEO.PRESET} ` +
                   `-compression_level ${CONSTANTS.FFMPEG.VIDEO.COMPRESSION} ` +
                   `-quality ${CONSTANTS.FFMPEG.VIDEO.QUALITY} ` +
                   `-y "${outputPath}"`;
    
    await executeFFmpeg(command);
}

/**
 * Download media from quoted message
 */
async function downloadMedia(quotedMessage, mediaType) {
    try {
        const stream = await downloadContentFromMessage(
            quotedMessage, 
            mediaType === 'imageMessage' ? 'image' : 'video'
        );
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        return buffer;
    } catch (error) {
        console.error('❌ Download failed:', error);
        throw new Error('Failed to download media');
    }
}

/**
 * Clean up temporary files
 */
async function cleanupFiles(...filePaths) {
    for (const filePath of filePaths) {
        if (!filePath) continue;
        
        try {
            await fs.unlink(filePath);
            console.log(`🧹 Cleaned up: ${path.basename(filePath)}`);
        } catch (error) {
            console.warn(`⚠️ Could not delete ${filePath}:`, error.message);
        }
    }
}

/**
 * Get file extension based on media type
 */
function getFileExtension(mediaType) {
    const extensions = {
        'imageMessage': 'jpg',
        'videoMessage': 'mp4'
    };
    
    return extensions[mediaType] || 'bin';
}

/**
 * Main sticker command handler
 */
async function stickerCommand(sock, chatId, message) {
    let tempInputPath = null;
    let tempOutputPath = null;
    
    try {
        // Ensure directories exist
        await ensureDirectories();
        
        // Check for quoted message
        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quotedMsg) {
            return await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.NO_REPLY },
                { quoted: message }
            );
        }
        
        // Determine media type
        const mediaType = Object.keys(quotedMsg)[0];
        
        if (!['imageMessage', 'videoMessage'].includes(mediaType)) {
            return await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.INVALID_TYPE },
                { quoted: message }
            );
        }
        
        // Check FFmpeg availability
        const hasFFmpeg = await checkFFmpeg();
        if (!hasFFmpeg) {
            return await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.FFMPEG_NOT_FOUND },
                { quoted: message }
            );
        }
        
        // Send processing message
        await sock.sendMessage(chatId, 
            { text: CONSTANTS.MESSAGES.DOWNLOADING },
            { quoted: message }
        );
        
        // Download media
        const mediaBuffer = await downloadMedia(quotedMsg[mediaType], mediaType);
        
        // Validate media
        await validateMedia(
            mediaBuffer, 
            mediaType === 'imageMessage' ? 'image' : 'video'
        );
        
        // Generate temp file paths
        const inputExt = getFileExtension(mediaType);
        const outputExt = 'webp';
        
        tempInputPath = path.join(CONSTANTS.PATHS.TEMP, generateFileName(inputExt));
        tempOutputPath = path.join(CONSTANTS.PATHS.TEMP, generateFileName(outputExt));
        
        // Write buffer to temp file
        await fs.writeFile(tempInputPath, mediaBuffer);
        
        // Send processing message
        await sock.sendMessage(chatId, 
            { text: CONSTANTS.MESSAGES.PROCESSING },
            { quoted: message }
        );
        
        // Create sticker
        if (mediaType === 'imageMessage') {
            await createImageSticker(tempInputPath, tempOutputPath);
        } else {
            await createVideoSticker(tempInputPath, tempOutputPath);
        }
        
        // Check if output file exists
        try {
            await fs.access(tempOutputPath);
        } catch {
            throw new Error('Sticker creation failed - no output file');
        }
        
        // Read output file
        const stickerBuffer = await fs.readFile(tempOutputPath);
        
        // Validate sticker size
        if (stickerBuffer.length === 0) {
            throw new Error('Empty sticker file');
        }
        
        // Send sticker
        await sock.sendMessage(chatId, 
            { text: CONSTANTS.MESSAGES.SENDING },
            { quoted: message }
        );
        
        await sock.sendMessage(chatId, {
            sticker: stickerBuffer
        }, { quoted: message });
        
        // Send success message
        await sock.sendMessage(chatId, 
            { text: CONSTANTS.MESSAGES.SUCCESS },
            { quoted: message }
        );
        
        // Log successful creation
        console.log('✅ Sticker created:', {
            type: mediaType,
            inputSize: `${(mediaBuffer.length / 1024).toFixed(2)}KB`,
            outputSize: `${(stickerBuffer.length / 1024).toFixed(2)}KB`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Sticker command error:', error);
        
        // Determine appropriate error message
        let errorMessage = CONSTANTS.MESSAGES.FAILED;
        
        if (error.message.includes('File is too large')) {
            errorMessage = error.message;
        } else if (error.message.includes('FFmpeg is not installed')) {
            errorMessage = CONSTANTS.MESSAGES.FFMPEG_NOT_FOUND;
        } else if (error.message.includes('FFmpeg failed')) {
            errorMessage = '❌ Error processing media with FFmpeg.';
        } else if (error.message.includes('Empty sticker file')) {
            errorMessage = '❌ Sticker creation produced empty file.';
        }
        
        await sock.sendMessage(chatId, 
            { text: errorMessage },
            { quoted: message }
        );
        
    } finally {
        // Cleanup temp files
        try {
            await cleanupFiles(tempInputPath, tempOutputPath);
        } catch (cleanupError) {
            console.warn('⚠️ Cleanup failed:', cleanupError.message);
        }
    }
}

module.exports = stickerCommand;
