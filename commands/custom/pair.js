const axios = require('axios');
const { sleep } = require('../lib/myfunc');

// Constants
const VALIDATION = {
    MIN_LENGTH: 6,
    MAX_LENGTH: 19,
    WHATSAPP_SUFFIX: '@s.whatsapp.net'
};

const ERROR_MESSAGES = {
    NO_NUMBER: "📱 Please provide a valid WhatsApp number\nExample: `.pair 91702395XXXX`\nFor multiple numbers: `.pair 9170XXXXXX,9180XXXXXX`",
    INVALID_NUMBER: "❌ Invalid number format! Please provide valid WhatsApp numbers.",
    NOT_REGISTERED: "❌ That number is not registered on WhatsApp!",
    SERVICE_UNAVAILABLE: "⚠️ Pairing service is currently unavailable. Please try again later.",
    API_ERROR: "⚠️ Failed to generate pairing code. Please try again later.",
    GENERIC_ERROR: "❌ An error occurred. Please try again later.",
    WAITING: "⏳ Generating pairing code, please wait..."
};

const NEWSLETTER_INFO = {
    newsletterJid: '120363161513685998@newsletter',
    newsletterName: 'KnightBot MD',
    serverMessageId: -1
};

/**
 * Extracts and validates phone numbers from input string
 * @param {string} input - User input string
 * @returns {string[]} Array of validated phone numbers
 */
function extractAndValidateNumbers(input) {
    return input.split(',')
        .map(num => num.replace(/[^0-9]/g, ''))
        .filter(num => {
            return num.length >= VALIDATION.MIN_LENGTH && 
                   num.length <= VALIDATION.MAX_LENGTH;
        });
}

/**
 * Sends a message with consistent formatting
 * @param {Object} sock - Socket connection
 * @param {string} chatId - Chat ID
 * @param {string} text - Message text
 * @returns {Promise} Promise of sending message
 */
async function sendFormattedMessage(sock, chatId, text) {
    return sock.sendMessage(chatId, {
        text,
        contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: NEWSLETTER_INFO
        }
    });
}

/**
 * Checks if a number is registered on WhatsApp
 * @param {Object} sock - Socket connection
 * @param {string} phoneNumber - Phone number to check
 * @returns {Promise<boolean>} Whether the number exists
 */
async function checkWhatsAppRegistration(sock, phoneNumber) {
    const whatsappId = phoneNumber + VALIDATION.WHATSAPP_SUFFIX;
    const result = await sock.onWhatsApp(whatsappId);
    return result[0]?.exists || false;
}

/**
 * Fetches pairing code from API
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<string>} Pairing code
 */
async function fetchPairingCode(phoneNumber) {
    const API_URL = `https://knight-bot-paircode.onrender.com/code?number=${phoneNumber}`;
    
    try {
        const response = await axios.get(API_URL, { timeout: 10000 });
        
        if (!response.data || !response.data.code) {
            throw new Error('Invalid API response');
        }
        
        const code = response.data.code;
        
        if (code === "Service Unavailable") {
            throw new Error('SERVICE_UNAVAILABLE');
        }
        
        return code;
    } catch (error) {
        console.error('API Error details:', {
            phoneNumber,
            error: error.message,
            response: error.response?.data
        });
        
        if (error.message === 'SERVICE_UNAVAILABLE') {
            throw new Error('SERVICE_UNAVAILABLE');
        }
        
        if (error.code === 'ECONNABORTED') {
            throw new Error('API_TIMEOUT');
        }
        
        throw new Error('API_FAILURE');
    }
}

/**
 * Processes a single phone number for pairing
 * @param {Object} sock - Socket connection
 * @param {string} chatId - Chat ID
 * @param {string} phoneNumber - Phone number to process
 * @returns {Promise<boolean>} Success status
 */
async function processPhoneNumber(sock, chatId, phoneNumber) {
    console.log(`Processing pairing for: ${phoneNumber}`);
    
    // Check WhatsApp registration
    const isRegistered = await checkWhatsAppRegistration(sock, phoneNumber);
    if (!isRegistered) {
        await sendFormattedMessage(sock, chatId, ERROR_MESSAGES.NOT_REGISTERED);
        return false;
    }
    
    // Send waiting message
    await sendFormattedMessage(sock, chatId, ERROR_MESSAGES.WAITING);
    
    try {
        // Fetch pairing code
        const pairingCode = await fetchPairingCode(phoneNumber);
        
        // Small delay before sending code
        await sleep(2000);
        
        // Send pairing code
        await sendFormattedMessage(
            sock, 
            chatId, 
            `✅ Pairing code for ${phoneNumber}:\n\`\`\`${pairingCode}\`\`\``
        );
        
        console.log(`Successfully generated code for: ${phoneNumber}`);
        return true;
        
    } catch (apiError) {
        console.error(`API error for ${phoneNumber}:`, apiError.message);
        
        const errorMessage = apiError.message === 'SERVICE_UNAVAILABLE'
            ? ERROR_MESSAGES.SERVICE_UNAVAILABLE
            : ERROR_MESSAGES.API_ERROR;
        
        await sendFormattedMessage(sock, chatId, errorMessage);
        return false;
    }
}

/**
 * Main pair command handler
 * @param {Object} sock - Socket connection
 * @param {string} chatId - Chat ID
 * @param {Object} message - Message object
 * @param {string} query - User query containing phone numbers
 */
async function pairCommand(sock, chatId, message, query) {
    try {
        // Input validation
        if (!query || query.trim() === '') {
            return await sendFormattedMessage(sock, chatId, ERROR_MESSAGES.NO_NUMBER);
        }
        
        // Extract and validate numbers
        const phoneNumbers = extractAndValidateNumbers(query);
        
        if (phoneNumbers.length === 0) {
            return await sendFormattedMessage(sock, chatId, ERROR_MESSAGES.INVALID_NUMBER);
        }
        
        console.log(`Pair command initiated for ${phoneNumbers.length} number(s):`, phoneNumbers);
        
        // Process each number
        for (const phoneNumber of phoneNumbers) {
            const success = await processPhoneNumber(sock, chatId, phoneNumber);
            
            // Add delay between processing multiple numbers
            if (phoneNumbers.length > 1 && phoneNumber !== phoneNumbers[phoneNumbers.length - 1]) {
                await sleep(3000);
            }
            
            if (!success && phoneNumbers.length === 1) {
                // Stop if single number fails
                return;
            }
        }
        
    } catch (error) {
        console.error('Unexpected error in pair command:', error);
        
        try {
            await sendFormattedMessage(sock, chatId, ERROR_MESSAGES.GENERIC_ERROR);
        } catch (sendError) {
            console.error('Failed to send error message:', sendError);
        }
    }
}

module.exports = pairCommand;
