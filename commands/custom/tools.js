const axios = require('axios');
const qrcode = require('qrcode');
const moment = require('moment-timezone');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

module.exports = {
    name: 'tools',
    description: 'Utility tools and calculators',
    
    async execute(sock, chatId, message, args) {
        const text = message.message?.conversation || '';
        
        if (text.startsWith('.calc')) {
            return await this.calculator(sock, chatId, message, args);
        } else if (text.startsWith('.qrcode')) {
            return await this.generateQR(sock, chatId, message, args);
        } else if (text.startsWith('.weather')) {
            return await this.weather(sock, chatId, message, args);
        } else if (text.startsWith('.time')) {
            return await this.worldTime(sock, chatId, message, args);
        } else if (text.startsWith('.define')) {
            return await this.dictionary(sock, chatId, message, args);
        } else if (text.startsWith('.currency')) {
            return await this.currencyConvert(sock, chatId, message, args);
        } else if (text.startsWith('.remind')) {
            return await this.setReminder(sock, chatId, message, args);
        } else if (text.startsWith('.shorten')) {
            return await this.shortenURL(sock, chatId, message, args);
        } else if (text.startsWith('.ping')) {
            return await this.ping(sock, chatId, message);
        } else if (text.startsWith('.help')) {
            return await this.help(sock, chatId, message);
        }
    },
    
    async calculator(sock, chatId, message, args) {
        try {
            const expression = args.join(' ');
            if (!expression) {
                return await sock.sendMessage(chatId, {
                    text: "❌ Please provide a calculation\nExample: .calc 2+2*3"
                }, { quoted: message });
            }
            
            // Basic calculation (use math.js for production)
            let result;
            try {
                // Simple evaluation (be careful with eval in production)
                result = eval(expression);
                
                if (isNaN(result) || !isFinite(result)) {
                    throw new Error('Invalid calculation');
                }
                
            } catch (error) {
                return await sock.sendMessage(chatId, {
                    text: "❌ Invalid calculation. Use: + - * / ( )"
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, {
                text: `🧮 *Calculator*\n\nExpression: ${expression}\nResult: ${result}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Calc Error:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Calculation failed"
            }, { quoted: message });
        }
    },
    
    async generateQR(sock, chatId, message, args) {
        try {
            const text = args.join(' ');
            if (!text) {
                return await sock.sendMessage(chatId, {
                    text: "❌ Please provide text/URL\nExample: .qrcode https://google.com"
                }, { quoted: message });
            }
            
            // Generate QR code
            const qrBuffer = await qrcode.toBuffer(text, {
                width: 400,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            await sock.sendMessage(chatId, {
                image: qrBuffer,
                caption: `📱 QR Code for: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('QR Error:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Failed to generate QR code"
            }, { quoted: message });
        }
    },
    
    async weather(sock, chatId, message, args) {
        try {
            const location = args.join(' ');
            if (!location) {
                return await sock.sendMessage(chatId, {
                    text: "❌ Please provide a city\nExample: .weather London"
                }, { quoted: message });
            }
            
            // Use OpenWeatherMap API (you need an API key)
            const apiKey = process.env.WEATHER_API_KEY;
            if (!apiKey) {
                return await sock.sendMessage(chatId, {
                    text: "❌ Weather API not configured"
                }, { quoted: message });
            }
            
            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
                params: {
                    q: location,
                    appid: apiKey,
                    units: 'metric'
                }
            });
            
            const weather = response.data;
            
            const weatherInfo = `
🌤️ *Weather in ${weather.name}, ${weather.sys.country}*
          
🌡️ Temperature: ${weather.main.temp}°C
💨 Feels like: ${weather.main.feels_like}°C
📊 Humidity: ${weather.main.humidity}%
💨 Wind: ${weather.wind.speed} m/s
☁️ Conditions: ${weather.weather[0].description}
👀 Visibility: ${weather.visibility / 1000} km
⬆️ High: ${weather.main.temp_max}°C
⬇️ Low: ${weather.main.temp_min}°C
            `.trim();
            
            await sock.sendMessage(chatId, {
                text: weatherInfo
            }, { quoted: message });
            
        } catch (error) {
            console.error('Weather Error:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Could not fetch weather. Check city name."
            }, { quoted: message });
        }
    },
    
    async worldTime(sock, chatId, message, args) {
        try {
            const timezone = args[0] || 'UTC';
            
            if (!moment.tz.zone(timezone)) {
                // List available timezones
                const zones = moment.tz.names();
                const matched = zones.filter(z => z.toLowerCase().includes(timezone.toLowerCase())).slice(0, 10);
                
                return await sock.sendMessage(chatId, {
                    text: `❌ Invalid timezone. Available zones:\n${matched.join('\n')}`
                }, { quoted: message });
            }
            
            const time = moment().tz(timezone).format('YYYY-MM-DD HH:mm:ss');
            const date = moment().tz(timezone).format('dddd, MMMM Do YYYY');
            
            await sock.sendMessage(chatId, {
                text: `🕐 *Time in ${timezone}*\n\nDate: ${date}\nTime: ${time}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Time Error:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Invalid timezone"
            }, { quoted: message });
        }
    },
    
    async dictionary(sock, chatId, message, args) {
        try {
            const word = args[0];
            if (!word) {
                return await sock.sendMessage(chatId, {
                    text: "❌ Please provide a word\nExample: .define hello"
                }, { quoted: message });
            }
            
            const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            const data = response.data[0];
            
            let definitionText = `📚 *Definition of ${word}*\n\n`;
            
            if (data.phonetic) {
                definitionText += `Pronunciation: ${data.phonetic}\n\n`;
            }
            
            data.meanings.forEach((meaning, index) => {
                definitionText += `*${meaning.partOfSpeech}*\n`;
                
                meaning.definitions.slice(0, 3).forEach((def, defIndex) => {
                    definitionText += `${defIndex + 1}. ${def.definition}\n`;
                    
                    if (def.example) {
                        definitionText += `   Example: "${def.example}"\n`;
                    }
                });
                
                definitionText += '\n';
            });
            
            await sock.sendMessage(chatId, {
                text: definitionText
            }, { quoted: message });
            
        } catch (error) {
            console.error('Dictionary Error:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Word not found in dictionary"
            }, { quoted: message });
        }
    },
    
    async currencyConvert(sock, chatId, message, args) {
        try {
            if (args.length < 3) {
                return await sock.sendMessage(chatId, {
                    text: "❌ Usage: .currency [amount] [from] [to]\nExample: .currency 100 USD INR"
                }, { quoted: message });
            }
            
            const amount = parseFloat(args[0]);
            const from = args[1].toUpperCase();
            const to = args[2].toUpperCase();
            
            const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`);
            const rate = response.data.rates[to];
            
            if (!rate) {
                return await sock.sendMessage(chatId, {
                    text: `❌ Invalid currency code: ${to}`
                }, { quoted: message });
            }
            
            const converted = (amount * rate).toFixed(2);
            
            await sock.sendMessage(chatId, {
                text: `💱 *Currency Conversion*\n\n${amount} ${from} = ${converted} ${to}\nRate: 1 ${from} = ${rate.toFixed(4)} ${to}`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Currency Error:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Failed to convert currency. Check currency codes."
            }, { quoted: message });
        }
    },
    
    async ping(sock, chatId, message) {
        try {
            const start = Date.now();
            
            await sock.sendMessage(chatId, {
                text: '🏓 Pong!'
            }, { quoted: message });
            
            const latency = Date.now() - start;
            
            // Edit message with latency
            await sock.sendMessage(chatId, {
                text: `🏓 Pong!\n⏱️ Latency: ${latency}ms\n📊 Bot Status: Online`
            });
            
        } catch (error) {
            console.error('Ping Error:', error);
        }
    },
    
    async help(sock, chatId, message) {
        const helpText = `
🤖 *Mayonk Bot Commands* 🤖

*🤖 AI Commands:*
• .gpt [question] - Ask GPT AI
• .gemini [question] - Google Gemini AI
• .dalle [prompt] - Generate AI images
• .translate [lang] [text] - Translate text
• .summarize [text] - Summarize long text

*🎵 Audio Commands:*
• .bass - Boost bass (reply to audio)
• .pitch [factor] - Change pitch
• .reverse - Reverse audio
• .tomp3 - Convert to MP3
• .slow - Slow down audio
• .fast - Speed up audio

*📥 Download Commands:*
• .ytmp3 [url] - YouTube to MP3
• .ytmp4 [url] - YouTube to MP4
• .tiktok [url] - Download TikTok
• .instagram [url] - Download Instagram
• .twitter [url] - Download Twitter

*👥 Group Commands (Admin):*
• .add [number] - Add member
• .kick @user - Remove member
• .promote @user - Make admin
• .demote @user - Remove admin
• .tagall - Mention everyone
• .mute [time] - Mute group
• .unmute - Unmute group
• .setdesc [text] - Set description
• .setname [text] - Change group name

*😄 Fun Commands:*
• .joke - Random joke
• .meme - Random meme
• .quote - Inspirational quote
• .fact - Interesting fact
• .truth - Truth question
• .dare - Dare challenge
• .trivia - Trivia game
• .roll [sides] - Roll dice
• .flip - Flip coin
• .8ball [question] - Magic 8-ball

*🛠️ Utility Commands:*
• .calc [expression] - Calculator
• .qrcode [text] - Generate QR code
• .weather [city] - Weather info
• .time [timezone] - World time
• .define [word] - Dictionary
• .currency [amt] [from] [to] - Convert currency
• .ping - Check bot status
• .help - Show this help

*👑 Owner Commands:*
• .bc [message] - Broadcast
• .restart - Restart bot
• .shutdown - Shutdown bot
• .eval [code] - Execute code

📚 *Need more help?* Contact the bot owner.
        `.trim();
        
        await sock.sendMessage(chatId, {
            text: helpText
        }, { quoted: message });
    }
};
