const {createReadStream} = require('..');

module.exports = function () {
  return new Promise((resolve, reject) => {
    const stream = createReadStream('https://nhkworld.webcdn.stream.ne.jp/www11/nhkworld-tv/domestic/263942/live_wa_s.m3u8', {concurrency: 7});
    // let counter = 0;

    stream.on('variants', (variants, cb) => {
      // Choose variants
      const variantsToLoad = [];
      console.log(`${variants.length} variants available:`);
      for (const [index, variant] of variants.entries()) {
        console.log(`\tvariant[${index}] : ${variant.bandwidth} bps, ${variant.uri}`);
        variantsToLoad.push(index);
      }
      cb(variantsToLoad);
    })
    .on('renditions', (renditions, cb) => {
      // Choose renditions
      const renditionsToLoad = [];
      console.log(`${renditions.length} renditions available:`);
      for (const [index, rendition] of renditions.entries()) {
        console.log(`\trendition[${index}] : type = ${rendition.type}, name = ${rendition.name}, isDefault = ${rendition.isDefault}`);
        renditionsToLoad.push(index);
      }
      cb(renditionsToLoad);
    })
    // .on('data', function onData(data) {
    .on('data', data => {
      if (data.type === 'playlist') {
        const playlist = data;
        console.log('===');
        if (playlist.isMasterPlaylist) {
          console.log('Master playlist available');
        } else {
          console.log('Media playlist available:');
          console.log(`\tisIFrame = ${playlist.isIFrame}`);
          console.log(`\ttype = ${playlist.playlistType}`);
          console.log(`\tendlist = ${playlist.endlist}`);
        }
        console.log('---');
        console.log(playlist.source);
        console.log('===');
      } else if (data.type === 'segment') {
        const segment = data;
        console.log(`#${segment.mediaSequenceNumber}: duration = ${segment.duration}, type = ${segment.mimeType}, byte length = ${segment.data.length}, key = ${segment.key}`);
        /*
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
        */
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
