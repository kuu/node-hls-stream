const {ReadStream} = require('../lib');

module.exports = function () {
  return new Promise((resolve, reject) => {
    // const stream = new ReadStream('https://devimages.apple.com.edgekey.net/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8', {concurrency: 7});
    // const stream = new ReadStream('https://devimages.apple.com.edgekey.net/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8', {concurrency: 7});
    // const stream = new ReadStream('https://tungsten.aaplimg.com/VOD/bipbop_adv_example_v2/master.m3u8', {concurrency: 7});
    const stream = new ReadStream('http://player.ooyala.com/player/all/tzNDI1NzE6gt3qQPR46SU5yi9lDEYLRJ.m3u8?targetBitrate=2000&secure_ios_token=dXZRMUkyeDZzcysrd3BROHJGSkdwRTNyQk1GRnJiVVh6TjFhYnA1QXIwNVNmOThNL3IwNGo5WDhVY1lzCmpqWmdHcitwZW5va0FodnBxMVlkb1dOU1h3PT0K', {concurrency: 7});
    // const stream = new ReadStream('http://player.ooyala.com/player/all/44YTc5NjE6pHaw1F7e46rrYN839jI0BB.m3u8?secure_ios_token=TG51d1IxUzc5ZnNmQ21ZSUlqTUorQXVFZmVpWWpnbURiN3hMK1N1V2gwNlB1WVlVa0oyOVRKRWwvTHZ5CkxuTGk3TDFob3ZmVnhBZ1pSU21FWmgrRzFnPT0K');

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
    .on('data', segment => {
      console.log(`#${segment.mediaSequenceNumber}: duration = ${segment.duration}, type = ${segment.mimeType}, byte length = ${segment.data.length}, key.length = ${segment.key ? segment.key.data.length : 'none'}`);
    })
    .on('end', () => {
      resolve('Done');
    })
    .on('error', err => {
      reject(err);
    });
  });
};
