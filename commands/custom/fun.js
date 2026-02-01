module.exports = {
    name: 'fun',
    description: 'Fun and entertainment commands',
    
    async execute(sock, chatId, message, args) {
        const text = message.message?.conversation || '';
        
        if (text.startsWith('.joke')) {
            return await this.sendJoke(sock, chatId, message);
        } else if (text.startsWith('.meme')) {
            return await this.sendMeme(sock, chatId, message);
        } else if (text.startsWith('.quote')) {
            return await this.sendQuote(sock, chatId, message);
        } else if (text.startsWith('.fact')) {
            return await this.sendFact(sock, chatId, message);
        } else if (text.startsWith('.truth')) {
            return await this.sendTruth(sock, chatId, message);
        } else if (text.startsWith('.dare')) {
            return await this.sendDare(sock, chatId, message);
        } else if (text.startsWith('.trivia')) {
            return await this.sendTrivia(sock, chatId, message);
        } else if (text.startsWith('.roll')) {
            return await this.rollDice(sock, chatId, message, args);
        } else if (text.startsWith('.flip')) {
            return await this.flipCoin(sock, chatId, message);
        } else if (text.startsWith('.8ball')) {
            return await this.eightBall(sock, chatId, message, args);
        }
    },
    
    async sendJoke(sock, chatId, message) {
        try {
            const jokes = [
                "Why don't scientists trust atoms? Because they make up everything!",
                "I told my wife she was drawing her eyebrows too high. She looked surprised.",
                "Why did the scarecrow win an award? He was outstanding in his field!",
                "I'm reading a book on anti-gravity. It's impossible to put down!",
                "Why don't eggs tell jokes? They'd crack each other up.",
                "What do you call fake spaghetti? An impasta!",
                "Why did the bicycle fall over? Because it was two-tired!",
                "What do you call a bear with no teeth? A gummy bear!",
                "I used to play piano by ear, but now I use my hands.",
                "Why did the math book look so sad? Because it had too many problems."
            ];
            
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            
            await sock.sendMessage(chatId, {
                text: `😂 Joke:\n\n${randomJoke}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Joke Error:', error);
        }
    },
    
    async sendMeme(sock, chatId, message) {
        try {
            // Fetch random meme from API
            const response = await axios.get('https://meme-api.com/gimme');
            const meme = response.data;
            
            if (meme.url) {
                const imageResponse = await axios.get(meme.url, { responseType: 'arraybuffer' });
                
                await sock.sendMessage(chatId, {
                    image: Buffer.from(imageResponse.data),
                    caption: `📸 ${meme.title}\nSubreddit: ${meme.subreddit}`
                }, { quoted: message });
            }
            
        } catch (error) {
            console.error('Meme Error:', error);
            await sock.sendMessage(chatId, {
                text: "😅 Couldn't fetch a meme right now. Try again later!"
            }, { quoted: message });
        }
    },
    
    async sendQuote(sock, chatId, message) {
        try {
            const quotes = [
                { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
                { quote: "Life is what happens to you while you're busy making other plans.", author: "John Lennon" },
                { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
                { quote: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
                { quote: "Whoever is happy will make others happy too.", author: "Anne Frank" },
                { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
                { quote: "The purpose of our lives is to be happy.", author: "Dalai Lama" },
                { quote: "You only live once, but if you do it right, once is enough.", author: "Mae West" },
                { quote: "The best revenge is massive success.", author: "Frank Sinatra" },
                { quote: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" }
            ];
            
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            
            await sock.sendMessage(chatId, {
                text: `💭 *Quote of the Day*\n\n"${randomQuote.quote}"\n\n_— ${randomQuote.author}_`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Quote Error:', error);
        }
    },
    
    async sendFact(sock, chatId, message) {
        try {
            const facts = [
                "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.",
                "Octopuses have three hearts. Two pump blood to the gills, while the third pumps it to the rest of the body.",
                "Bananas are berries, but strawberries aren't.",
                "A day on Venus is longer than a year on Venus.",
                "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.",
                "There are more possible iterations of a game of chess than there are atoms in the known universe.",
                "A group of flamingos is called a 'flamboyance'.",
                "The electric chair was invented by a dentist.",
                "Scotland has 421 words for 'snow'.",
                "The total weight of all the ants on Earth is about the same as the total weight of all the humans."
            ];
            
            const randomFact = facts[Math.floor(Math.random() * facts.length)];
            
            await sock.sendMessage(chatId, {
                text: `📚 *Did You Know?*\n\n${randomFact}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Fact Error:', error);
        }
    },
    
    async sendTruth(sock, chatId, message) {
        try {
            const truths = [
                "What's the most embarrassing thing you've ever done?",
                "Have you ever cheated on a test?",
                "What's the biggest lie you've ever told?",
                "What's your biggest fear?",
                "What's something you're glad your parents don't know about you?",
                "Have you ever stolen anything?",
                "What's the worst thing you've ever done?",
                "What's a secret you've never told anyone?",
                "What's your most embarrassing nickname?",
                "Have you ever pretended to like a gift?",
                "What's the silliest thing you've ever cried about?",
                "Have you ever had a crush on a teacher?",
                "What's the most childish thing you still do?",
                "Have you ever broken something and blamed someone else?"
            ];
            
            const randomTruth = truths[Math.floor(Math.random() * truths.length)];
            
            await sock.sendMessage(chatId, {
                text: `🤔 *Truth Question:*\n\n${randomTruth}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Truth Error:', error);
        }
    },
    
    async sendDare(sock, chatId, message) {
        try {
            const dares = [
                "Do 10 push-ups right now.",
                "Send a message to the last person you texted saying 'I love you'.",
                "Let someone else post a status on your social media.",
                "Eat a spoonful of a condiment you don't like.",
                "Do your best impression of a celebrity.",
                "Sing a song at the top of your lungs.",
                "Dance with no music for 1 minute.",
                "Wear your clothes backwards for the next hour.",
                "Talk in an accent for the next 3 rounds.",
                "Let the group give you a new hairstyle.",
                "Call a random number and sing happy birthday.",
                "Let someone draw on your face with a pen.",
                "Do the chicken dance in a public place.",
                "Say the alphabet backwards in under 30 seconds."
            ];
            
            const randomDare = dares[Math.floor(Math.random() * dares.length)];
            
            await sock.sendMessage(chatId, {
                text: `😈 *Dare Challenge:*\n\n${randomDare}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Dare Error:', error);
        }
    },
    
    async rollDice(sock, chatId, message, args) {
        try {
            const sides = parseInt(args[0]) || 6;
            const result = Math.floor(Math.random() * sides) + 1;
            
            const diceFaces = {
                1: '⚀',
                2: '⚁',
                3: '⚂',
                4: '⚃',
                5: '⚄',
                6: '⚅'
            };
            
            const diceFace = diceFaces[result] || '🎲';
            
            await sock.sendMessage(chatId, {
                text: `${diceFace} *Dice Roll:* ${result} (1-${sides})`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Dice Error:', error);
        }
    },
    
    async flipCoin(sock, chatId, message) {
        try {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            const emoji = result === 'Heads' ? '🪙' : '🪙';
            
            await sock.sendMessage(chatId, {
                text: `${emoji} *Coin Flip:* ${result}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Coin Error:', error);
        }
    },
    
    async eightBall(sock, chatId, message, args) {
        try {
            const question = args.join(' ');
            if (!question) {
                return await sock.sendMessage(chatId, {
                    text: "❌ Ask a question after .8ball\nExample: .8ball Will I be rich?"
                }, { quoted: message });
            }
            
            const responses = [
                "It is certain.", "It is decidedly so.", "Without a doubt.",
                "Yes - definitely.", "You may rely on it.", "As I see it, yes.",
                "Most likely.", "Outlook good.", "Yes.", "Signs point to yes.",
                "Reply hazy, try again.", "Ask again later.", "Better not tell you now.",
                "Cannot predict now.", "Concentrate and ask again.",
                "Don't count on it.", "My reply is no.", "My sources say no.",
                "Outlook not so good.", "Very doubtful."
            ];
            
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            
            await sock.sendMessage(chatId, {
                text: `🎱 *Magic 8-Ball*\n\nQuestion: ${question}\n\nAnswer: ${randomResponse}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('8Ball Error:', error);
        }
    }
};
