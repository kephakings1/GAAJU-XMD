/**
 * GAAJU-XMD Bot - A WhatsApp Bot
 * gaajutech
 * © 2026 GAAJU-XMD
 *
 * re-upload? recode? copy code? give credit to gaajutech 2026 :)
 * Instagram : gaajutech          Telegram : t.me/Official_ChrisGaaju
 * GitHub    : Xchristech2        WhatsApp : +2348069675806
 * YouTube   : https://youtube.com/@Xchristech
 */

// --- Environment Setup ---
const config = require('./config');
/*━━━━━━━━━━━━━━━━━━━━*/
require('dotenv').config(); // CRITICAL: Load .env variables first!
// *******************************************************************
// *** CRITICAL CHANGE: REQUIRED FILES (settings.js, main, etc.) ***
// *** HAVE BEEN REMOVED FROM HERE AND MOVED BELOW THE CLONER RUN. ***
// *******************************************************************

const fs = require('fs')
const chalk = require('chalk')
const path = require('path')
const os = require('os')
const PhoneNumber = require('awesome-phonenumber')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")

const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { rmSync } = require('fs')

// --- 🌟 NEW: Centralized Logging Function ---
/**
 * Custom logging function to enforce the [ GAAJU-XMD ] prefix and styling.
 * @param {string} message - The message to log.
 * @param {string} [color='white'] - The chalk color (e.g., 'green', 'red', 'yellow').
 * @param {boolean} [isError=false] - Whether to use console.error.
 */
function log(message, color = 'white', isError = false) {
    const prefix = chalk.magenta.bold('[ GAAJU-XMD ]');
    const logFunc = isError ? console.error : console.log;
    const coloredMessage = chalk[color](message);

    if (message.includes('\n') || message.includes('════')) {
        logFunc(prefix, coloredMessage);
    } else {
        logFunc(`${prefix} ${coloredMessage}`);
    }
}
// -------------------------------------------


// --- GLOBAL FLAGS ---
global.isBotConnected = false;
global.connectDebounceTimeout = null;
// --- NEW: Error State Management ---
global.errorRetryCount = 0;

// ***************************************************************
// *** DEPENDENCIES MOVED DOWN HERE ***
// ***************************************************************

let smsg, handleMessages, handleGroupParticipantUpdate, handleStatus, store, settings;

// --- 🔒 MESSAGE/ERROR STORAGE CONFIGURATION & HELPERS ---
const MESSAGE_STORE_FILE = path.join(__dirname, 'message_backup.json');
const SESSION_ERROR_FILE = path.join(__dirname, 'sessionErrorCount.json');
global.messageBackup = {};

function loadStoredMessages() {
    try {
        if (fs.existsSync(MESSAGE_STORE_FILE)) {
            const data = fs.readFileSync(MESSAGE_STORE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading message backup store: ${error.message}`, 'red', true);
    }
    return {};
}

function saveStoredMessages(data) {
    try {
        fs.writeFileSync(MESSAGE_STORE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving message backup store: ${error.message}`, 'red', true);
    }
}
global.messageBackup = loadStoredMessages();

// --- NEW: Error Counter Helpers ---
function loadErrorCount() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            const data = fs.readFileSync(SESSION_ERROR_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading session error count: ${error.message}`, 'red', true);
    }
    return { count: 0, last_error_timestamp: 0 };
}

function saveErrorCount(data) {
    try {
        fs.writeFileSync(SESSION_ERROR_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving session error count: ${error.message}`, 'red', true);
    }
}

function deleteErrorCountFile() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            fs.unlinkSync(SESSION_ERROR_FILE);
            log('✅ Deleted sessionErrorCount.json.', 'red');
        }
    } catch (e) {
        log(`Failed to delete sessionErrorCount.json: ${e.message}`, 'red', true);
    }
}


// --- ♻️ CLEANUP FUNCTIONS ---

/**
 * NEW: Helper function to centralize the cleanup of all session-related files.
 */
function clearSessionFiles() {
    try {
        log('🗑️ Clearing session folder...', 'blue');
        rmSync(sessionDir, { recursive: true, force: true });
        if (fs.existsSync(loginFile)) fs.unlinkSync(loginFile);
        deleteErrorCountFile();
        global.errorRetryCount = 0;
        log('✅ Session files cleaned successfully.', 'green');
    } catch (e) {
        log(`Failed to clear session files: ${e.message}`, 'red', true);
    }
}


function cleanupOldMessages() {
    let storedMessages = loadStoredMessages();
    let now = Math.floor(Date.now() / 1000);
    const maxMessageAge = 24 * 60 * 60;
    let cleanedMessages = {};
    for (let chatId in storedMessages) {
        let newChatMessages = {};
        for (let messageId in storedMessages[chatId]) {
            let message = storedMessages[chatId][messageId];
            if (now - message.timestamp <= maxMessageAge) {
                newChatMessages[messageId] = message;
            }
        }
        if (Object.keys(newChatMessages).length > 0) {
            cleanedMessages[chatId] = newChatMessages;
        }
    }
    saveStoredMessages(cleanedMessages);
    log("🧹 [Msg Cleanup] Old messages removed from message_backup.json", 'yellow');
}

function cleanupJunkFiles(botSocket) {
    let directoryPath = path.join();
    fs.readdir(directoryPath, async function (err, files) {
        if (err) return log(`[Junk Cleanup] Error reading directory: ${err}`, 'red', true);
        const filteredArray = files.filter(item =>
            item.endsWith(".gif") || item.endsWith(".png") || item.endsWith(".mp3") ||
            item.endsWith(".mp4") || item.endsWith(".opus") || item.endsWith(".jpg") ||
            item.endsWith(".webp") || item.endsWith(".webm") || item.endsWith(".zip")
        );
        if (filteredArray.length > 0) {
            let teks = `Detected ${filteredArray.length} junk files,\nJunk files have been deleted🚮`;
            if (botSocket && botSocket.user && botSocket.user.id) {
                botSocket.sendMessage(botSocket.user.id.split(':')[0] + '@s.whatsapp.net', { text: teks });
            }
            filteredArray.forEach(function (file) {
                const filePath = path.join(directoryPath, file);
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (e) {
                    log(`[Junk Cleanup] Failed to delete file ${file}: ${e.message}`, 'red', true);
                }
            });
            log(`[Junk Cleanup] ${filteredArray.length} files deleted.`, 'yellow');
        }
    });
}

// --- GAAJU-XMD ORIGINAL CODE START ---
global.botname = "GAAJU-XMD"
global.themeemoji = "🤖"
const useMobile = process.argv.includes("--mobile")

// --- Readline setup ---
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => rl ? new Promise(resolve => rl.question(text, resolve)) : Promise.resolve(settings?.ownerNumber || global.phoneNumber)

/*━━━━━━━━━━━━━━━━━━━━*/
// --- Paths ---
/*━━━━━━━━━━━━━━━━━━━━*/
const sessionDir = path.join(__dirname, 'session')
const credsPath = path.join(sessionDir, 'creds.json')
const loginFile = path.join(sessionDir, 'login.json')
const envPath = path.join(process.cwd(), '.env');

/*━━━━━━━━━━━━━━━━━━━━*/
// --- Login persistence ---
/*━━━━━━━━━━━━━━━━━━━━*/

async function saveLoginMethod(method) {
    await fs.promises.mkdir(sessionDir, { recursive: true });
    await fs.promises.writeFile(loginFile, JSON.stringify({ method }, null, 2));
}

async function getLastLoginMethod() {
    if (fs.existsSync(loginFile)) {
        const data = JSON.parse(fs.readFileSync(loginFile, 'utf-8'));
        return data.method;
    }
    return null;
}

// --- Session check ---
function sessionExists() {
    return fs.existsSync(credsPath);
}

// ══════════════════════════════════════════════════════════════
// SESSION ID SYSTEM
// Format  : Gaanju:~<base64-encoded creds.json>
// .env key: SESSION_ID=Gaanju:~<base64>
// ══════════════════════════════════════════════════════════════

/**
 * encodeSessionId(credsJson)
 * Converts creds.json string → Gaanju:~<base64>
 * Called after successful pairing so the user can copy their session ID.
 */
function encodeSessionId(credsJson) {
    return "Gaanju:~" + Buffer.from(credsJson, 'utf8').toString('base64');
}

// --- Check and use SESSION_ID from .env/environment variables ---
async function checkEnvSession() {
    const envSessionID = process.env.SESSION_ID;
    if (envSessionID) {
        if (!envSessionID.includes("Gaanju:~")) {
            log("🚨 WARNING: Environment SESSION_ID is missing the required prefix 'Gaanju:~'. Assuming BASE64 format.", 'red');
        }
        global.SESSION_ID = envSessionID.trim();
        return true;
    }
    return false;
}

/**
 * Checks if SESSION_ID starts with "Gaanju:~". If not, cleans .env and restarts.
 */
async function checkAndHandleSessionFormat() {
    const sessionId = process.env.SESSION_ID;

    if (sessionId && sessionId.trim() !== '') {
        if (!sessionId.trim().startsWith('Gaanju:~')) {
            log(chalk.white.bgRed('[ERROR]: Invalid SESSION_ID in .env'), 'white');
            log(chalk.white.bgRed('[SESSION ID] MUST start with "Gaanju:~".'), 'white');
            log(chalk.white.bgRed('Cleaning .env and creating new one...'), 'white');

            try {
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace(/^SESSION_ID=.*$/m, 'SESSION_ID=');
                fs.writeFileSync(envPath, envContent);
                log('✅ Cleaned SESSION_ID entry in .env file.', 'green');
                log('Please add a proper session ID and restart the bot.', 'yellow');
            } catch (e) {
                log(`Failed to modify .env file. Please check permissions: ${e.message}`, 'red', true);
            }

            log('Bot will wait 20 seconds then restart', 'blue');
            await delay(20000);
            process.exit(1);
        }
    }
}


// --- Get login method ---
async function getLoginMethod() {
    const lastMethod = await getLastLoginMethod();
    if (lastMethod && sessionExists()) {
        log(`Last login method detected: ${lastMethod}. Using it automatically.`, 'blue');
        return lastMethod;
    }

    if (!sessionExists() && fs.existsSync(loginFile)) {
        log(`Session files missing. Removing old login preference for clean re-login.`, 'blue');
        fs.unlinkSync(loginFile);
    }

    if (!process.stdin.isTTY) {
        log("❌ No Session ID found in environment variables.", 'red');
        process.exit(1);
    }

    log("Choose login method:", 'yellow');
    log("1) Enter WhatsApp Number (Pairing Code)", 'blue');
    log("2) Paste Session ID (Gaanju:~...)", 'blue');

    let choice = await question("Enter option number (1 or 2): ");
    choice = choice.trim();

    if (choice === '1') {
        let phone = await question(chalk.bgBlack(chalk.greenBright(`Enter your WhatsApp number (e.g., 2348069675806): `)));
        phone = phone.replace(/[^0-9]/g, '');
        const pn = require('awesome-phonenumber');
        if (!pn('+' + phone).isValid()) { log('Invalid phone number.', 'red'); return getLoginMethod(); }
        global.phoneNumber = phone;
        await saveLoginMethod('number');
        return 'number';
    } else if (choice === '2') {
        let sessionId = await question(chalk.bgBlack(chalk.greenBright(`Paste your Session ID here (Gaanju:~...): `)));
        sessionId = sessionId.trim();
        if (!sessionId.startsWith("Gaanju:~")) {
            log("Invalid Session ID format! Must start with 'Gaanju:~'.", 'red');
            process.exit(1);
        }
        global.SESSION_ID = sessionId;
        await saveLoginMethod('session');
        return 'session';
    } else {
        log("Invalid option! Please choose 1 or 2.", 'red');
        return getLoginMethod();
    }
}

// --- Download/restore session from Session ID ---
async function downloadSessionData() {
    try {
        await fs.promises.mkdir(sessionDir, { recursive: true });
        if (!fs.existsSync(credsPath) && global.SESSION_ID) {
            const base64Data = global.SESSION_ID.includes("GAAJU-MD:")
                ? global.SESSION_ID.split("GAAJU-MD:")[1]
                : global.SESSION_ID;
            const sessionData = Buffer.from(base64Data, 'base64');
            await fs.promises.writeFile(credsPath, sessionData);
            log(`Session successfully saved.`, 'green');
        }
    } catch (err) { log(`Error downloading session data: ${err.message}`, 'red', true); }
}

// --- Request pairing code ---
async function requestPairingCode(socket) {
    try {
        log("Waiting 3 seconds for socket stabilization before requesting pairing code...", 'yellow');
        await delay(3000);

        let code = await socket.requestPairingCode(global.phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        log(chalk.bgGreen.black(`\nYour Pairing Code: ${code}\n`), 'white');
        log(`
Please enter this code in WhatsApp app:
1. Open WhatsApp
2. Go to Settings => Linked Devices
3. Tap "Link a Device"
4. Enter the code shown above
        `, 'blue');
        return true;
    } catch (err) {
        log(`Failed to get pairing code: ${err.message}`, 'red', true);
        return false;
    }
}

// --- Post-connection welcome message + session ID display ---
async function sendWelcomeMessage(XeonBotInc) {
    if (global.isBotConnected) return;

    // Wait for connection to fully stabilize
    await delay(10000);

    const detectPlatform = () => {
        if (process.env.DYNO) return "☁️ Heroku";
        if (process.env.RENDER) return "⚡ Render";
        if (process.env.PREFIX && process.env.PREFIX.includes("termux")) return "📱 Termux";
        if (process.env.PORTS && process.env.CYPHERX_HOST_ID) return "🌀 CypherX Platform";
        if (process.env.P_SERVER_UUID) return "🖥️ Panel";
        if (process.env.LXC) return "📦 Linux Container (LXC)";
        switch (os.platform()) {
            case "win32":  return "🪟 Windows";
            case "darwin": return "🍎 macOS";
            case "linux":  return "🐧 Linux";
            default:       return "❓ Unknown";
        }
    };

    const hostName = detectPlatform();

    try {
        const { getPrefix } = require('./commands/setprefix');
        if (!XeonBotInc.user || global.isBotConnected) return;

        global.isBotConnected = true;
        const pNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
        let data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
        const currentMode = data.isPublic ? 'public' : 'private';
        const prefix = getPrefix();

        // After pairing via phone number → encode and display the session ID
        let sessionLine = '';
        if (global.loginMethodUsed === 'number') {
            try {
                const raw = fs.readFileSync(credsPath, 'utf8');
                const encoded = encodeSessionId(raw);
                // Save to file for easy copy
                const dataDir = path.join(__dirname, 'data');
                if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
                fs.writeFileSync(path.join(dataDir, 'session_id.txt'), encoded, 'utf8');
                log(chalk.bgGreen.black(`\n✅ YOUR SESSION ID (copy this to your .env as SESSION_ID=):\n`), 'white');
                log(chalk.bgBlack.white(encoded), 'white');
                log(chalk.green(`\n📄 Also saved to: ./data/session_id.txt\n`), 'white');
                sessionLine = `\n┃✧ Session ID: saved to ./data/session_id.txt`;
            } catch (e) {
                log(`Could not encode session ID: ${e.message}`, 'red', true);
            }
        }

        await XeonBotInc.sendMessage(pNumber, {
            text:
`┏━━━━━✧ CONNECTED ✧━━━━━━━
┃✧ Prefix: [ ${prefix} ]
┃✧ Mode: ${currentMode}
┃✧ Platform: ${hostName}
┃✧ Bot: GAAJU-XMD
┃✧ Status: Active ✅
┃✧ Time: ${new Date().toLocaleString()}
┃✧ YouTube: youtube.com/@Xchristech
┃✧ GitHub: github.com/Xchristech2
┃✧ Telegram: t.me/Official_ChrisGaaju${sessionLine}
┗━━━━━━━━━━━━━━━━━━━━━`
        });

        log('✅ Bot successfully connected to WhatsApp.', 'green');

        // Auto-follow newsletters
        const newsletters = ["120363406588763460@newsletter", ""];
        global.newsletters = newsletters;
        for (let i = 0; i < newsletters.length; i++) {
            try {
                await XeonBotInc.newsletterFollow(newsletters[i]);
                console.log(chalk.blue(`✅ Auto-followed newsletter successfully`));
            } catch (e) {
                if (!e.message?.includes('already') && !e.message?.includes('conflict') && !e.message?.includes('unexpected')) {}
            }
        }

        // Auto-join groups
        const groupInvites = ["HgGLuDF6ZNABneNTbdrtUQ", ""];
        global.groupInvites = groupInvites;
        for (let i = 0; i < groupInvites.length; i++) {
            try {
                await XeonBotInc.groupAcceptInvite(groupInvites[i]);
                console.log(chalk.green(`✅ Auto-joined group successfully`));
            } catch (e) {
                if (!e.message?.includes('conflict') && !e.message?.includes('already')) {}
            }
        }

        // Reset error counter on successful connection
        deleteErrorCountFile();
        global.errorRetryCount = 0;

    } catch (e) {
        log(`Error sending welcome message during stabilization: ${e.message}`, 'red', true);
        global.isBotConnected = false;
    }
}

/**
 * Handles persistent 408 (timeout) errors.
 * @param {number} statusCode The disconnect status code.
 */
async function handle408Error(statusCode) {
    if (statusCode !== DisconnectReason.connectionTimeout) return false;

    global.errorRetryCount++;
    let errorState = loadErrorCount();
    const MAX_RETRIES = 3;

    errorState.count = global.errorRetryCount;
    errorState.last_error_timestamp = Date.now();
    saveErrorCount(errorState);

    log(`Connection Timeout (408) detected. Retry count: ${global.errorRetryCount}/${MAX_RETRIES}`, 'yellow');

    if (global.errorRetryCount >= MAX_RETRIES) {
        log(chalk.white.bgRed(`[MAX CONNECTION TIMEOUTS] (${MAX_RETRIES}) REACHED IN ACTIVE STATE.`), 'white');
        log(chalk.white.bgRed('This indicates a persistent network or session issue.'), 'white');
        log(chalk.white.bgRed('Exiting process to stop infinite restart loop.'), 'white');

        deleteErrorCountFile();
        global.errorRetryCount = 0;

        await delay(5000);
        process.exit(1);
    }
    return true;
}


// --- Start bot ---
async function startXeonBotInc() {
    log('Connecting to WhatsApp...', 'cyan');
    const { version } = await fetchLatestBaileysVersion();

    await fs.promises.mkdir(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    const msgRetryCounterCache = new NodeCache();

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid);
            let msg = await store.loadMessage(jid, key.id);
            return msg?.message || "";
        },
        msgRetryCounterCache
    });

    store.bind(XeonBotInc.ev);

    // --- 🚨 MESSAGE LOGGER ---
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        for (const msg of chatUpdate.messages) {
            if (!msg.message) continue;
            let chatId = msg.key.remoteJid;
            let messageId = msg.key.id;
            if (!global.messageBackup[chatId]) { global.messageBackup[chatId] = {}; }
            let textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || null;
            if (!textMessage) continue;
            let savedMessage = { sender: msg.key.participant || msg.key.remoteJid, text: textMessage, timestamp: msg.messageTimestamp };
            if (!global.messageBackup[chatId][messageId]) { global.messageBackup[chatId][messageId] = savedMessage; saveStoredMessages(global.messageBackup); }
        }

        // --- CORE MESSAGE HANDLER ---
        const mek = chatUpdate.messages[0];
        if (!mek.message) return;
        mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
        if (mek.key.remoteJid === 'status@broadcast') { await handleStatus(XeonBotInc, chatUpdate); return; }
        try { await handleMessages(XeonBotInc, chatUpdate, true) } catch (e) { log(e.message, 'red', true) }
    });


    // --- ⚠️ CONNECTION UPDATE LISTENER ---
    XeonBotInc.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            global.isBotConnected = false;

            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const permanentLogout = statusCode === DisconnectReason.loggedOut || statusCode === 401;

            if (permanentLogout) {
                log(chalk.bgRed.black(`\n💥 Disconnected! Status Code: ${statusCode} [LOGGED OUT].`), 'red');
                log('🗑️ Deleting session folder...', 'yellow');

                clearSessionFiles();

                log('Session, login preference, and error count cleaned...', 'red');
                log('Initiating full process restart in 5 seconds...', 'blue');
                await delay(5000);
                process.exit(1);

            } else {
                const is408Handled = await handle408Error(statusCode);
                if (is408Handled) return;

                log(`Connection closed due to temporary issue (Status: ${statusCode}). Attempting reconnect...`, 'yellow');
                startXeonBotInc();
            }

        } else if (connection === 'open') {
            console.log(chalk.yellow(`💅 Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)))
            log('GAAJU-XMD Connected ✅', 'yellow');
            log(`GitHub: Xchristech2 | YouTube: @Xchristech`, 'yellow');

            await sendWelcomeMessage(XeonBotInc);
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupParticipantUpdate(XeonBotInc, update);
        } catch (e) {
            log(`Group participant update error: ${e.message}`, 'red', true);
        }
    });

    XeonBotInc.public = true;
    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store);

    // --- ⚙️ BACKGROUND INTERVALS ---

    // 1. Session File Cleanup (every 2 hours)
    setInterval(() => {
        try {
            const sessionPath = path.join(sessionDir);
            if (!fs.existsSync(sessionPath)) return;
            fs.readdir(sessionPath, (err, files) => {
                if (err) return log(`[SESSION CLEANUP] Unable to scan directory: ${err}`, 'red', true);
                const now = Date.now();
                const filteredArray = files.filter((item) => {
                    const filePath = path.join(sessionPath, item);
                    try {
                        const stats = fs.statSync(filePath);
                        return ((item.startsWith("pre-key") || item.startsWith("sender-key") || item.startsWith("session-") || item.startsWith("app-state")) &&
                            item !== 'creds.json' && now - stats.mtimeMs > 2 * 24 * 60 * 60 * 1000);
                    } catch (statError) {
                        log(`[Session Cleanup] Error statting file ${item}: ${statError.message}`, 'red', true);
                        return false;
                    }
                });
                if (filteredArray.length > 0) {
                    log(`[Session Cleanup] Found ${filteredArray.length} old session files. Clearing...`, 'yellow');
                    filteredArray.forEach((file) => {
                        const filePath = path.join(sessionPath, file);
                        try { fs.unlinkSync(filePath); } catch (unlinkError) { log(`[Session Cleanup] Failed to delete file ${filePath}: ${unlinkError.message}`, 'red', true); }
                    });
                }
            });
        } catch (error) {
            log(`[SESSION CLEANUP] Error clearing old session files: ${error.message}`, 'red', true);
        }
    }, 7200000);

    // 2. Message Store Cleanup (every hour)
    const cleanupInterval = 60 * 60 * 1000;
    setInterval(cleanupOldMessages, cleanupInterval);

    // 3. Junk File Cleanup (every 30s)
    const junkInterval = 30_000;
    setInterval(() => cleanupJunkFiles(XeonBotInc), junkInterval);

    return XeonBotInc;
}

// --- Core Session Integrity Check ---
async function checkSessionIntegrityAndClean() {
    const isSessionFolderPresent = fs.existsSync(sessionDir);
    const isValidSession = sessionExists();

    if (isSessionFolderPresent && !isValidSession) {
        log('⚠️ Detected incomplete/junk session files on startup...', 'red');
        log('✅ Cleaning up before proceeding...', 'yellow');

        clearSessionFiles();

        log('Cleanup complete. Waiting 3 seconds for stability...', 'yellow');
        await delay(3000);
    }
}


// --- 🌟 .env File Watcher for Automated Restart ---
function checkEnvStatus() {
    try {
        log(`║ [WATCHER] .env ║`, 'green');

        fs.watch(envPath, { persistent: false }, (eventType, filename) => {
            if (filename && eventType === 'change') {
                log(chalk.bgRed.black('================================================='), 'white');
                log(chalk.white.bgRed(' [ENV] env file change detected!'), 'white');
                log(chalk.white.bgRed('Forcing a clean restart to apply new configuration (e.g., SESSION_ID).'), 'white');
                log(chalk.red.bgBlack('================================================='), 'white');
                process.exit(1);
            }
        });
    } catch (e) {
        log(`❌ Failed to set up .env file watcher (fs.watch error): ${e.message}`, 'red', true);
    }
}


// --- Main login flow ---
async function tylor() {

    // 1. Load all core modules
    try {
        require('./settings')
        const mainModules = require('./main');
        handleMessages = mainModules.handleMessages;
        handleGroupParticipantUpdate = mainModules.handleGroupParticipantUpdate;
        handleStatus = mainModules.handleStatus;

        const myfuncModule = require('./lib/myfunc');
        smsg = myfuncModule.smsg;

        store = require('./lib/lightweight_store')
        store.readFromFile()
        settings = require('./settings')
        setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

        log("✨ Core files loaded successfully.", 'green');
    } catch (e) {
        log(`FATAL: Failed to load core files. ${e.message}`, 'red', true);
        process.exit(1);
    }

    // 2. Check SESSION_ID prefix format BEFORE connecting
    await checkAndHandleSessionFormat();

    // 3. Restore in-memory error retry count from disk
    global.errorRetryCount = loadErrorCount().count;
    log(`Retrieved initial 408 retry count: ${global.errorRetryCount}`, 'yellow');

    // 4. *** PRIORITY: Check .env SESSION_ID FIRST ***
    const envSessionID = process.env.SESSION_ID?.trim();

    if (envSessionID && envSessionID.startsWith('Gaanju:~')) {
        log("Found SESSION_ID in environment variable.", 'magenta');

        // Force use of new session by clearing any old persistent files
        clearSessionFiles();

        global.SESSION_ID = envSessionID;
        global.loginMethodUsed = 'session';
        await downloadSessionData();
        await saveLoginMethod('session');

        log("Valid session found from .env — connecting...", 'green');
        log('Waiting 3 seconds for stable connection...', 'yellow');
        await delay(3000);
        await startXeonBotInc();

        checkEnvStatus(); // Start .env file watcher
        return;
    }

    // If environment session is NOT set or not valid, continue with fallback logic
    log("[ALERT] No SESSION_ID found in .env", 'blue');
    log("Falling back to stored session....", 'blue');

    // 5. Run mandatory integrity check and cleanup
    await checkSessionIntegrityAndClean();

    // 6. Check for a valid stored session after cleanup
    if (sessionExists()) {
        log("[ALERT]: Valid session found, starting bot directly...", 'green');
        log('[ALERT]: Waiting 3 seconds for stable connection...', 'blue');
        await delay(3000);
        await startXeonBotInc();

        checkEnvStatus(); // Start .env file watcher
        return;
    }

    // 7. New Login Flow (no valid session exists anywhere)
    const loginMethod = await getLoginMethod();
    global.loginMethodUsed = loginMethod;
    let XeonBotInc;

    if (loginMethod === 'session') {
        await downloadSessionData();
        XeonBotInc = await startXeonBotInc();
    } else if (loginMethod === 'number') {
        XeonBotInc = await startXeonBotInc();
        await requestPairingCode(XeonBotInc);
    } else {
        log("[ALERT]: Failed to get valid login method.", 'red');
        return;
    }

    // 8. Cleanup if number login failed before creds.json was written
    if (loginMethod === 'number' && !sessionExists() && fs.existsSync(sessionDir)) {
        log('[ALERT]: Login interrupted [FAILED]. Clearing temporary session files...', 'red');
        log('[ALERT]: Restarting...', 'red');

        clearSessionFiles();
        process.exit(1);
    }

    // 9. Start the file watcher after interactive login completes
    checkEnvStatus();
}

// --- Start ---
tylor().catch(err => log(`Fatal error starting bot: ${err.message}`, 'red', true));
process.on('uncaughtException', (err) => log(`Uncaught Exception: ${err.message}`, 'red', true));
process.on('unhandledRejection', (err) => log(`Unhandled Rejection: ${err.message}`, 'red', true));
