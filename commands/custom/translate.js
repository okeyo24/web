const fetch = require('node-fetch');

// Constants
const CONSTANTS = {
    TRANSLATION_APIS: [
        {
            name: 'Google Translate',
            url: (text, lang) => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`,
            parser: async (response) => {
                const data = await response.json();
                return data?.[0]?.[0]?.[0] || null;
            }
        },
        {
            name: 'MyMemory',
            url: (text, lang) => `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${lang}`,
            parser: async (response) => {
                const data = await response.json();
                return data?.responseData?.translatedText || null;
            }
        },
        {
            name: 'Dreaded Translate',
            url: (text, lang) => `https://api.dreaded.site/api/translate?text=${encodeURIComponent(text)}&lang=${lang}`,
            parser: async (response) => {
                const data = await response.json();
                return data?.translated || null;
            }
        }
    ],
    LANGUAGE_CODES: {
        'af': 'Afrikaans', 'sq': 'Albanian', 'am': 'Amharic', 'ar': 'Arabic',
        'hy': 'Armenian', 'az': 'Azerbaijani', 'eu': 'Basque', 'be': 'Belarusian',
        'bn': 'Bengali', 'bs': 'Bosnian', 'bg': 'Bulgarian', 'ca': 'Catalan',
        'ceb': 'Cebuano', 'ny': 'Chichewa', 'zh': 'Chinese', 'zh-cn': 'Chinese (Simplified)',
        'zh-tw': 'Chinese (Traditional)', 'co': 'Corsican', 'hr': 'Croatian',
        'cs': 'Czech', 'da': 'Danish', 'nl': 'Dutch', 'en': 'English',
        'eo': 'Esperanto', 'et': 'Estonian', 'tl': 'Filipino', 'fi': 'Finnish',
        'fr': 'French', 'fy': 'Frisian', 'gl': 'Galician', 'ka': 'Georgian',
        'de': 'German', 'el': 'Greek', 'gu': 'Gujarati', 'ht': 'Haitian Creole',
        'ha': 'Hausa', 'haw': 'Hawaiian', 'he': 'Hebrew', 'hi': 'Hindi',
        'hmn': 'Hmong', 'hu': 'Hungarian', 'is': 'Icelandic', 'ig': 'Igbo',
        'id': 'Indonesian', 'ga': 'Irish', 'it': 'Italian', 'ja': 'Japanese',
        'jw': 'Javanese', 'kn': 'Kannada', 'kk': 'Kazakh', 'km': 'Khmer',
        'ko': 'Korean', 'ku': 'Kurdish', 'ky': 'Kyrgyz', 'lo': 'Lao',
        'la': 'Latin', 'lv': 'Latvian', 'lt': 'Lithuanian', 'lb': 'Luxembourgish',
        'mk': 'Macedonian', 'mg': 'Malagasy', 'ms': 'Malay', 'ml': 'Malayalam',
        'mt': 'Maltese', 'mi': 'Maori', 'mr': 'Marathi', 'mn': 'Mongolian',
        'my': 'Myanmar (Burmese)', 'ne': 'Nepali', 'no': 'Norwegian',
        'ps': 'Pashto', 'fa': 'Persian', 'pl': 'Polish', 'pt': 'Portuguese',
        'pa': 'Punjabi', 'ro': 'Romanian', 'ru': 'Russian', 'sm': 'Samoan',
        'gd': 'Scots Gaelic', 'sr': 'Serbian', 'st': 'Sesotho', 'sn': 'Shona',
        'sd': 'Sindhi', 'si': 'Sinhala', 'sk': 'Slovak', 'sl': 'Slovenian',
        'so': 'Somali', 'es': 'Spanish', 'su': 'Sundanese', 'sw': 'Swahili',
        'sv': 'Swedish', 'tg': 'Tajik', 'ta': 'Tamil', 'te': 'Telugu',
        'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian', 'ur': 'Urdu',
        'uz': 'Uzbek', 'vi': 'Vietnamese', 'cy': 'Welsh', 'xh': 'Xhosa',
        'yi': 'Yiddish', 'yo': 'Yoruba', 'zu': 'Zulu'
    },
    MESSAGES: {
        USAGE: `🌐 *TRANSLATOR BOT*\n\n` +
               `*Usage:*\n` +
               `1. Reply to a message with:\n   \`.translate <lang>\` or \`.trt <lang>\`\n\n` +
               `2. Or type directly:\n   \`.translate <text> <lang>\` or \`.trt <text> <lang>\`\n\n` +
               `*Examples:*\n` +
               `• Reply to "hello" with: \`.translate fr\`\n` +
               `• Type: \`.translate how are you es\`\n\n` +
               `*Popular Language Codes:*\n` +
               `🇫🇷 fr - French        🇪🇸 es - Spanish\n` +
               `🇩🇪 de - German        🇮🇹 it - Italian\n` +
               `🇵🇹 pt - Portuguese    🇷🇺 ru - Russian\n` +
               `🇯🇵 ja - Japanese      🇰🇷 ko - Korean\n` +
               `🇨🇳 zh - Chinese       🇸🇦 ar - Arabic\n` +
               `🇮🇳 hi - Hindi         🇹🇷 tr - Turkish\n\n` +
               `*Tip:* Use \`.translate codes\` to see all language codes.`,
        NO_TEXT: '❌ No text found to translate. Please provide text or reply to a message.',
        INVALID_LANG: (lang) => `❌ Invalid language code "${lang}". Use \`.translate codes\` to see all available codes.`,
        ALL_APIS_FAILED: '❌ Translation service unavailable. Please try again later.',
        CODES_LIST: (codes) => `📚 *Available Language Codes*\n\n${codes}\n\n*Example:* \`.translate hello es\``,
        TRANSLATION_RESULT: (original, translated, sourceLang, targetLang) => 
            `🌐 *Translation Complete*\n\n` +
            `*From:* ${sourceLang} (${CONSTANTS.LANGUAGE_CODES[sourceLang] || 'Auto-detected'})\n` +
            `*To:* ${targetLang} (${CONSTANTS.LANGUAGE_CODES[targetLang] || targetLang})\n\n` +
            `*Original:*\n${original}\n\n` +
            `*Translated:*\n${translated}`
    }
};

/**
 * Show typing indicator
 */
async function showTypingIndicator(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        console.warn('⚠️ Typing indicator failed:', error.message);
    }
}

/**
 * Extract text from various message types
 */
function extractMessageText(message) {
    if (!message) return '';
    
    const messageTypes = [
        'conversation',
        'extendedTextMessage.text',
        'imageMessage.caption',
        'videoMessage.caption',
        'documentMessage.caption'
    ];
    
    for (const type of messageTypes) {
        const parts = type.split('.');
        let value = message;
        
        for (const part of parts) {
            value = value?.[part];
            if (!value) break;
        }
        
        if (value && typeof value === 'string') {
            return value.trim();
        }
    }
    
    return '';
}

/**
 * Parse command arguments
 */
function parseCommandArguments(match, quotedMessage) {
    const args = match.trim().split(' ');
    
    // Handle special "codes" command
    if (args[0] === 'codes') {
        return { command: 'codes' };
    }
    
    let textToTranslate = '';
    let lang = '';
    
    if (quotedMessage) {
        // Mode 1: Reply to message with language code
        textToTranslate = extractMessageText(quotedMessage);
        lang = args[0] || '';
    } else {
        // Mode 2: Direct text and language code
        if (args.length < 2) {
            return { error: 'INSUFFICIENT_ARGS' };
        }
        
        lang = args.pop(); // Last argument is language code
        textToTranslate = args.join(' '); // Everything else is text
    }
    
    return { textToTranslate, lang };
}

/**
 * Validate language code
 */
function isValidLanguageCode(code) {
    if (!code) return false;
    
    // Special case for Chinese variations
    if (code.toLowerCase() === 'zh-cn' || code.toLowerCase() === 'zh-tw') {
        return true;
    }
    
    // Check if it's a valid 2-3 letter language code
    return Object.keys(CONSTANTS.LANGUAGE_CODES).some(lang => 
        lang.toLowerCase() === code.toLowerCase()
    );
}

/**
 * Format language codes for display
 */
function formatLanguageCodes() {
    const codes = Object.entries(CONSTANTS.LANGUAGE_CODES);
    const chunks = [];
    
    // Create chunks of 5 languages each for better formatting
    for (let i = 0; i < codes.length; i += 5) {
        const chunk = codes.slice(i, i + 5);
        const chunkText = chunk.map(([code, name]) => 
            `• ${code} - ${name}`
        ).join('\n');
        chunks.push(chunkText);
    }
    
    return chunks.join('\n\n');
}

/**
 * Attempt translation using multiple APIs
 */
async function attemptTranslation(text, targetLang) {
    const errors = [];
    
    for (const api of CONSTANTS.TRANSLATION_APIS) {
        try {
            console.log(`Attempting translation via ${api.name}...`);
            
            const response = await fetch(api.url(text, targetLang), { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (WhatsApp-Bot)'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }
            
            const translatedText = await api.parser(response);
            
            if (translatedText) {
                console.log(`✅ Translation successful via ${api.name}`);
                return {
                    text: translatedText,
                    source: api.name,
                    detectedLang: 'auto' // Could be enhanced with actual detection
                };
            }
            
            throw new Error('No translation in response');
            
        } catch (error) {
            console.warn(`❌ ${api.name} failed:`, error.message);
            errors.push({ api: api.name, error: error.message });
        }
    }
    
    console.error('All translation APIs failed:', errors);
    return null;
}

/**
 * Main translate command handler
 */
async function handleTranslateCommand(sock, chatId, message, match) {
    try {
        // Show typing indicator
        await showTypingIndicator(sock, chatId);
        
        // Check if user wants language codes
        if (match.trim().toLowerCase() === 'codes') {
            const codesList = formatLanguageCodes();
            return sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.CODES_LIST(codesList),
                quoted: message
            });
        }
        
        // Parse command arguments
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const parsed = parseCommandArguments(match, quotedMessage);
        
        if (parsed.error === 'INSUFFICIENT_ARGS') {
            return sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.USAGE,
                quoted: message
            });
        }
        
        if (parsed.command === 'codes') {
            const codesList = formatLanguageCodes();
            return sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.CODES_LIST(codesList),
                quoted: message
            });
        }
        
        const { textToTranslate, lang } = parsed;
        
        // Validate input
        if (!textToTranslate) {
            return sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.NO_TEXT,
                quoted: message
            });
        }
        
        if (!isValidLanguageCode(lang)) {
            return sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.INVALID_LANG(lang),
                quoted: message
            });
        }
        
        // Show translating status
        await sock.sendMessage(chatId, {
            text: `🔄 Translating to ${CONSTANTS.LANGUAGE_CODES[lang] || lang}...`,
            quoted: message
        });
        
        // Attempt translation
        const translationResult = await attemptTranslation(textToTranslate, lang);
        
        if (!translationResult) {
            throw new Error(CONSTANTS.MESSAGES.ALL_APIS_FAILED);
        }
        
        // Send translation result
        await sock.sendMessage(chatId, {
            text: CONSTANTS.MESSAGES.TRANSLATION_RESULT(
                textToTranslate,
                translationResult.text,
                translationResult.detectedLang,
                lang
            ),
            quoted: message
        });
        
        // Log successful translation
        console.log('✅ Translation completed:', {
            originalLength: textToTranslate.length,
            targetLang: lang,
            sourceApi: translationResult.source,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Translate command error:', error);
        
        const errorMessage = error.message === CONSTANTS.MESSAGES.ALL_APIS_FAILED
            ? CONSTANTS.MESSAGES.ALL_APIS_FAILED
            : '❌ An error occurred. Please try again.';
        
        await sock.sendMessage(chatId, {
            text: errorMessage,
            quoted: message
        });
    }
}

module.exports = {
    handleTranslateCommand
};
