const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const webp = require('node-webpmux');
const crypto = require('crypto');
const settings = require('../settings');

const exec = promisify(require('child_process').exec);

// Configuration constants
const CONFIG = {
    BOT_TOKEN: '7801479976:AAGuPL0a7kXXBYz6XUSR_ll2SR5V_W6oHl4',
    TELEGRAM_API: 'https://api.telegram.org/bot',
    STICKER_SIZE: 512,
    QUALITY: 75,
    COMPRESSION_LEVEL: 6,
    DELAY_BETWEEN_STICKERS: 1000, // ms
    TEMP_DIR: path.join(process.cwd(), 'tmp'),
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000 // ms
};

class TelegramStickerService {
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

    async fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0',
                        ...options.headers
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                if (i === retries - 1) throw error;
                await this.delay(CONFIG.RETRY_DELAY * (i + 1));
            }
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getStickerPackInfo(packName) {
        const url = `${CONFIG.TELEGRAM_API}${CONFIG.BOT_TOKEN}/getStickerSet?name=${encodeURIComponent(packName)}`;
        const result = await this.fetchWithRetry(url);
        
        if (!result.ok || !result.result) {
            throw new Error('Invalid sticker pack or API response');
        }
        
        return result.result;
    }

    async getFileInfo(fileId) {
        const url = `${CONFIG.TELEGRAM_API}${CONFIG.BOT_TOKEN}/getFile?file_id=${fileId}`;
        const result = await this.fetchWithRetry(url);
        
        if (!result.ok || !result.result) {
            throw new Error('Failed to get file info');
        }
        
        return result.result;
    }

    async downloadStickerFile(filePath) {
        const url = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${filePath}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to download file: HTTP ${response.status}`);
        }
        
        return Buffer.from(await response.arrayBuffer());
    }

    async convertToWhatsAppFormat(stickerBuffer, isAnimated, emoji = '🤖') {
        const tempInput = this.generateTempPath('input');
        const tempOutput = this.generateTempPath('output', '.webp');
        
        try {
            // Write input buffer to temp file
            fs.writeFileSync(tempInput, stickerBuffer);
            
            // Build ffmpeg command based on sticker type
            let ffmpegCommand;
            
            if (isAnimated) {
                // For animated stickers (WEBM/ANIMATED WEBP)
                ffmpegCommand = `ffmpeg -i "${tempInput}" ` +
                    `-vf "scale=${CONFIG.STICKER_SIZE}:${CONFIG.STICKER_SIZE}:force_original_aspect_ratio=decrease,` +
                    `fps=15,pad=${CONFIG.STICKER_SIZE}:${CONFIG.STICKER_SIZE}:` +
                    `(ow-iw)/2:(oh-ih)/2:color=#00000000" ` +
                    `-c:v libwebp -preset default -loop 0 -vsync 0 ` +
                    `-pix_fmt yuva420p -quality ${CONFIG.QUALITY} ` +
                    `-compression_level ${CONFIG.COMPRESSION_LEVEL} -y "${tempOutput}"`;
            } else {
                // For static stickers (PNG/WEBP)
                ffmpegCommand = `ffmpeg -i "${tempInput}" ` +
                    `-vf "scale=${CONFIG.STICKER_SIZE}:${CONFIG.STICKER_SIZE}:force_original_aspect_ratio=decrease,` +
                    `format=rgba,pad=${CONFIG.STICKER_SIZE}:${CONFIG.STICKER_SIZE}:` +
                    `(ow-iw)/2:(oh-ih)/2:color=#00000000" ` +
                    `-c:v libwebp -preset default -loop 0 -vsync 0 ` +
                    `-pix_fmt yuva420p -quality ${CONFIG.QUALITY} ` +
                    `-compression_level ${CONFIG.COMPRESSION_LEVEL} -y "${tempOutput}"`;
            }
            
            // Execute conversion
            await exec(ffmpegCommand);
            
            // Verify output
            if (!fs.existsSync(tempOutput)) {
                throw new Error('FFmpeg failed to create output file');
            }
            
            const outputStats = fs.statSync(tempOutput);
            if (outputStats.size === 0) {
                throw new Error('FFmpeg created empty output file');
            }
            
            // Read converted file
            const webpBuffer = fs.readFileSync(tempOutput);
            
            // Add metadata
            const finalBuffer = await this.addMetadata(webpBuffer, emoji);
            
            return finalBuffer;
            
        } finally {
            // Cleanup temp files
            this.cleanupFile(tempInput);
            this.cleanupFile(tempOutput);
        }
    }

    async addMetadata(webpBuffer, emoji) {
        try {
            const img = new webp.Image();
            await img.load(webpBuffer);
            
            // Create metadata
            const metadata = {
                'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
                'sticker-pack-name': settings.packname || 'Telegram Stickers',
                'emojis': [emoji || '🤖']
            };
            
            // Create EXIF buffer for WhatsApp metadata
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

    extractPackNameFromUrl(url) {
        const match = url.match(/https:\/\/t\.me\/addstickers\/(.+)/i);
        return match ? match[1] : null;
    }

    validateTelegramUrl(url) {
        return /^https:\/\/t\.me\/addstickers\/.+$/i.test(url);
    }

    extractMessageText(msg) {
        return msg.message?.conversation?.trim() || 
               msg.message?.extendedTextMessage?.text?.trim() || '';
    }
}

async function stickerTelegramCommand(sock, chatId, msg) {
    const service = new TelegramStickerService();
    
    try {
        // Extract message text
        const text = service.extractMessageText(msg);
        const args = text.split(' ').slice(1);
        
        // Validate input
        if (!args[0]) {
            await sock.sendMessage(chatId, { 
                text: '⚠️ Please provide a Telegram sticker URL!\n\nExample: .tg https://t.me/addstickers/Porcientoreal' 
            });
            return;
        }
        
        const url = args[0].trim();
        
        if (!service.validateTelegramUrl(url)) {
            await sock.sendMessage(chatId, { 
                text: '❌ Invalid URL format! Please provide a valid Telegram sticker pack URL.\nFormat: https://t.me/addstickers/PackName' 
            });
            return;
        }
        
        // Extract pack name
        const packName = service.extractPackNameFromUrl(url);
        if (!packName) {
            await sock.sendMessage(chatId, { 
                text: '❌ Could not extract sticker pack name from URL.' 
            });
            return;
        }
        
        // Get sticker pack info
        await sock.sendMessage(chatId, { 
            text: '📡 Fetching sticker pack information...' 
        });
        
        const stickerSet = await service.getStickerPackInfo(packName);
        const stickerCount = stickerSet.stickers.length;
        
        // Send initial status
        await sock.sendMessage(chatId, { 
            text: `📦 Sticker Pack: ${stickerSet.title || 'Unknown'}\n✨ Found ${stickerCount} stickers\n⏳ Starting download...` 
        });
        
        // Process each sticker
        let successCount = 0;
        let failedCount = 0;
        
        for (let i = 0; i < stickerCount; i++) {
            const sticker = stickerSet.stickers[i];
            
            try {
                // Show progress
                const progress = Math.round(((i + 1) / stickerCount) * 100);
                
                // Get file info
                const fileInfo = await service.getFileInfo(sticker.file_id);
                
                if (!fileInfo.file_path) {
                    console.warn(`Skipping sticker ${i + 1}: No file path`);
                    failedCount++;
                    continue;
                }
                
                // Download sticker
                const stickerBuffer = await service.downloadStickerFile(fileInfo.file_path);
                
                // Convert to WhatsApp format
                const isAnimated = sticker.is_animated || sticker.is_video;
                const emoji = sticker.emoji || '🤖';
                
                const whatsappBuffer = await service.convertToWhatsAppFormat(
                    stickerBuffer, 
                    isAnimated, 
                    emoji
                );
                
                // Send sticker
                await sock.sendMessage(chatId, { 
                    sticker: whatsappBuffer 
                });
                
                successCount++;
                
                // Delay between stickers to avoid rate limiting
                if (i < stickerCount - 1) {
                    await service.delay(CONFIG.DELAY_BETWEEN_STICKERS);
                }
                
            } catch (error) {
                console.error(`Error processing sticker ${i + 1}:`, error);
                failedCount++;
                continue;
            }
        }
        
        // Send completion message
        const summary = `✅ Download Complete!\n\n` +
                       `📊 Summary:\n` +
                       `• Total stickers: ${stickerCount}\n` +
                       `• Successfully sent: ${successCount}\n` +
                       `• Failed: ${failedCount}\n` +
                       `• Success rate: ${Math.round((successCount / stickerCount) * 100)}%`;
        
        await sock.sendMessage(chatId, { 
            text: summary 
        });
        
    } catch (error) {
        console.error('Error in stickerTelegram command:', error);
        
        let errorMessage = '❌ Failed to process Telegram stickers!\n\n';
        
        if (error.message.includes('HTTP') || error.message.includes('Failed to fetch')) {
            errorMessage += 'Network error. Please check:\n';
            errorMessage += '• Your internet connection\n';
            errorMessage += '• Telegram API availability\n';
        } else if (error.message.includes('Invalid sticker pack')) {
            errorMessage += 'Sticker pack not found. Please check:\n';
            errorMessage += '• The URL is correct\n';
            errorMessage += '• The sticker pack exists\n';
            errorMessage += '• The sticker pack is public\n';
        } else {
            errorMessage += 'Unknown error occurred.\n';
            errorMessage += 'Error: ' + error.message;
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        });
    }
}

module.exports = stickerTelegramCommand;
