const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;

            if (attempt < attempts) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    throw lastError;
}

async function getNeoSoftDownload(youtubeUrl) {
    const apiUrl = `https://api.neosoft.best/api/downloader/youtube?url=${encodeURIComponent(youtubeUrl)}`;

    const res = await tryRequest(() =>
        axios.get(apiUrl, AXIOS_DEFAULTS)
    );

    if (res?.data?.download) {
        return {
            download: res.data.download,
            title: res.data.title,
            thumbnail: res.data.thumbnail,
            duration: res.data.duration
        };
    }

    throw new Error('NeoSoft API returned no download link');
}

async function songCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        if (!text) {
            return await sock.sendMessage(
                chatId,
                {
                    text: 'Usage: .song <song name or YouTube link>'
                },
                { quoted: message }
            );
        }

        let video;

        if (
            text.includes('youtube.com') ||
            text.includes('youtu.be')
        ) {
            video = {
                url: text,
                title: 'YouTube Audio',
                thumbnail: 'https://i.ytimg.com/vi/default/maxresdefault.jpg'
            };
        } else {
            const search = await yts(text);

            if (!search?.videos?.length) {
                return await sock.sendMessage(
                    chatId,
                    {
                        text: '❌ No results found.'
                    },
                    { quoted: message }
                );
            }

            video = search.videos[0];
        }

        const audioData = await getNeoSoftDownload(video.url);

        await sock.sendMessage(
            chatId,
            {
                image: {
                    url: audioData.thumbnail || video.thumbnail
                },
                caption: `🎵 *Downloading Song*
⏱ Duration: ${audioData.duration || video.timestamp || 'Unknown'} sec`
            },
            { quoted: message }
        );

        await sock.sendMessage(
            chatId,
            {
                audio: {
                    url: audioData.download
                },
                mimetype: 'audio/mpeg',
                fileName: `${audioData.title || video.title}.mp3`,
                ptt: false
            },
            { quoted: message }
        );
    } catch (err) {
        console.error('Song command error:', err);

        await sock.sendMessage(
            chatId,
            {
                text: '❌ Failed to download song. Please try again later.'
            },
            { quoted: message }
        );
    }
}

module.exports = songCommand;
