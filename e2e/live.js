const {ReadStream} = require('../lib');

module.exports = function () {
  return new Promise((resolve, reject) => {
    const stream = new ReadStream('https://nhkworld.webcdn.stream.ne.jp/www11/nhkworld-tv/domestic/263942/live_wa_s.m3u8', {concurrency: 7});
    let counter = 0;

    stream.on('playlist', playlist => {
      console.log('===');
      if (playlist.isMasterPlaylist) {
        console.log(`Master playlist available`);
      } else {
        console.log(`Media playlist available:`);
        console.log(`\tisIFrame = ${playlist.isIFrame}`);
        console.log(`\ttype = ${playlist.playlistType}`);
        console.log(`\tendlist = ${playlist.endlist}`);
      }
      console.log('---');
      console.log(playlist.source);
      console.log('===');
    })
    .on('variants', (variants, cb) => {
      // Choose an appropriate variant
      console.log(`${variants.length} variants available:`);
      for (const [index, variant] of variants.entries()) {
        console.log(`\tvariant[${index}] : ${variant.bandwidth} bps, ${variant.uri.href}`);
      }
      // If not specified, the first (index=0) variant will be used.
      cb(0);
    })
    .on('renditions', (renditions, cb) => {
      console.log(`${renditions.length} renditions available:`);
      for (const [index, rendition] of renditions.entries()) {
        console.log(`\trendition[${index}] : type = ${rendition.type}, name = ${rendition.name}, isDefault = ${rendition.isDefault}`);
      }
      // If not specified, the default rendition will be used.
      // If there's no default rendition, the first (index=0) rendition will be used.
      cb(0);
    })
    .on('data', function onData(segment) {
      console.log(`#${segment.mediaSequenceNumber}: duration = ${segment.duration}, type = ${segment.mimeType}, byte length = ${segment.data.length}, key = ${segment.key}`);
      if (counter++ === 12) {
        stream.removeListener('data', onData);
        stream.pause();
        console.log('\t!!!stream.pause()');
        setTimeout(() => {
          stream.on('data', onData);
          stream.resume();
          console.log('\t!!!stream.resume()');
        }, 20000);
      }
    })
    .on('end', () => {
      resolve('Done');
    })
    .on('error', err => {
      reject(err);
    });
  });
};
