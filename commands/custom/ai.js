/**
 * AI Command Handler for Mayonk Bot
 * Supports multiple AI models: GPT, Gemini, Claude, etc.
 * Version: 1.8.7
 */

const axios = require('axios');
const fetch = require('node-fetch');

// Configuration
const AI_CONFIG = {
    // API endpoints with fallbacks
    endpoints: {
        gpt: [
            'https://zellapi.autos/ai/chatbot',
            'https://api.ryzendesu.vip/api/ai/gpt',
            'https://api.siputzx.my.id/api/ai/gpt-3'
        ],
        gemini: [
            'https://api.siputzx.my.id/api/ai/gemini-pro',
            'https://api.ryzendesu.vip/api/ai/gemini',
            'https://vapis.my.id/api/gemini',
            'https://api.giftedtech.my.id/api/ai/geminiai',
            'https://api.giftedtech.my.id/api/ai/geminiaipro'
        ],
        claude: [
            'https://api.ryzendesu.vip/api/ai/claude',
            'https://api.siputzx.my.id/api/ai/claude'
        ],
        llama: [
            'https://api.ryzendesu.vip/api/ai/llama',
            'https://api.siputzx.my.id/api/ai/llama'
        ]
    },
    
    // Rate limiting (per user per command)
    rateLimit: {
        enabled: true,
        windowMs: 60000, // 1 minute
        maxRequests: 10
    },
    
    // Response limits
    maxLength: 4000, // characters
    timeout: 30000, // 30 seconds
};

// Rate limiting storage
const userRequests = new Map();

/**
 * Check rate limit for user
 */
function checkRateLimit(userId, command) {
    if (!AI_CONFIG.rateLimit.enabled) return true;
    
    const now = Date.now();
    const key = `${userId}_${command}`;
    
    if (!userRequests.has(key)) {
        userRequests.set(key, []);
    }
    
    const requests = userRequests.get(key);
    const windowStart = now - AI_CONFIG.rateLimit.windowMs;
    
    // Remove old requests
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= AI_CONFIG.rateLimit.maxRequests) {
        return false;
    }
    
    validRequests.push(now);
    userRequests.set(key, validRequests);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance on each request
        for (const [key, times] of userRequests.entries()) {
            const valid = times.filter(time => Date.now() - time < AI_CONFIG.rateLimit.windowMs * 2);
            if (valid.length === 0) {
                userRequests.delete(key);
            }
        }
    }
    
    return true;
}

/**
 * Extract text from message
 */
function extractText(message) {
    if (message.message?.conversation) {
        return message.message.conversation;
    }
    if (message.message?.extendedTextMessage?.text) {
        return message.message.extendedTextMessage.text;
    }
    if (message.message?.imageMessage?.caption) {
        return message.message.imageMessage.caption;
    }
    return null;
}

/**
 * Call GPT API
 */
async function callGPT(query) {
    const endpoints = AI_CONFIG.endpoints.gpt;
    
    for (const endpoint of endpoints) {
        try {
            const response = await axios.get(`${endpoint}?text=${encodeURIComponent(query)}`, {
                timeout: AI_CONFIG.timeout
            });
            
            if (response.data?.status && response.data?.result) {
                return response.data.result;
            }
            if (response.data?.message) {
                return response.data.message;
            }
            if (response.data?.response) {
                return response.data.response;
            }
        } catch (error) {
            console.log(`GPT endpoint ${endpoint} failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('All GPT endpoints failed');
}

/**
 * Call Gemini API
 */
async function callGemini(query) {
    const endpoints = AI_CONFIG.endpoints.gemini;
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint + (endpoint.includes('?') ? '&' : '?') + 
                (endpoint.includes('q=') ? `q=${encodeURIComponent(query)}` : 
                 endpoint.includes('text=') ? `text=${encodeURIComponent(query)}` :
                 endpoint.includes('content=') ? `content=${encodeURIComponent(query)}` :
                 `query=${encodeURIComponent(query)}`), {
                timeout: AI_CONFIG.timeout
            });
            
            const data = await response.json();
            
            // Check various response formats
            if (data.message) return data.message;
            if (data.data) return data.data;
            if (data.answer) return data.answer;
            if (data.result) return data.result;
            if (data.response) return data.response;
            if (data.text) return data.text;
            if (data.generated_text) return data.generated_text;
            
        } catch (error) {
            console.log(`Gemini endpoint ${endpoint} failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('All Gemini endpoints failed');
}

/**
 * Call Claude API
 */
async function callClaude(query) {
    const endpoints = AI_CONFIG.endpoints.claude;
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`${endpoint}?text=${encodeURIComponent(query)}`, {
                timeout: AI_CONFIG.timeout
            });
            
            const data = await response.json();
            
            if (data.message || data.data || data.answer || data.result) {
                return data.message || data.data || data.answer || data.result;
            }
        } catch (error) {
            console.log(`Claude endpoint ${endpoint} failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('All Claude endpoints failed');
}

/**
 * Call Llama API
 */
async function callLlama(query) {
    const endpoints = AI_CONFIG.endpoints.llama;
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`${endpoint}?text=${encodeURIComponent(query)}`, {
                timeout: AI_CONFIG.timeout
            });
            
            const data = await response.json();
            
            if (data.message || data.data || data.answer || data.result) {
                return data.message || data.data || data.answer || data.result;
            }
        } catch (error) {
            console.log(`Llama endpoint ${endpoint} failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('All Llama endpoints failed');
}

/**
 * Process AI command
 */
async function aiCommand(sock, chatId, message) {
    try {
        // Extract text from message
        const text = extractText(message);
        
        if (!text) {
            return await sendHelpMessage(sock, chatId, message);
        }

        // Parse command and query
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const query = parts.slice(1).join(' ').trim();

        // Validate query
        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a question after the command.\n\nExample: .gpt Write a basic HTML code\n.gemini Explain quantum computing"
            }, { quoted: message });
        }

        // Check query length
        if (query.length > 1000) {
            return await sock.sendMessage(chatId, {
                text: "❌ Query too long. Maximum 1000 characters."
            }, { quoted: message });
        }

        // Get user ID for rate limiting
        const userId = message.key.participant || message.key.remoteJid;
        
        // Check rate limit
        if (!checkRateLimit(userId, command)) {
            return await sock.sendMessage(chatId, {
                text: "⏳ Please wait a moment before making another AI request. Rate limit exceeded."
            }, { quoted: message });
        }

        // Show processing indicator
        await showProcessing(sock, chatId, message);

        let response;
        
        // Handle different AI commands
        switch (command) {
            case '.gpt':
                response = await callGPT(query);
                break;
                
            case '.gemini':
                response = await callGemini(query);
                break;
                
            case '.claude':
                response = await callClaude(query);
                break;
                
            case '.llama':
                response = await callLlama(query);
                break;
                
            case '.deepseek':
            case '.ai':
                // Try multiple AI models
                try {
                    response = await callGPT(query);
                } catch (error) {
                    response = await callGemini(query);
                }
                break;
                
            default:
                return await sendHelpMessage(sock, chatId, message);
        }

        // Process and send response
        await sendResponse(sock, chatId, message, response);

    } catch (error) {
        console.error('AI Command Error:', error);
        await handleError(sock, chatId, message, error);
    }
}

/**
 * Show processing indicator
 */
async function showProcessing(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '🤖', key: message.key }
        });
        
        // Optional: Send typing indicator
        await sock.sendPresenceUpdate('composing', chatId);
        
    } catch (error) {
        console.log('Failed to show processing indicator:', error.message);
    }
}

/**
 * Send help message
 */
async function sendHelpMessage(sock, chatId, message) {
    const helpText = `🤖 *AI Commands* 🤖

*Available Models:*
• .gpt [question] - GPT-4/GPT-3.5
• .gemini [question] - Google Gemini
• .claude [question] - Anthropic Claude
• .llama [question] - Meta Llama
• .ai [question] - Auto-select best model
• .deepseek [question] - DeepSeek AI

*Examples:*
• .gpt Write a Python function to calculate factorial
• .gemini Explain quantum computing in simple terms
• .claude Help me plan a healthy meal for the week
• .ai What is machine learning?

*Tips:*
• Be specific with your questions
• Limit queries to 1000 characters
• Use .ai for general questions
• Rate limit: 10 requests per minute`;

    return await sock.sendMessage(chatId, {
        text: helpText
    }, { quoted: message });
}

/**
 * Send formatted response
 */
async function sendResponse(sock, chatId, message, response) {
    try {
        // Clean and truncate response if needed
        let cleanedResponse = response.toString().trim();
        
        if (cleanedResponse.length > AI_CONFIG.maxLength) {
            cleanedResponse = cleanedResponse.substring(0, AI_CONFIG.maxLength - 100) + 
                             "\n\n... (response truncated due to length)";
        }
        
        // Format code blocks if present
        if (cleanedResponse.includes('```')) {
            // Already formatted
        } else if (cleanedResponse.includes('function') || cleanedResponse.includes('def ') || 
                   cleanedResponse.includes('class ') || cleanedResponse.includes('import ')) {
            // Likely code, wrap in code block
            cleanedResponse = '```' + cleanedResponse + '```';
        }
        
        // Send response
        await sock.sendMessage(chatId, {
            text: cleanedResponse
        }, { quoted: message });
        
        // Stop typing indicator
        await sock.sendPresenceUpdate('paused', chatId);
        
    } catch (error) {
        console.error('Error sending response:', error);
        throw error;
    }
}

/**
 * Handle errors
 */
async function handleError(sock, chatId, message, error) {
    console.error('AI Error Details:', {
        error: error.message,
        stack: error.stack,
        chatId,
        timestamp: new Date().toISOString()
    });

    const errorMessages = [
        "❌ Failed to get AI response. Please try again in a moment.",
        "🤖 AI service is currently busy. Try again shortly.",
        "⚠️ Unable to process your request. The AI service might be down.",
        "🔧 Technical difficulty. Please try a different AI model."
    ];

    const randomError = errorMessages[Math.floor(Math.random() * errorMessages.length)];
    
    try {
        await sock.sendMessage(chatId, {
            text: `${randomError}\n\nError: ${error.message.substring(0, 100)}`,
            contextInfo: {
                mentionedJid: [message.key.participant || message.key.remoteJid],
                quotedMessage: message.message
            }
        }, { quoted: message });
        
        // Stop typing indicator if it's still on
        await sock.sendPresenceUpdate('paused', chatId);
        
    } catch (sendError) {
        console.error('Failed to send error message:', sendError);
    }
}

/**
 * Cleanup function for rate limiting
 */
function cleanupRateLimits() {
    const now = Date.now();
    const cutoff = now - (AI_CONFIG.rateLimit.windowMs * 2);
    
    for (const [key, times] of userRequests.entries()) {
        const validTimes = times.filter(time => time > cutoff);
        if (validTimes.length === 0) {
            userRequests.delete(key);
        } else {
            userRequests.set(key, validTimes);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

module.exports = {
    aiCommand,
    // Export for testing
    checkRateLimit,
    extractText,
    callGPT,
    callGemini
};
