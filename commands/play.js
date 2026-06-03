const yts = require('yt-search');
const axios = require('axios');

async function playCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: '*What song do you want to download?*'
            });
        }

        const { videos } = await yts(searchQuery);

        if (!videos || !videos.length) {
            return await sock.sendMessage(chatId, {
                text: '*No songs found!*'
            });
        }

        const video = videos[0];

        await sock.sendMessage(chatId, {
            text: '*🎵 Please wait, your download is being prepared...*'
        });

        const { data } = await axios.get(
            `https://api.neosoft.best/api/downloader/youtube?url=${encodeURIComponent(video.url)}`,
            {
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        );

        if (!data?.status || !data?.download) {
            return await sock.sendMessage(chatId, {
                text: '*Failed to get audio download link.*'
            });
        }

        await sock.sendMessage(
            chatId,
            {
                image: { url: data.thumbnail || video.thumbnail },
                caption: `🎵 *${data.title || video.title}*

⏱ Duration: ${data.duration || video.seconds || 'Unknown'} sec`
            },
            { quoted: message }
        );

        await sock.sendMessage(
            chatId,
            {
                audio: {
                    url: data.download
                },
                mimetype: 'audio/mpeg',
                fileName: `${(data.title || video.title)
                    .replace(/[^\w\s]/gi, '')
                    .trim()}.mp3`,
                ptt: false
            },
            { quoted: message }
        );

    } catch (error) {
        console.error('Error in play command:', error);

        await sock.sendMessage(chatId, {
            text: '*❌ Download failed. Please try again later.*'
        });
    }
}

module.exports = playCommand;
