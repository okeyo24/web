const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

module.exports = {
    name: 'audio',
    description: 'Audio processing commands',
    
    async execute(sock, chatId, message, args) {
        const text = message.message?.conversation || '';
        
        if (text.startsWith('.bass')) {
            return await this.applyBass(sock, chatId, message);
        } else if (text.startsWith('.pitch')) {
            return await this.changePitch(sock, chatId, message, args);
        } else if (text.startsWith('.slow')) {
            return await this.slowAudio(sock, chatId, message);
        } else if (text.startsWith('.fast')) {
            return await this.fastAudio(sock, chatId, message);
        } else if (text.startsWith('.reverse')) {
            return await this.reverseAudio(sock, chatId, message);
        } else if (text.startsWith('.tomp3')) {
            return await this.convertToMp3(sock, chatId, message);
        }
    },
    
    async applyBass(sock, chatId, message) {
        try {
            if (!message.message.audioMessage) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Please send an audio file with .bass command'
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, { 
                text: '🎵 Applying bass boost...'
            });
            
            // Download audio
            const buffer = await sock.downloadMediaMessage(message);
            const inputPath = path.join(__dirname, '../temp/input.mp3');
            const outputPath = path.join(__dirname, '../temp/output_bass.mp3');
            
            fs.writeFileSync(inputPath, buffer);
            
            // Apply bass boost using FFmpeg
            await execPromise(`ffmpeg -i "${inputPath}" -af "bass=g=20" "${outputPath}"`);
            
            // Send processed audio
            const outputBuffer = fs.readFileSync(outputPath);
            await sock.sendMessage(chatId, {
                audio: outputBuffer,
                mimetype: 'audio/mp4',
                ptt: false
            }, { quoted: message });
            
            // Cleanup
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
            
        } catch (error) {
            console.error('Bass Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to process audio'
            }, { quoted: message });
        }
    },
    
    async changePitch(sock, chatId, message, args) {
        try {
            if (!message.message.audioMessage) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Please send an audio file'
                }, { quoted: message });
            }
            
            const pitch = parseFloat(args[0]) || 1.5;
            
            await sock.sendMessage(chatId, { 
                text: `🎵 Changing pitch to ${pitch}x...`
            });
            
            const buffer = await sock.downloadMediaMessage(message);
            const inputPath = path.join(__dirname, '../temp/input.mp3');
            const outputPath = path.join(__dirname, '../temp/output_pitch.mp3');
            
            fs.writeFileSync(inputPath, buffer);
            
            // Change pitch using FFmpeg
            await execPromise(`ffmpeg -i "${inputPath}" -af "asetrate=44100*${pitch},aresample=44100" "${outputPath}"`);
            
            const outputBuffer = fs.readFileSync(outputPath);
            await sock.sendMessage(chatId, {
                audio: outputBuffer,
                mimetype: 'audio/mp4'
            }, { quoted: message });
            
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
            
        } catch (error) {
            console.error('Pitch Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to change pitch'
            }, { quoted: message });
        }
    },
    
    async reverseAudio(sock, chatId, message) {
        try {
            if (!message.message.audioMessage) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Please send an audio file with .reverse command'
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, { 
                text: '🔁 Reversing audio...'
            });
            
            const buffer = await sock.downloadMediaMessage(message);
            const inputPath = path.join(__dirname, '../temp/input.mp3');
            const outputPath = path.join(__dirname, '../temp/output_reverse.mp3');
            
            fs.writeFileSync(inputPath, buffer);
            
            // Reverse audio using FFmpeg
            await execPromise(`ffmpeg -i "${inputPath}" -af "areverse" "${outputPath}"`);
            
            const outputBuffer = fs.readFileSync(outputPath);
            await sock.sendMessage(chatId, {
                audio: outputBuffer,
                mimetype: 'audio/mp4'
            }, { quoted: message });
            
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
            
        } catch (error) {
            console.error('Reverse Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to reverse audio'
            }, { quoted: message });
        }
    },
    
    async convertToMp3(sock, chatId, message) {
        try {
            if (!message.message.videoMessage && !message.message.audioMessage) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Please send a video or audio file'
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, { 
                text: '🔄 Converting to MP3...'
            });
            
            const buffer = await sock.downloadMediaMessage(message);
            const inputPath = path.join(__dirname, '../temp/input.mp4');
            const outputPath = path.join(__dirname, '../temp/output.mp3');
            
            fs.writeFileSync(inputPath, buffer);
            
            // Convert to MP3
            await execPromise(`ffmpeg -i "${inputPath}" -q:a 0 -map a "${outputPath}"`);
            
            const outputBuffer = fs.readFileSync(outputPath);
            await sock.sendMessage(chatId, {
                audio: outputBuffer,
                mimetype: 'audio/mp3',
                fileName: 'converted.mp3'
            }, { quoted: message });
            
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
            
        } catch (error) {
            console.error('Convert Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to convert file'
            }, { quoted: message });
        }
    }
};
