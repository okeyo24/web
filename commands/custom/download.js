const ytdl = require('ytdl-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'download',
    description: 'Download media from various platforms',
    
    async execute(sock, chatId, message, args) {
        const text = message.message?.conversation || '';
        
        if (text.startsWith('.ytmp3')) {
            return await this.downloadYoutubeAudio(sock, chatId, message, args);
        } else if (text.startsWith('.ytmp4')) {
            return await this.downloadYoutubeVideo(sock, chatId, message, args);
        } else if (text.startsWith('.tiktok')) {
            return await this.downloadTikTok(sock, chatId, message, args);
        } else if (text.startsWith('.instagram')) {
            return await this.downloadInstagram(sock, chatId, message, args);
        } else if (text.startsWith('.twitter')) {
            return await this.downloadTwitter(sock, chatId, message, args);
        }
    },
    
    async downloadYoutubeAudio(sock, chatId, message, args) {
        try {
            const url = args[0];
            if (!url || !ytdl.validateURL(url)) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Invalid YouTube URL\nExample: .ytmp3 https://youtube.com/watch?v=xxx'
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, { 
                text: '⬇️ Downloading audio... This may take a moment.'
            });
            
            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
            
            const audioStream = ytdl(url, { quality: 'highestaudio' });
            const chunks = [];
            
            audioStream.on('data', chunk => chunks.push(chunk));
            audioStream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                
                await sock.sendMessage(chatId, {
                    audio: buffer,
                    mimetype: 'audio/mp4',
                    fileName: `${title.substring(0, 50)}.mp3`
                }, { quoted: message });
            });
            
            audioStream.on('error', async (error) => {
                console.error('YouTube Audio Error:', error);
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to download audio'
                }, { quoted: message });
            });
            
        } catch (error) {
            console.error('YouTube Audio Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to download audio. Make sure the URL is valid.'
            }, { quoted: message });
        }
    },
    
    async downloadYoutubeVideo(sock, chatId, message, args) {
        try {
            const url = args[0];
            if (!url || !ytdl.validateURL(url)) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Invalid YouTube URL\nExample: .ytmp4 https://youtube.com/watch?v=xxx'
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, { 
                text: '⬇️ Downloading video... This may take a moment.'
            });
            
            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
            
            // Get highest quality video
            const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });
            
            const videoStream = ytdl(url, { format: format });
            const chunks = [];
            
            videoStream.on('data', chunk => chunks.push(chunk));
            videoStream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                
                await sock.sendMessage(chatId, {
                    video: buffer,
                    caption: `🎬 ${title}`,
                    fileName: `${title.substring(0, 50)}.mp4`
                }, { quoted: message });
            });
            
            videoStream.on('error', async (error) => {
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to download video'
                }, { quoted: message });
            });
            
        } catch (error) {
            console.error('YouTube Video Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to download video'
            }, { quoted: message });
        }
    },
    
    async downloadTikTok(sock, chatId, message, args) {
        try {
            const url = args[0];
            if (!url || !url.includes('tiktok.com')) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Invalid TikTok URL\nExample: .tiktok https://tiktok.com/@user/video/xxx'
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, { 
                text: '⬇️ Downloading TikTok video...'
            });
            
            // Use TikTok API
            const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl);
            
            if (response.data.code === 0) {
                const videoUrl = response.data.data.play;
                const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
                
                await sock.sendMessage(chatId, {
                    video: Buffer.from(videoResponse.data),
                    caption: response.data.data.title || 'TikTok Video'
                }, { quoted: message });
            } else {
                throw new Error('API failed');
            }
            
        } catch (error) {
            console.error('TikTok Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to download TikTok video'
            }, { quoted: message });
        }
    },
    
    async downloadInstagram(sock, chatId, message, args) {
        try {
            const url = args[0];
            if (!url || !url.includes('instagram.com')) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Invalid Instagram URL\nExample: .instagram https://instagram.com/p/xxx'
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, { 
                text: '⬇️ Downloading Instagram content...'
            });
            
            // Use Instagram API
            const apiUrl = `https://instagram-scraper-api2.p.rapidapi.com/v1/post_info`;
            const response = await axios.get(apiUrl, {
                params: { url: url },
                headers: {
                    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
                }
            });
            
            if (response.data.items && response.data.items[0]) {
                const item = response.data.items[0];
                
                if (item.video_versions) {
                    // Video post
                    const videoUrl = item.video_versions[0].url;
                    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
                    
                    await sock.sendMessage(chatId, {
                        video: Buffer.from(videoResponse.data),
                        caption: item.caption?.text || 'Instagram Video'
                    });
                } else if (item.image_versions2) {
                    // Image post
                    const imageUrl = item.image_versions2.candidates[0].url;
                    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    
                    await sock.sendMessage(chatId, {
                        image: Buffer.from(imageResponse.data),
                        caption: item.caption?.text || 'Instagram Post'
                    });
                }
            }
            
        } catch (error) {
            console.error('Instagram Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to download Instagram content'
            }, { quoted: message });
        }
    }
};
