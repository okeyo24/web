const gTTS = require('gtts');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Constants
const CONSTANTS = {
    PATHS: {
        ASSETS: path.join(__dirname, '..', 'assets', 'tts'),
        TEMP: path.join(__dirname, '..', 'temp')
    },
    LANGUAGES: {
        'af': 'Afrikaans', 'sq': 'Albanian', 'ar': 'Arabic', 'hy': 'Armenian',
        'bn': 'Bengali', 'bs': 'Bosnian', 'ca': 'Catalan', 'zh': 'Chinese',
        'zh-cn': 'Chinese (China)', 'zh-tw': 'Chinese (Taiwan)', 'hr': 'Croatian',
        'cs': 'Czech', 'da': 'Danish', 'nl': 'Dutch', 'en': 'English',
        'en-us': 'English (US)', 'en-uk': 'English (UK)', 'en-au': 'English (Australia)',
        'eo': 'Esperanto', 'et': 'Estonian', 'tl': 'Filipino', 'fi': 'Finnish',
        'fr': 'French', 'de': 'German', 'el': 'Greek', 'gu': 'Gujarati',
        'hi': 'Hindi', 'hu': 'Hungarian', 'is': 'Icelandic', 'id': 'Indonesian',
        'it': 'Italian', 'ja': 'Japanese', 'jw': 'Javanese', 'kn': 'Kannada',
        'km': 'Khmer', 'ko': 'Korean', 'la': 'Latin', 'lv': 'Latvian',
        'lt': 'Lithuanian', 'mk': 'Macedonian', 'ml': 'Malayalam', 'ms': 'Malay',
        'mr': 'Marathi', 'my': 'Myanmar', 'ne': 'Nepali', 'no': 'Norwegian',
        'pl': 'Polish', 'pt': 'Portuguese', 'pt-br': 'Portuguese (Brazil)',
        'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian', 'si': 'Sinhala',
        'sk': 'Slovak', 'es': 'Spanish', 'es-us': 'Spanish (US)', 'es-es': 'Spanish (Spain)',
        'su': 'Sundanese', 'sw': 'Swahili', 'sv': 'Swedish', 'ta': 'Tamil',
        'te': 'Telugu', 'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian',
        'ur': 'Urdu', 'vi': 'Vietnamese', 'cy': 'Welsh'
    },
    VALIDATION: {
        MAX_TEXT_LENGTH: 500,
        MIN_TEXT_LENGTH: 1,
        SUPPORTED_AUDIO_FORMATS: ['mp3', 'wav', 'ogg'],
        DEFAULT_LANGUAGE: 'en',
        DEFAULT_SPEECH_RATE: 1.0
    },
    MESSAGES: {
        NO_TEXT: `🎤 *Text-to-Speech*\n\nPlease provide text for TTS conversion.\n\n*Usage:*\n\`.tts <text>\`\n\`.tts <text> <language>\`\n\n*Examples:*\n• \`.tts Hello world\`\n• \`.tts Bonjour fr\`\n• \`.tts Hola es\`\n\n*Available Languages:* \`.tts langs\``,
        TEXT_TOO_LONG: `❌ Text is too long (max ${CONSTANTS.VALIDATION.MAX_TEXT_LENGTH} characters)`,
        TEXT_TOO_SHORT: `❌ Please provide some text`,
        INVALID_LANGUAGE: (lang) => `❌ Invalid language code "${lang}". Use \`.tts langs\` to see all languages.`,
        GENERATION_ERROR: '❌ Error generating audio. Please try again.',
        SENDING_ERROR: '❌ Error sending audio. Please try again.',
        CLEANUP_ERROR: '❌ Error cleaning up temporary files.',
        LANGUAGE_LIST: (languages) => `🌍 *Available Languages*\n\n${languages}\n\n*Usage:* \`.tts Hello en\``,
        SUCCESS: (language) => `✅ Audio generated in ${CONSTANTS.LANGUAGES[language] || language}`,
        PROCESSING: '🔊 Processing text-to-speech...'
    }
};

/**
 * Ensure directories exist
 */
async function ensureDirectories() {
    const directories = [
        CONSTANTS.PATHS.ASSETS,
        CONSTANTS.PATHS.TEMP
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
function generateFileName(extension = 'mp3') {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString('hex');
    return `tts_${timestamp}_${randomId}.${extension}`;
}

/**
 * Validate text input
 */
function validateText(text) {
    if (!text || text.trim().length === 0) {
        throw new Error('EMPTY_TEXT');
    }
    
    const trimmedText = text.trim();
    
    if (trimmedText.length > CONSTANTS.VALIDATION.MAX_TEXT_LENGTH) {
        throw new Error('TEXT_TOO_LONG');
    }
    
    if (trimmedText.length < CONSTANTS.VALIDATION.MIN_TEXT_LENGTH) {
        throw new Error('TEXT_TOO_SHORT');
    }
    
    return trimmedText;
}

/**
 * Validate language code
 */
function validateLanguage(language) {
    const normalizedLang = language.toLowerCase();
    
    // Check if language exists in supported languages
    const supportedLang = Object.keys(CONSTANTS.LANGUAGES).find(lang => 
        lang.toLowerCase() === normalizedLang
    );
    
    return supportedLang || CONSTANTS.VALIDATION.DEFAULT_LANGUAGE;
}

/**
 * Parse language and text from input
 */
function parseInput(input) {
    if (!input) {
        return { text: null, language: CONSTANTS.VALIDATION.DEFAULT_LANGUAGE };
    }
    
    const parts = input.trim().split(' ');
    
    // Check if last part is a language code
    const lastPart = parts[parts.length - 1].toLowerCase();
    let language = CONSTANTS.VALIDATION.DEFAULT_LANGUAGE;
    let text = input;
    
    // Try to detect language from input
    if (parts.length > 1) {
        const possibleLang = validateLanguage(lastPart);
        if (possibleLang !== CONSTANTS.VALIDATION.DEFAULT_LANGUAGE || 
            Object.keys(CONSTANTS.LANGUAGES).includes(lastPart)) {
            language = possibleLang;
            text = parts.slice(0, -1).join(' ');
        }
    }
    
    return { text, language };
}

/**
 * Generate audio using gTTS
 */
async function generateAudio(text, language, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const gtts = new gTTS(text, language);
            
            gtts.save(outputPath, (error) => {
                if (error) {
                    console.error('❌ gTTS generation error:', error);
                    reject(new Error(CONSTANTS.MESSAGES.GENERATION_ERROR));
                    return;
                }
                
                resolve(outputPath);
            });
            
        } catch (error) {
            console.error('❌ gTTS initialization error:', error);
            reject(new Error(CONSTANTS.MESSAGES.GENERATION_ERROR));
        }
    });
}

/**
 * Format language list for display
 */
function formatLanguageList() {
    const languages = Object.entries(CONSTANTS.LANGUAGES)
        .map(([code, name]) => `• ${code} - ${name}`)
        .join('\n');
    
    return languages;
}

/**
 * Clean up temporary files
 */
async function cleanupFile(filePath) {
    try {
        await fs.unlink(filePath);
        console.log(`🧹 Cleaned up: ${path.basename(filePath)}`);
    } catch (error) {
        console.warn(`⚠️ Could not delete file ${filePath}:`, error.message);
    }
}

/**
 * Check file size
 */
async function getFileSize(filePath) {
    try {
        const stats = await fs.stat(filePath);
        const sizeInKB = (stats.size / 1024).toFixed(2);
        return `${sizeInKB} KB`;
    } catch (error) {
        return 'Unknown';
    }
}

/**
 * Main TTS command handler
 */
async function ttsCommand(sock, chatId, input, message) {
    try {
        // Ensure directories exist
        await ensureDirectories();
        
        // Check for language list command
        if (input?.toLowerCase() === 'langs' || input?.toLowerCase() === 'languages') {
            const languages = formatLanguageList();
            return await sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.LANGUAGE_LIST(languages)
            }, { quoted: message });
        }
        
        // Parse input
        const { text, language } = parseInput(input);
        
        // Validate text
        let validatedText;
        try {
            validatedText = validateText(text);
        } catch (error) {
            if (error.message === 'EMPTY_TEXT') {
                return await sock.sendMessage(chatId, {
                    text: CONSTANTS.MESSAGES.NO_TEXT
                }, { quoted: message });
            } else if (error.message === 'TEXT_TOO_LONG') {
                return await sock.sendMessage(chatId, {
                    text: CONSTANTS.MESSAGES.TEXT_TOO_LONG
                }, { quoted: message });
            } else if (error.message === 'TEXT_TOO_SHORT') {
                return await sock.sendMessage(chatId, {
                    text: CONSTANTS.MESSAGES.TEXT_TOO_SHORT
                }, { quoted: message });
            }
            throw error;
        }
        
        // Validate language
        const validatedLanguage = validateLanguage(language);
        
        // Send processing message
        await sock.sendMessage(chatId, {
            text: CONSTANTS.MESSAGES.PROCESSING
        }, { quoted: message });
        
        // Generate unique filename
        const fileName = generateFileName();
        const filePath = path.join(CONSTANTS.PATHS.TEMP, fileName);
        
        // Generate audio
        try {
            await generateAudio(validatedText, validatedLanguage, filePath);
        } catch (error) {
            return await sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.GENERATION_ERROR
            }, { quoted: message });
        }
        
        // Check if file was created
        let fileExists = false;
        try {
            await fs.access(filePath);
            fileExists = true;
        } catch {
            fileExists = false;
        }
        
        if (!fileExists) {
            throw new Error('Audio file not created');
        }
        
        // Get file size for logging
        const fileSize = await getFileSize(filePath);
        
        // Send audio message
        try {
            await sock.sendMessage(chatId, {
                audio: { url: filePath },
                mimetype: 'audio/mpeg',
                fileName: `tts_${validatedLanguage}.mp3`,
                contextInfo: {
                    mentionedJid: [message.key.participant || message.key.remoteJid]
                }
            }, { quoted: message });
            
            // Send success message
            await sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.SUCCESS(validatedLanguage)
            });
            
            // Log successful generation
            console.log('✅ TTS generated:', {
                chatId: chatId.slice(0, 10) + '...',
                textLength: validatedText.length,
                language: validatedLanguage,
                fileSize: fileSize,
                timestamp: new Date().toISOString()
            });
            
        } catch (sendError) {
            console.error('❌ Error sending audio:', sendError);
            await sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.SENDING_ERROR
            }, { quoted: message });
        }
        
        // Clean up file (with delay to ensure sending is complete)
        setTimeout(() => {
            cleanupFile(filePath).catch(console.error);
        }, 30000); // Clean up after 30 seconds
        
    } catch (error) {
        console.error('❌ TTS command error:', error);
        
        // Don't send generic error for validation errors (already handled)
        if (!error.message.startsWith('❌')) {
            await sock.sendMessage(chatId, {
                text: '❌ An error occurred. Please try again.'
            }, { quoted: message });
        }
    }
}

module.exports = ttsCommand;
