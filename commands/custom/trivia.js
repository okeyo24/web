const axios = require('axios');

// Constants
const CONSTANTS = {
    TRIVIA_API_URL: 'https://opentdb.com/api.php',
    DIFFICULTIES: ['easy', 'medium', 'hard'],
    CATEGORIES: {
        9: "General Knowledge",
        10: "Entertainment: Books",
        11: "Entertainment: Film",
        12: "Entertainment: Music",
        13: "Entertainment: Musicals & Theatres",
        14: "Entertainment: Television",
        15: "Entertainment: Video Games",
        16: "Entertainment: Board Games",
        17: "Science & Nature",
        18: "Science: Computers",
        19: "Science: Mathematics",
        20: "Mythology",
        21: "Sports",
        22: "Geography",
        23: "History",
        24: "Politics",
        25: "Art",
        26: "Celebrities",
        27: "Animals",
        28: "Vehicles",
        29: "Entertainment: Comics",
        30: "Science: Gadgets",
        31: "Entertainment: Japanese Anime & Manga",
        32: "Entertainment: Cartoon & Animations"
    },
    MESSAGES: {
        GAME_IN_PROGRESS: '🎮 A trivia game is already in progress! Use `.endtrivia` to end it.',
        NO_GAME: '❌ No trivia game is in progress. Start one with `.trivia`.',
        GAME_ENDED: '🏁 Current trivia game has been ended.',
        FETCH_ERROR: '❌ Could not fetch trivia question. Please try again.',
        TIMEOUT: '⏰ Time\'s up! No one answered correctly.',
        HELP: `🎯 *TRIVIA GAME*\n\n` +
              `*Commands:*\n` +
              `• \`.trivia\` - Start a trivia game\n` +
              `• \`.trivia <difficulty>\` - Start with difficulty (easy/medium/hard)\n` +
              `• \`.trivia <category>\` - Start with specific category\n` +
              `• \`.answer <option>\` - Answer the current question\n` +
              `• \`.endtrivia\` - End current game\n` +
              `• \`.trivia categories\` - List all categories\n\n` +
              `*Examples:*\n` +
              `• \`.trivia medium\`\n` +
              `• \`.trivia science\`\n` +
              `• \`.answer A\``,
        CATEGORY_LIST: (categories) => `📚 *Available Categories*\n\n${categories}\n\n*Usage:* \`.trivia science\``
    },
    TIMEOUT_DURATION: 60000, // 1 minute
    EMOJIS: ['🅰️', '🅱️', '🇨', '🇩']
};

// Store trivia games by chat ID
const triviaGames = new Map();

/**
 * Trivia Game Class
 */
class TriviaGame {
    constructor(chatId, questionData, options = {}) {
        this.chatId = chatId;
        this.question = this.decodeHtmlEntities(questionData.question);
        this.correctAnswer = this.decodeHtmlEntities(questionData.correct_answer);
        this.allAnswers = [...questionData.incorrect_answers, questionData.correct_answer]
            .map(ans => this.decodeHtmlEntities(ans))
            .sort(() => Math.random() - 0.5);
        this.difficulty = questionData.difficulty;
        this.category = CONSTANTS.CATEGORIES[questionData.category] || 'Unknown';
        this.startTime = Date.now();
        this.answered = false;
        this.timeoutId = null;
        this.options = options;
        
        this.setupTimeout();
    }

    /**
     * Decode HTML entities in text
     */
    decodeHtmlEntities(text) {
        const entities = {
            '&quot;': '"',
            '&#039;': "'",
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&deg;': '°',
            '&euro;': '€',
            '&pound;': '£'
        };
        
        return text.replace(/&[^;]+;/g, match => entities[match] || match);
    }

    /**
     * Setup game timeout
     */
    setupTimeout() {
        this.timeoutId = setTimeout(() => {
            if (triviaGames.has(this.chatId)) {
                this.endedByTimeout = true;
                triviaGames.delete(this.chatId);
            }
        }, CONSTANTS.TIMEOUT_DURATION);
    }

    /**
     * Format question with options
     */
    formatQuestion() {
        const lines = [];
        
        lines.push(`🎯 *${this.category}* (${this.difficulty})`);
        lines.push('');
        lines.push(`❓ *Question:* ${this.question}`);
        lines.push('');
        lines.push(`📝 *Options:*`);
        
        this.allAnswers.forEach((answer, index) => {
            const emoji = CONSTANTS.EMOJIS[index] || `${index + 1}.`;
            lines.push(`${emoji} ${answer}`);
        });
        
        lines.push('');
        lines.push(`⏰ *Time limit:* 60 seconds`);
        lines.push(`💡 *Answer with:* \`.answer ${CONSTANTS.EMOJIS[0]}\` or \`.answer ${this.allAnswers[0]}\``);
        
        return lines.join('\n');
    }

    /**
     * Check if answer is correct
     */
    checkAnswer(answer) {
        if (this.answered) return false;
        
        // Check by emoji
        const emojiIndex = CONSTANTS.EMOJIS.indexOf(answer);
        if (emojiIndex !== -1) {
            return this.allAnswers[emojiIndex] === this.correctAnswer;
        }
        
        // Check by full text (case insensitive)
        return answer.toLowerCase() === this.correctAnswer.toLowerCase();
    }

    /**
     * Get correct answer emoji
     */
    getCorrectAnswerEmoji() {
        const correctIndex = this.allAnswers.indexOf(this.correctAnswer);
        return CONSTANTS.EMOJIS[correctIndex] || `${correctIndex + 1}.`;
    }

    /**
     * Cleanup game
     */
    cleanup() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.answered = true;
    }
}

/**
 * Parse difficulty from input
 */
function parseDifficulty(input) {
    const lowerInput = input.toLowerCase();
    return CONSTANTS.DIFFICULTIES.find(diff => 
        diff.toLowerCase().includes(lowerInput) || 
        lowerInput.includes(diff.toLowerCase())
    ) || null;
}

/**
 * Parse category from input
 */
function parseCategory(input) {
    const lowerInput = input.toLowerCase();
    
    // Find category by name
    for (const [id, name] of Object.entries(CONSTANTS.CATEGORIES)) {
        if (name.toLowerCase().includes(lowerInput) || 
            lowerInput.includes(name.toLowerCase())) {
            return id;
        }
    }
    
    return null;
}

/**
 * Fetch trivia question from API
 */
async function fetchTriviaQuestion(options = {}) {
    const params = {
        amount: 1,
        type: 'multiple',
        encode: 'url3986'
    };
    
    if (options.difficulty) {
        params.difficulty = options.difficulty;
    }
    
    if (options.category) {
        params.category = options.category;
    }
    
    try {
        const response = await axios.get(CONSTANTS.TRIVIA_API_URL, { 
            params,
            timeout: 10000
        });
        
        if (!response.data.results || response.data.results.length === 0) {
            throw new Error('No results from API');
        }
        
        return response.data.results[0];
    } catch (error) {
        console.error('❌ Trivia API error:', error.message);
        throw error;
    }
}

/**
 * Start a new trivia game
 */
async function startTrivia(sock, chatId, input = '') {
    // Check if game already in progress
    if (triviaGames.has(chatId)) {
        await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.GAME_IN_PROGRESS });
        return;
    }

    // Show help if requested
    if (input === 'help') {
        await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.HELP });
        return;
    }

    // Show categories if requested
    if (input === 'categories') {
        const categoryList = Object.values(CONSTANTS.CATEGORIES)
            .map(cat => `• ${cat}`)
            .join('\n');
        
        await sock.sendMessage(chatId, { 
            text: CONSTANTS.MESSAGES.CATEGORY_LIST(categoryList) 
        });
        return;
    }

    try {
        // Parse options from input
        const options = {};
        
        if (input) {
            // Try to parse as difficulty
            const difficulty = parseDifficulty(input);
            if (difficulty) {
                options.difficulty = difficulty;
            }
            
            // Try to parse as category
            const category = parseCategory(input);
            if (category) {
                options.category = category;
            }
        }

        // Fetch question
        const questionData = await fetchTriviaQuestion(options);
        
        // Create game
        const game = new TriviaGame(chatId, questionData, options);
        triviaGames.set(chatId, game);
        
        // Send question
        await sock.sendMessage(chatId, { 
            text: game.formatQuestion() 
        });
        
        // Log game start
        console.log(`🎮 Trivia game started:`, {
            chatId: chatId.slice(0, 10) + '...',
            category: game.category,
            difficulty: game.difficulty,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error starting trivia:', error);
        await sock.sendMessage(chatId, { 
            text: CONSTANTS.MESSAGES.FETCH_ERROR 
        });
    }
}

/**
 * Answer trivia question
 */
async function answerTrivia(sock, chatId, answer, userId) {
    // Check if game exists
    if (!triviaGames.has(chatId)) {
        await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.NO_GAME });
        return;
    }

    const game = triviaGames.get(chatId);
    
    // Check if already answered
    if (game.answered) {
        return;
    }

    // Check answer
    const isCorrect = game.checkAnswer(answer);
    
    if (!isCorrect) {
        // Wrong answer - no response needed
        return;
    }

    // Correct answer!
    game.cleanup();
    triviaGames.delete(chatId);
    
    // Calculate response time
    const responseTime = ((Date.now() - game.startTime) / 1000).toFixed(1);
    
    // Send success message
    await sock.sendMessage(chatId, {
        text: `🎉 *Correct Answer!*\n\n` +
              `✅ ${game.correctAnswer} ${game.getCorrectAnswerEmoji()}\n\n` +
              `🏆 Answered by: ${userId}\n` +
              `⏱️ Time: ${responseTime} seconds\n` +
              `📚 Category: ${game.category}\n` +
              `⚡ Difficulty: ${game.difficulty}`
    });

    // Log successful answer
    console.log(`✅ Trivia answered correctly:`, {
        chatId: chatId.slice(0, 10) + '...',
        userId: userId.slice(0, 10) + '...',
        responseTime: `${responseTime}s`,
        category: game.category,
        difficulty: game.difficulty
    });
}

/**
 * End current trivia game
 */
async function endTrivia(sock, chatId) {
    if (!triviaGames.has(chatId)) {
        await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.NO_GAME });
        return;
    }

    const game = triviaGames.get(chatId);
    game.cleanup();
    triviaGames.delete(chatId);
    
    await sock.sendMessage(chatId, {
        text: `🏁 *Game Ended*\n\n` +
              `The correct answer was:\n` +
              `✅ ${game.correctAnswer} ${game.getCorrectAnswerEmoji()}\n\n` +
              `📚 Category: ${game.category}\n` +
              `⚡ Difficulty: ${game.difficulty}`
    });

    console.log(`🏁 Trivia game ended manually:`, {
        chatId: chatId.slice(0, 10) + '...',
        category: game.category
    });
}

/**
 * Check for timed out games
 */
function checkTimeouts(sock) {
    for (const [chatId, game] of triviaGames.entries()) {
        if (Date.now() - game.startTime > CONSTANTS.TIMEOUT_DURATION) {
            game.cleanup();
            triviaGames.delete(chatId);
            
            sock.sendMessage(chatId, {
                text: `⏰ *Time's Up!*\n\n` +
                      `No one answered correctly.\n\n` +
                      `The correct answer was:\n` +
                      `✅ ${game.correctAnswer} ${game.getCorrectAnswerEmoji()}\n\n` +
                      `📚 Category: ${game.category}\n` +
                      `⚡ Difficulty: ${game.difficulty}`
            }).catch(console.error);
        }
    }
}

// Periodically check for timeouts
setInterval(() => {
    // This would need access to sock instance
    // You might want to integrate this differently
}, 30000); // Check every 30 seconds

module.exports = {
    startTrivia,
    answerTrivia,
    endTrivia,
    triviaGames
};
