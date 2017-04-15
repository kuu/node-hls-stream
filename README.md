[![Build Status](https://travis-ci.org/kuu/node-hls-stream.svg?branch=master)](https://travis-ci.org/kuu/node-hls-stream)
[![Coverage Status](https://coveralls.io/repos/github/kuu/node-hls-stream/badge.svg?branch=master)](https://coveralls.io/github/kuu/node-hls-stream?branch=master)
[![Dependency Status](https://gemnasium.com/badges/github.com/kuu/node-hls-stream.svg)](https://gemnasium.com/github.com/kuu/node-hls-stream)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)

# node-hls-stream

A readable/writable stream that can be used for manipulating a live/VOD HLS stream

## Features
* Provides a readable stream that can be used for extracting a particular variant/rendition from a running live/VOD HLS stream
  * Downloads and parses HLS playlist and segment files based on [the spec](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21).
  * Enables clients to choose a specific variant with specific rendition(s) to download.
  * Provides parsed playlists and segments as structured JS objects.
* Provides a writable stream that can be used for generating HLS playlist/segment files in realtime
  * Enables clients to describe playlists/segments as JS objects.
  * Converts the JS objects into HLS playlist and segment files that conform to [the spec](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21).


## Usage
### Readable
```js
const {createReadStream} = require('node-hls-stream');
// Create a readable stream from a URL
const stream = createReadStream('https://foo.com/bar.m3u8', {concurrency: 7});

stream.on('variants', (variants, cb) => {
  // Choose an appropriate variant
  for (let [index, variant] of variants.entries()) {
    if (variant.bandwidth === TARGET_BITRATE) {
      return cb(index);
    }
  }
  // If not specified, the first (index=0) variant will be used.
})
.on('renditions', (renditions, cb) => {
  // Choose an appropriate rendition
  for (let [index, rendition] of renditions.entries()) {
    if (rendition.type === 'AUDIO' && rendition.language === 'ja') {
      return cb(index);
    }
  }
  // If not specified, the default rendition will be used.
  // If there's no default rendition, the first (index=0) rendition will be used.
})
.on('data', data => {
  // The stream chosen above will be delivered here
  if (data.type === 'playlist') {
    const playlist = data;
    if (playlist.isMasterPlaylist) {
      console.log(`Master playlist`);
    } else {
      console.log(`Media playlist`);
    }
  } else if (data.type === 'segment') {
    const segment = data;
    console.log(`#${segment.mediaSequenceNumber}: duration = ${segment.duration}, byte length = ${segment.data.length}`);
  }
})
.on('end', () => {
  // For VOD streams, the stream ends after all data is consumed.
  // For Live streams, the stream continues until the ENDLIST tag.
  console.log('Done');
})
.on('error', err => {
  console.error(err.stack);
});

// To switch to another stream:
stream.updateVariant(); // 'variants' and 'renditions' events will be emitted again.
```
### Writable
```js
const {createWriteStream, types: {MediaPlaylist}} = require('node-hls-stream');
// Create a writable stream from a filepath
const stream = createWriteStream('./sample.m3u8');

stream.write(new MediaPlaylist({
  targetDuration: 9,
  playlistType: 'VOD',
  segments: [
    new Segment({uri: '', duration: 9})
  ]
}));
```

## API
These features are provided via a `ReadStream`.
### `createReadStream(url[, options])`
Creates a new `ReadStream` object.
#### params
| Name    | Type   | Required | Default | Description   |
| ------- | ------ | -------- | ------- | ------------- |
| url     | string | Yes      | N/A     | Playlist URL  |
| options | object | No       | {}      | See below     |
#### options
| Name        | Type   | Default | Description                       |
| ----------- | ------ | ------- | --------------------------------- |
| concurrency | number | 6       | Max number of requests concurrently processed |
#### return value
An instance of `ReadStream`.

### `ReadStream`
A subclass of [stream.Readable](https://nodejs.org/api/stream.html#stream_readable_streams) with additional events and methods as follows.
#### events
##### `'variants'`
`variants` event is emitted to let clients specify which variant to be downloaded. The event listener is called with the following arguments:

| Name     | Type       | Description                                       |
| -------- | ---------- | ------------------------------------------------- |
| variants | [`Variant`]    | A list of available variants                |
| cb       | `function` | A callback function to be called by the client to specify the variant's index within the array.  |
##### `'renditions'`
`renditions` event is emitted to let clients specify which rendition to be downloaded. The event listener is called with the following arguments:

| Name       | Type       | Description                                       |
| ---------- | ---------- | ------------------------------------------------- |
| renditions | [`Rendition`]    | A list of available renditions              |
| cb         | `function` | A callback function to be called by the client to specify the rendition's index within the array.  |
##### `'data'`
`data` event is emitted when a playlist or segment is available. The event listener is called with the following arguments:

| Name    | Type      | Description              |
| ------- | --------- | ------------------------ |
| data | `Data` | An instance of either of `Segment`, `MasterPlaylist` or `MediaPlaylist` |
#### methods
##### `updateVariant()`
Emits `variants`/`renditions` events again so that the client can choose another variant/rendition. The method takes no params and returns no value.
