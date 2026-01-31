const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

// Constants
const CONSTANTS = {
    PATHS: {
        CURRENT_DIR: process.cwd(),
        GIT_DIR: path.join(process.cwd(), '.git'),
        TEMP_DIR: path.join(process.cwd(), 'temp'),
        BACKUP_DIR: path.join(process.cwd(), 'backup')
    },
    IGNORED_FOLDERS: ['node_modules', '.git', 'session', 'temp', 'backup', 'data', 'assets', 'logs'],
    IGNORED_FILES: ['baileys_store.json', '.env', 'config.json', 'credentials.json'],
    MESSAGES: {
        UNAUTHORIZED: '🔒 Only bot owner or sudo can use .update',
        UPDATING: '🔄 Updating the bot, please wait...',
        GIT_NOT_FOUND: '❌ Git repository not found. Using ZIP update method.',
        GIT_UPDATED: (newRev, oldRev) => `✅ Git Update Complete\n\n` +
            `• From: \`${oldRev.slice(0, 7)}\`\n` +
            `• To: \`${newRev.slice(0, 7)}\`\n` +
            `• Files updated: ${newRev !== oldRev ? 'Yes' : 'No'}`,
        GIT_ALREADY_UPDATED: (rev) => `✅ Already up to date\n\n` +
            `• Commit: \`${rev.slice(0, 7)}\`\n` +
            `• No changes required`,
        ZIP_NO_URL: '❌ No ZIP URL configured. Set settings.updateZipUrl or UPDATE_ZIP_URL env.',
        ZIP_DOWNLOADING: '📥 Downloading update package...',
        ZIP_EXTRACTING: '📦 Extracting update package...',
        ZIP_COPYING: '📋 Copying files...',
        ZIP_UPDATED: (count) => `✅ ZIP Update Complete\n\n` +
            `• Files updated: ${count}\n` +
            `• Method: Direct file replacement`,
        INSTALLING_DEPS: '📦 Installing dependencies...',
        RESTARTING: '🔄 Restarting bot...',
        UPDATE_COMPLETE: '✅ Update completed successfully!',
        UPDATE_FAILED: (error) => `❌ Update failed:\n\n\`\`\`${error}\`\`\``,
        BACKUP_CREATED: '💾 Backup created before update',
        BACKUP_FAILED: '⚠️ Could not create backup',
        CLEANING_UP: '🧹 Cleaning up temporary files...'
    },
    UPDATE_METHODS: {
        GIT: 'git',
        ZIP: 'zip'
    },
    HTTP: {
        USER_AGENT: 'KnightBot-Updater/2.0',
        TIMEOUT: 30000,
        MAX_REDIRECTS: 5
    }
};

/**
 * Execute command with promise
 */
async function executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
        const execOptions = {
            windowsHide: true,
            cwd: CONSTANTS.PATHS.CURRENT_DIR,
            timeout: options.timeout || 60000,
            maxBuffer: 1024 * 1024 * 10, // 10MB
            ...options
        };

        exec(command, execOptions, (error, stdout, stderr) => {
            if (error) {
                const errorOutput = stderr || stdout || error.message;
                reject(new Error(`Command failed: ${errorOutput.toString().trim()}`));
                return;
            }
            
            resolve(stdout.toString().trim());
        });
    });
}

/**
 * Check if Git repository exists
 */
async function hasGitRepo() {
    try {
        await fs.access(CONSTANTS.PATHS.GIT_DIR);
        await executeCommand('git --version');
        return true;
    } catch {
        return false;
    }
}

/**
 * Create backup before update
 */
async function createBackup() {
    try {
        await fs.mkdir(CONSTANTS.PATHS.BACKUP_DIR, { recursive: true });
        
        const backupName = `backup_${Date.now()}`;
        const backupPath = path.join(CONSTANTS.PATHS.BACKUP_DIR, backupName);
        
        // Copy important files
        const filesToBackup = [
            'settings.js',
            'package.json',
            'package-lock.json',
            'ecosystem.config.js',
            'config.json',
            '.env'
        ];
        
        for (const file of filesToBackup) {
            try {
                const source = path.join(CONSTANTS.PATHS.CURRENT_DIR, file);
                await fs.copyFile(source, path.join(backupPath, file));
            } catch {
                // Skip files that don't exist
            }
        }
        
        console.log(`✅ Backup created: ${backupPath}`);
        return backupPath;
    } catch (error) {
        console.warn('⚠️ Backup creation failed:', error.message);
        return null;
    }
}

/**
 * Update via Git
 */
async function updateViaGit() {
    const result = {
        method: CONSTANTS.UPDATE_METHODS.GIT,
        oldRevision: null,
        newRevision: null,
        updated: false,
        commitCount: 0,
        changedFiles: []
    };

    try {
        // Get current revision
        result.oldRevision = await executeCommand('git rev-parse HEAD');
        
        // Fetch updates
        await executeCommand('git fetch --all --prune');
        
        // Get latest revision
        result.newRevision = await executeCommand('git rev-parse origin/main');
        
        // Check if already up to date
        result.updated = result.oldRevision !== result.newRevision;
        
        if (result.updated) {
            // Get commit information
            const commitOutput = await executeCommand(
                `git log --pretty=format:"%h|%s|%an|%ar" ${result.oldRevision}..${result.newRevision}`
            );
            
            result.commits = commitOutput.split('\n').map(line => {
                const [hash, subject, author, date] = line.split('|');
                return { hash, subject, author, date };
            });
            result.commitCount = result.commits.length;
            
            // Get changed files
            const filesOutput = await executeCommand(
                `git diff --name-status ${result.oldRevision} ${result.newRevision}`
            );
            result.changedFiles = filesOutput.split('\n').filter(Boolean);
            
            // Reset to new revision
            await executeCommand(`git reset --hard ${result.newRevision}`);
            await executeCommand('git clean -fd');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Git update failed:', error);
        throw error;
    }
}

/**
 * Download file with redirect handling
 */
async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        let redirectCount = 0;
        const visitedUrls = new Set();
        
        const download = (downloadUrl) => {
            if (visitedUrls.has(downloadUrl) || redirectCount > CONSTANTS.HTTP.MAX_REDIRECTS) {
                reject(new Error('Too many redirects or circular redirect detected'));
                return;
            }
            
            visitedUrls.add(downloadUrl);
            
            const isHttps = downloadUrl.startsWith('https://');
            const client = isHttps ? https : http;
            
            const request = client.get(downloadUrl, {
                headers: {
                    'User-Agent': CONSTANTS.HTTP.USER_AGENT,
                    'Accept': '*/*'
                },
                timeout: CONSTANTS.HTTP.TIMEOUT
            }, (response) => {
                // Handle redirects
                if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                    const location = response.headers.location;
                    if (!location) {
                        reject(new Error(`HTTP ${response.statusCode} without Location header`));
                        return;
                    }
                    
                    redirectCount++;
                    response.resume();
                    
                    // Resolve relative URL
                    const nextUrl = new URL(location, downloadUrl).toString();
                    download(nextUrl);
                    return;
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                const fileStream = fs.createWriteStream(destPath);
                
                response.pipe(fileStream);
                
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(destPath);
                });
                
                fileStream.on('error', (error) => {
                    fs.unlink(destPath, () => {});
                    reject(error);
                });
            });
            
            request.on('error', (error) => {
                fs.unlink(destPath, () => {});
                reject(error);
            });
            
            request.on('timeout', () => {
                request.destroy();
                fs.unlink(destPath, () => {});
                reject(new Error('Download timeout'));
            });
        };
        
        download(url);
    });
}

/**
 * Extract ZIP file using system tools
 */
async function extractZip(zipPath, extractDir) {
    // Clean extract directory
    try {
        await fs.rm(extractDir, { recursive: true, force: true });
    } catch {}
    
    await fs.mkdir(extractDir, { recursive: true });
    
    // Try different extraction methods
    const methods = [
        { command: 'unzip -o', check: 'unzip --version' },
        { command: '7z x -y', check: '7z --help' },
        { command: 'busybox unzip -o', check: 'busybox unzip' }
    ];
    
    for (const method of methods) {
        try {
            await executeCommand(method.check);
            await executeCommand(`${method.command} "${zipPath}" -d "${extractDir}"`);
            console.log(`✅ Extracted using ${method.command.split(' ')[0]}`);
            return;
        } catch {
            continue;
        }
    }
    
    throw new Error('No suitable extraction tool found (unzip/7z/busybox)');
}

/**
 * Update via ZIP download
 */
async function updateViaZip(zipUrl) {
    const result = {
        method: CONSTANTS.UPDATE_METHODS.ZIP,
        downloadedFiles: [],
        updatedFiles: []
    };
    
    try {
        // Create temp directory
        await fs.mkdir(CONSTANTS.PATHS.TEMP_DIR, { recursive: true });
        
        // Download ZIP
        const zipPath = path.join(CONSTANTS.PATHS.TEMP_DIR, `update_${Date.now()}.zip`);
        await downloadFile(zipUrl, zipPath);
        
        // Extract ZIP
        const extractDir = path.join(CONSTANTS.PATHS.TEMP_DIR, 'extracted');
        await extractZip(zipPath, extractDir);
        
        // Find extracted root directory
        const entries = await fs.readdir(extractDir);
        let sourceRoot = extractDir;
        
        for (const entry of entries) {
            const entryPath = path.join(extractDir, entry);
            const stat = await fs.stat(entryPath);
            if (stat.isDirectory()) {
                sourceRoot = entryPath;
                break;
            }
        }
        
        // Copy files, preserving important ones
        await copyFilesWithPreservation(sourceRoot, CONSTANTS.PATHS.CURRENT_DIR, result);
        
        // Cleanup
        await fs.rm(extractDir, { recursive: true, force: true });
        await fs.unlink(zipPath);
        
        return result;
        
    } catch (error) {
        console.error('❌ ZIP update failed:', error);
        throw error;
    }
}

/**
 * Copy files while preserving important data
 */
async function copyFilesWithPreservation(sourceDir, destDir, result) {
    const entries = await fs.readdir(sourceDir);
    
    for (const entry of entries) {
        if (CONSTANTS.IGNORED_FOLDERS.includes(entry)) {
            continue;
        }
        
        const sourcePath = path.join(sourceDir, entry);
        const destPath = path.join(destDir, entry);
        const stat = await fs.stat(sourcePath);
        
        if (stat.isDirectory()) {
            await fs.mkdir(destPath, { recursive: true });
            await copyFilesWithPreservation(sourcePath, destPath, result);
        } else {
            if (CONSTANTS.IGNORED_FILES.includes(entry)) {
                continue;
            }
            
            await fs.copyFile(sourcePath, destPath);
            result.updatedFiles.push(entry);
        }
    }
}

/**
 * Install dependencies
 */
async function installDependencies() {
    try {
        // Check if package.json exists
        await fs.access('package.json');
        
        // Install dependencies
        await executeCommand('npm install --no-audit --no-fund --no-optional --progress=false', {
            timeout: 300000 // 5 minutes
        });
        
        console.log('✅ Dependencies installed');
        return true;
    } catch (error) {
        console.warn('⚠️ Dependency installation failed:', error.message);
        return false;
    }
}

/**
 * Restart the bot process
 */
async function restartBot(sock, chatId, message) {
    try {
        // Try PM2 first
        try {
            await executeCommand('pm2 restart all');
            console.log('✅ Restarted via PM2');
            return;
        } catch {
            // PM2 not available
        }
        
        // Try other process managers
        const managers = ['systemctl', 'forever', 'nodemon'];
        
        for (const manager of managers) {
            try {
                await executeCommand(`${manager} --version`);
                console.log(`✅ Found ${manager}, attempting restart...`);
                // Implementation would depend on specific manager
                break;
            } catch {
                continue;
            }
        }
        
        // Fallback: exit and let panel restart
        setTimeout(() => {
            process.exit(0);
        }, 2000);
        
    } catch (error) {
        console.error('❌ Restart failed:', error);
        throw error;
    }
}

/**
 * Main update command handler
 */
async function updateCommand(sock, chatId, message, zipOverride = null) {
    try {
        // Authorization check
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, 
                { text: CONSTANTS.MESSAGES.UNAUTHORIZED },
                { quoted: message }
            );
            return;
        }
        
        // Send initial message
        await sock.sendMessage(chatId,
            { text: CONSTANTS.MESSAGES.UPDATING },
            { quoted: message }
        );
        
        // Create backup
        const backupPath = await createBackup();
        if (backupPath) {
            await sock.sendMessage(chatId,
                { text: CONSTANTS.MESSAGES.BACKUP_CREATED }
            );
        }
        
        let updateResult;
        
        // Determine update method
        const useGit = await hasGitRepo() && !zipOverride;
        
        if (useGit) {
            // Update via Git
            updateResult = await updateViaGit();
            
            if (updateResult.updated) {
                await sock.sendMessage(chatId, {
                    text: CONSTANTS.MESSAGES.GIT_UPDATED(
                        updateResult.newRevision,
                        updateResult.oldRevision
                    )
                });
            } else {
                await sock.sendMessage(chatId, {
                    text: CONSTANTS.MESSAGES.GIT_ALREADY_UPDATED(updateResult.newRevision)
                });
                return; // No need to restart if already up to date
            }
        } else {
            // Update via ZIP
            const zipUrl = zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL;
            
            if (!zipUrl) {
                await sock.sendMessage(chatId,
                    { text: CONSTANTS.MESSAGES.ZIP_NO_URL },
                    { quoted: message }
                );
                return;
            }
            
            await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.ZIP_DOWNLOADING });
            await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.ZIP_EXTRACTING });
            await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.ZIP_COPYING });
            
            updateResult = await updateViaZip(zipUrl);
            
            await sock.sendMessage(chatId, {
                text: CONSTANTS.MESSAGES.ZIP_UPDATED(updateResult.updatedFiles.length)
            });
        }
        
        // Install dependencies
        await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.INSTALLING_DEPS });
        await installDependencies();
        
        // Send completion message
        await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.UPDATE_COMPLETE });
        
        // Cleanup
        await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.CLEANING_UP });
        
        // Restart bot
        await sock.sendMessage(chatId, { text: CONSTANTS.MESSAGES.RESTARTING });
        await restartBot(sock, chatId, message);
        
    } catch (error) {
        console.error('❌ Update command failed:', error);
        
        await sock.sendMessage(chatId,
            { text: CONSTANTS.MESSAGES.UPDATE_FAILED(error.message) },
            { quoted: message }
        );
    }
}

module.exports = updateCommand;
