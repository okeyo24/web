const fs = require('fs');
const path = require('path');
const os = require('os');
const isOwnerOrSudo = require('../lib/isOwner');

// Constants
const CONSTANTS = {
    CHANNEL_INFO: {
        contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363161513685998@newsletter',
                newsletterName: 'KnightBot MD',
                serverMessageId: -1
            }
        }
    },
    SESSION_DIR: path.join(__dirname, '../session'),
    PROTECTED_FILES: ['creds.json', 'config.json', 'settings.json'],
    FILE_PATTERNS: {
        APP_STATE: 'app-state-sync-',
        PRE_KEY: 'pre-key-',
        SENDER_KEY: 'sender-key-',
        SESSION: 'session-'
    },
    MESSAGES: {
        UNAUTHORIZED: '❌ This command can only be used by the owner!',
        SESSION_NOT_FOUND: '❌ Session directory not found!',
        INITIALIZING: '🔍 Scanning and optimizing session files...',
        SUCCESS: '✅ Session files cleared successfully!',
        FAILED: '❌ Failed to clear session files!',
        NO_FILES: '📭 No session files found to clear.',
        PARTIAL_SUCCESS: '⚠️ Some files could not be cleared.'
    }
};

/**
 * Check if user is authorized to run the command
 */
async function checkAuthorization(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    return message.key.fromMe || isOwner;
}

/**
 * Analyze session directory and categorize files
 */
function analyzeSessionFiles(sessionDir) {
    if (!fs.existsSync(sessionDir)) {
        return null;
    }

    const files = fs.readdirSync(sessionDir);
    const analysis = {
        totalFiles: files.length,
        protectedFiles: [],
        deletableFiles: [],
        fileTypes: {
            appStateSync: 0,
            preKeys: 0,
            senderKeys: 0,
            sessions: 0,
            others: 0
        },
        totalSize: 0
    };

    for (const file of files) {
        const filePath = path.join(sessionDir, file);
        
        try {
            const stats = fs.statSync(filePath);
            analysis.totalSize += stats.size;

            // Check if file is protected
            if (CONSTANTS.PROTECTED_FILES.includes(file)) {
                analysis.protectedFiles.push({
                    name: file,
                    size: formatFileSize(stats.size)
                });
                continue;
            }

            // Categorize file by type
            if (file.startsWith(CONSTANTS.FILE_PATTERNS.APP_STATE)) {
                analysis.fileTypes.appStateSync++;
            } else if (file.startsWith(CONSTANTS.FILE_PATTERNS.PRE_KEY)) {
                analysis.fileTypes.preKeys++;
            } else if (file.startsWith(CONSTANTS.FILE_PATTERNS.SENDER_KEY)) {
                analysis.fileTypes.senderKeys++;
            } else if (file.startsWith(CONSTANTS.FILE_PATTERNS.SESSION)) {
                analysis.fileTypes.sessions++;
            } else {
                analysis.fileTypes.others++;
            }

            analysis.deletableFiles.push({
                name: file,
                path: filePath,
                size: stats.size,
                type: getFileType(file)
            });
        } catch (error) {
            console.warn(`⚠️ Could not analyze file ${file}:`, error.message);
        }
    }

    return analysis;
}

/**
 * Get file type based on name pattern
 */
function getFileType(fileName) {
    for (const [type, pattern] of Object.entries(CONSTANTS.FILE_PATTERNS)) {
        if (fileName.startsWith(pattern)) {
            return type.replace(/([A-Z])/g, ' $1').trim();
        }
    }
    return 'Other';
}

/**
 * Format file size to human readable format
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Delete session files safely
 */
function deleteSessionFiles(deletableFiles) {
    const results = {
        deleted: 0,
        failed: 0,
        errors: []
    };

    for (const fileInfo of deletableFiles) {
        try {
            fs.unlinkSync(fileInfo.path);
            results.deleted++;
        } catch (error) {
            results.failed++;
            results.errors.push({
                file: fileInfo.name,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Create success message with detailed statistics
 */
function createSuccessMessage(analysis, deletionResults) {
    const lines = [];
    
    lines.push(CONSTANTS.MESSAGES.SUCCESS);
    lines.push('');
    
    // File type statistics
    lines.push('📊 **File Statistics:**');
    lines.push(`• Total files analyzed: ${analysis.totalFiles}`);
    
    if (analysis.fileTypes.appStateSync > 0) {
        lines.push(`• App State Sync files: ${analysis.fileTypes.appStateSync}`);
    }
    if (analysis.fileTypes.preKeys > 0) {
        lines.push(`• Pre-key files: ${analysis.fileTypes.preKeys}`);
    }
    if (analysis.fileTypes.senderKeys > 0) {
        lines.push(`• Sender Key files: ${analysis.fileTypes.senderKeys}`);
    }
    if (analysis.fileTypes.sessions > 0) {
        lines.push(`• Session files: ${analysis.fileTypes.sessions}`);
    }
    if (analysis.fileTypes.others > 0) {
        lines.push(`• Other files: ${analysis.fileTypes.others}`);
    }
    
    // Storage information
    lines.push('');
    lines.push('💾 **Storage Information:**');
    lines.push(`• Total size freed: ${formatFileSize(analysis.totalSize)}`);
    lines.push(`• Files successfully deleted: ${deletionResults.deleted}`);
    
    // Protected files
    if (analysis.protectedFiles.length > 0) {
        lines.push('');
        lines.push('🛡️ **Protected Files (Not Deleted):**');
        analysis.protectedFiles.forEach(file => {
            lines.push(`• ${file.name} (${file.size})`);
        });
    }
    
    // Errors
    if (deletionResults.failed > 0) {
        lines.push('');
        lines.push('⚠️ **Deletion Errors:**');
        lines.push(`• Failed to delete: ${deletionResults.failed} files`);
        
        // Show first few errors
        deletionResults.errors.slice(0, 3).forEach(err => {
            lines.push(`  - ${err.file}: ${err.error}`);
        });
        
        if (deletionResults.errors.length > 3) {
            lines.push(`  ... and ${deletionResults.errors.length - 3} more`);
        }
    }
    
    // Recommendations
    lines.push('');
    lines.push('💡 **Recommendations:**');
    lines.push('• Restart the bot for changes to take effect');
    lines.push('• Session files will regenerate as needed');
    lines.push('• Regular cleanup improves performance');
    
    return lines.join('\n');
}

/**
 * Main clear session command handler
 */
async function clearSessionCommand(sock, chatId, message) {
    try {
        // Authorization check
        const isAuthorized = await checkAuthorization(sock, chatId, message);
        if (!isAuthorized) {
            await sock.sendMessage(chatId, { 
                text: CONSTANTS.MESSAGES.UNAUTHORIZED,
                ...CONSTANTS.CHANNEL_INFO
            });
            return;
        }

        // Check if session directory exists
        if (!fs.existsSync(CONSTANTS.SESSION_DIR)) {
            await sock.sendMessage(chatId, { 
                text: CONSTANTS.MESSAGES.SESSION_NOT_FOUND,
                ...CONSTANTS.CHANNEL_INFO
            });
            return;
        }

        // Send initial status
        await sock.sendMessage(chatId, { 
            text: CONSTANTS.MESSAGES.INITIALIZING,
            ...CONSTANTS.CHANNEL_INFO
        });

        // Analyze session files
        const analysis = analyzeSessionFiles(CONSTANTS.SESSION_DIR);
        
        if (!analysis || analysis.deletableFiles.length === 0) {
            await sock.sendMessage(chatId, { 
                text: CONSTANTS.MESSAGES.NO_FILES,
                ...CONSTANTS.CHANNEL_INFO
            });
            return;
        }

        // Delete files
        const deletionResults = deleteSessionFiles(analysis.deletableFiles);

        // Send completion message
        const successMessage = createSuccessMessage(analysis, deletionResults);
        await sock.sendMessage(chatId, { 
            text: successMessage,
            ...CONSTANTS.CHANNEL_INFO
        });

        // Log cleanup results
        console.log('📁 Session cleanup completed:', {
            totalFiles: analysis.totalFiles,
            deleted: deletionResults.deleted,
            failed: deletionResults.failed,
            totalSize: formatFileSize(analysis.totalSize),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error in clear session command:', error);
        
        const errorMessage = error.code === 'ENOENT' 
            ? '❌ Session directory not found or inaccessible.'
            : CONSTANTS.MESSAGES.FAILED;
            
        try {
            await sock.sendMessage(chatId, { 
                text: errorMessage,
                ...CONSTANTS.CHANNEL_INFO
            });
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
    }
}

module.exports = clearSessionCommand;
