const state = require('./state.js');
const gm = require('gm').subClass({imageMagick: true});
const videoshow = require('videoshow');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

async function robot() {
    const content = state.load();

    await convertAllImages(content);
    await createYoutubeThumbnail();
    await createFFmpegScript(content);
    await renderVideoWithFFmpegAndNode(content);

    state.save(content);
}

async function convertAllImages(content) {
    for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
        await convertImage(sentenceIndex);
    }
}

async function convertImage(sentenceIndex) {
    return new Promise((resolve, reject) => {
        const inputFile = `./content/${sentenceIndex}-original.png[0]`;
        const outputFile = `./content/${sentenceIndex}-converted.png`;
        const width = 1920;
        const height = 1080;

        gm()
            .in(inputFile)
            .out('(')
                .out('-clone')
                .out('0')
                .out('-background', 'white')
                .out('-blur', '0x9')
                .out('-resize', `${width}x${height}^`)
            .out(')')
            .out('(')
                .out('-clone')
                .out('0')
                .out('-background', 'white')
                .out('-resize', `${width}x${height}`)
            .out(')')
            .out('-delete', '0')
            .out('-gravity', 'center')
            .out('-compose', 'over')
            .out('-composite')
            .out('-extent', `${width}x${height}`)
            .write(outputFile, (error) => {
                if(error) {
                    return reject(error);
                }
                console.log(`> Image converted: ${inputFile}`);
                resolve();
            })
    
    });
}

async function createYoutubeThumbnail() {
    return new Promise((resolve, reject) => {
        gm()
            .in('./content/0-converted.png')
            .write('./content/youtube-thumbnail.jpg', (error) => {
                if(error) {
                    return reject(error);
                }
                console.log('> Creating Youtube Thumbnail');
                resolve();
            });
    })
}

async function createFFmpegScript(content) {
    await state.saveScript(content);
}

async function renderVideoWithFFmpegAndNode(content) {
    return new Promise((resolve, reject) => {
        const images = buildImagesArray(content);
        
        const audio = path.join(__dirname, '../templates/1/newsroom.mp3');
        const video = path.join(__dirname, '../content/video-maker.mp4');

        const audioParams = { fade: true, delay: 1 };

        const videoOptions = {
            fps: 30,
            loop: 5, // seconds
            transition: true,
            transitionDuration: 1, // seconds
            videoBitrate: 1024,
            videoCodec: 'libx264',
            size: '640x?',
            audioBitrate: '128k',
            audioChannels: 2,
            format: 'mp4',
            pixelFormat: 'yuv420p',
            useSubRipSubtitles: false,
            subtitleStyle: {
                Fontname: 'Verdana',
                Fontsize: '60',
                PrimaryColour: '11861244',
                SecondaryColour: '11861244',
                TertiaryColour: '11861244',
                BackColour: '-2147483640',
                Bold: '2',
                Italic: '0',
                BorderStyle: '2',
                Outline: '2',
                Shadow: '3',
                Alignment: '1',
                MarginL: '40',
                MarginR: '60',
                MarginV: '40'
            }
        };

        videoshow(images, videoOptions)
            .audio(audio, audioParams)
            .save(video)
            .on('error', function(err, stdout, stderr) {
                console.error('Error: ', err);
                console.error('ffmpeg stderr: ', stderr);
                reject(error);
            })
            .on('end', function(output) {
                resolve();
            });
    });
}

function buildImagesArray(content) {
    let images = [];

    for(let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
        images.push({
            path: `./content/${sentenceIndex}-converted.png`,
            caption: content.sentences[sentenceIndex].text
        });
    }

    return images;
}
module.exports = robot;