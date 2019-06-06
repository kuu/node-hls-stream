[![Build Status](https://travis-ci.org/kuu/node-hls-stream.svg?branch=master)](https://travis-ci.org/kuu/node-hls-stream)
[![Coverage Status](https://coveralls.io/repos/github/kuu/node-hls-stream/badge.svg?branch=master)](https://coveralls.io/github/kuu/node-hls-stream?branch=master)
[![Dependency Status](https://david-dm.org/kuu/node-hls-stream.svg)](https://david-dm.org/kuu/node-hls-stream)
[![Development Dependency Status](https://david-dm.org/kuu/node-hls-stream/dev-status.svg)](https://david-dm.org/kuu/node-hls-stream#info=devDependencies)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)

# node-hls-stream

A readable/writable stream that can be used for manipulating a live/VOD HLS stream

## Features
* Provides a readable stream that can be used for extracting particular variants/renditions from a running live/VOD HLS stream
  * Downloads and parses HLS playlist and segment files based on [the spec](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21).
  * Enables clients to choose specific variant(s) with specific rendition(s) to download.
  * Provides parsed playlists and segments as structured JS objects.
* Provides a writable stream that can be used for generating HLS playlist/segment files in realtime
  * Enables clients to describe playlists/segments as JS objects.
  * Converts the JS objects into HLS playlist and segment files that conform to [the spec](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21).


## Usage
### Readable stream
```js
const {createReadStream} = require('node-hls-stream');
// Create a readable stream from a URL
const stream = createReadStream('https://foo.com/bar.m3u8', {concurrency: 7});

stream.on('variants', (variants, cb) => {
  // Choose variants
  const variantsToLoad = [];
  for (let [index, variant] of variants.entries()) {
    if (variant.bandwidth >= MIN_BITRATE) {
      variantsToLoad.push(index);
    }
  }
  return cb(variantsToLoad);
  // If not specified, all the variants will be loaded.
})
.on('renditions', (renditions, cb) => {
  // Choose renditions
  const renditionsToLoad = [];
  for (let [index, rendition] of renditions.entries()) {
    if (rendition.type === 'AUDIO') {
      renditionsToLoad.push(index);
    }
  }
  return cb(renditionsToLoad);
  // If not specified, all the renditions will be loaded.
})
.on('data', data => {
  // The streams chosen above will be delivered here
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

// To emit 'variants' and 'renditions' events again
stream.updateVariant();
```
### Writable stream
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
`variants` event is emitted to let clients specify which variants to be loaded. The event listener is called with the following arguments:

| Name     | Type       | Description                                       |
| -------- | ---------- | ------------------------------------------------- |
| variants | [`Variant`]    | A list of available variants                |
| cb       | `function` | A callback function used by the client to specify which variants to be loaded. `cb` takes a single argument of type `Array` which contains the index within `variants`.  |
##### `'renditions'`
`renditions` event is emitted to let clients specify which renditions to be loaded. The event listener is called with the following arguments:

| Name       | Type       | Description                                       |
| ---------- | ---------- | ------------------------------------------------- |
| renditions | [`Rendition`]    | A list of available renditions              |
| cb         | `function` | A callback function used by the client to specify which renditions to be loaded. `cb` takes a single argument of type `Array` which contains the index within `renditions`. |
##### `'data'`
`data` event is emitted when a playlist or segment is available. The event listener is called with the following arguments:

| Name    | Type      | Description              |
| ------- | --------- | ------------------------ |
| data | `Data` | An instance of either of `Segment`, `MasterPlaylist` or `MediaPlaylist` |
#### methods
##### `updateVariant()`
Emits `variants`/`renditions` events again so that the client can choose other variants/renditions. The method takes no params and returns no value.
