# node-hls-stream

A readable stream that can be used for extracting a particular variant/rendition from a live/VOD HLS stream

## Features
* Downloads and parses HLS playlist and segment files based on [the spec](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21).
* Enables clients to choose a specific variant with specific rendition(s) to download.
* Provides parsed playlists and segments as structured JS objects. (See **Data format** below)

## Usage

```js
const {createReadStream} = require('node-hls-stream');
// Create a readable stream from URL
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
| segment | `Segment` | An instance of `Segment` or `Playlist` |
#### methods
##### `updateVariant()`
Emits `variants`/`renditions` events again so that the client can choose another variant/rendition.The method takes no params and returns no value.

## Data format
As the readable stream returned by `createReadStream` is in object mode, all the data is represented in standard JS objects. This section describes the structure of the objects.

![data structure](./data-structure.png)

### `Data`
| Property         | Type          | Required | Default | Description   |
| ---------------- | ------------- | -------- | ------- | ------------- |
| `type` | string     | Yes      | N/A     | {`playlist`, `segment`}  |

### `Playlist` (extends `Data`)
| Property         | Type          | Required | Default | Description   |
| ---------------- | ------------- | -------- | ------- | ------------- |
| `isMasterPlaylist` | boolean     | Yes      | N/A     | `true` if this playlist is a master playlist  |
| `uri`              | `URL` (WHATWG) | Yes      | N/A     | Playlist URL  |
| `version`          | object | No       | undefined      | See [EXT-X-VERSION](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.1.2) |
| `independentSegments` | boolean | No       | false      | See [EXT-X-INDEPENDENT-SEGMENTS](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.5.1) |
| `offset` | object | No       | 0.0      | See [EXT-X-START](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.5.2) |
| `source` | string     | No      | undefined     | The unprocessed text of the playlist  |

### `MasterPlaylist` (extends `Playlist`)
| Property          | Type     | Required | Default   | Description   |
| ----------------- | -------- | -------- | --------- | ------------- |
| `variants`        | [`Variant`]  | No       | []        | See [ EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2) and [EXT-X-I-FRAME-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.3)  |
| `currentVariant`  | number   | No       | undefined | Array index that points to the chosen item in `variants` |
| `sessionDataList` | [`SessionData`]  | No       | []        | See [EXT-X-SESSION-DATA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.4) |
| `sessionKey`      | `Key`    | No       | undefined | See [EXT-X-SESSION-KEY](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.5) |

### `Variant`
| Property          | Type     | Required | Default   | Description   |
| ----------------- | -------- | -------- | --------- | ------------- |
| `uri`        | `URL` (WHATWG)  | Yes       | N/A        | URI of the variant playlist  |
| `isIFrameOnly`  | boolean   | No       | undefined | `true` if the variant is an I-frame media playlist. See [EXT-X-I-FRAME-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.3) |
| `bandwidth` | number  | Yes       | N/A        | See BANDWIDTH attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2) |
| `averageBandwidth`      | number    | No       | undefined | See AVERAGE-BANDWIDTH attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2) |
| `codecs`      | string    | No       | undefined | See CODECS attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2) |
| `resolution`      | object ({width: number, height: number})   | No       | undefined | See RESOLUTION attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2) |
| `frameRate`      | number    | No       | undefined | See FRAME-RATE attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2) |
| `hdcpLevel`      | string    | No       | undefined | See HDCP-LEVEL attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2) |
| `audio`      | [`Rendition`(type='AUDIO')]    | No       | [] | See AUDIO attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2) |
| `video`      | [`Rendition`(type='VIDEO')]    | No       | [] | See VIDEO attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2)  |
| `subtitles`      | [`Rendition`(type='SUBTITLES')]    | No       | [] | See SUBTITLES attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2)  |
| `closedCaptions`      | [`Rendition`(type='CLOSED-CAPTIONS')]    | No       | [] | See CLOSED-CAPTIONS attribute in [EXT-X-STREAM-INF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.2) |
| `currentRenditions`      | object ({AUDIO: number, VIDEO: number, SUBTITLES: number, CLOSED-CAPTIONS: number})   | No       | {} | A hash object that contains array indices that points to the chosen `Rendition` for each type |

### `Rendition`
| Property          | Type     | Required | Default   | Description   |
| ----------------- | -------- | -------- | --------- | ------------- |
| `type`  | string   | Yes       | N/A | See TYPE attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `uri`        | `URL` (WHATWG)  | No       | undefined        | See URI attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1)  |
| `groupId`  | string   | Yes       | N/A | See GROUP-ID attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `language` | string  | No       | undefined       | See LANGUAGE attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `assocLanguage` | string  | No       | undefined       | See ASSOC-LANGUAGE attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `name`  | string   | Yes       | N/A | See NAME attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `isDefault`  | boolean   | No       | false | See DEFAULT attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `autoselect`  | boolean   | No       | false | See AUTOSELECT attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `forced`  | boolean   | No       | false | See FORCED attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `instreamId`  | string   | No       | undefined | See INSTREAM-ID attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `characteristics`  | string   | No       | undefined | See CHARACTERISTICS attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |
| `channels`  | string   | No       | undefined | See CHANNELS attribute in [EXT-X-MEDIA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.1) |

### `SessionData`
| Property          | Type     | Required | Default   | Description   |
| ----------------- | -------- | -------- | --------- | ------------- |
| `id`  | string   | Yes       | N/A | See DATA-ID attribute in [EXT-X-SESSION-DATA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.4) |
| `value`  | string   | No       | undefined | See VALUE attribute in [EXT-X-SESSION-DATA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.4) |
| `uri`        | `URL` (WHATWG)  | No       | undefined        | See URI attribute in [EXT-X-SESSION-DATA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.4)  |
| `data`        | object | No       | undefined        | If `uri` is specified, the downloaded JSON data  |
| `language`  | string   | No       | undefined | See LANGUAGE attribute in [EXT-X-SESSION-DATA](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.4.4) |

### `MediaPlaylist` (extends `Playlist`)
| Property                    | Type     | Required | Default   | Description   |
| --------------------------- | -------- | -------- | --------- | ------------- |
| `targetDuration`            | number | Yes       | N/A        | See [EXT-X-TARGETDURATION](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.3.1) |
| `mediaSequenceBase`         | number | No       | 0        | See [EXT-X-MEDIA-SEQUENCE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.3.2) |
| `discontinuitySequenceBase` | number | No       | 0        | See [EXT-X-DISCONTINUITY-SEQUENCE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.3.3) |
| `endlist`                   | boolean | No       | false        | See [EXT-X-ENDLIST](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.3.4) |
| `playlistType`              | string | No       | undefined        | See [EXT-X-PLAYLIST-TYPE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.3.5) |
| `isIFrame`                  | boolean | No       | undefined        | See [EXT-X-I-FRAMES-ONLY](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.3.6) |
| `segments`                  | [`Segment`] | No       | []        | A list of available segments |

### `Segment` (extends `Data`)
| Property          | Type     | Required | Default   | Description   |
| ----------------- | -------- | -------- | --------- | ------------- |
| `uri`        | `URL` (WHATWG)  | Yes       | N/A        | URI of the media segment |
| `mimeType`        | string  | No       | undefined        | MIME type of the media segment |
| `data`        | `Buffer`   | No       | undefined        | downloaded data for the `uri` (the data is trimmed based on the `byterange`) |
| `duration`  | number   | Yes       | N/A | See [EXTINF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.1) |
| `title`  | string   | No       | undefined | See [EXTINF](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.1) |
| `byterange`  | object ({length: number, offset: number})   | No       | undefined | See [EXT-X-BYTERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.2) |
| `discontinuity`  | boolean   | No       | undefined | See [EXT-X-DISCONTINUITY](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.3) |
| `mediaSequenceNumber`  | number   | Yes       | N/A | See the description about 'Media Sequence Number' in [3. Media Segments](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#page-5) |
| `discontinuitySequence`  | number   | Yes       | N/A | See the description about 'Discontinuity Sequence Number' in [6.2.1. General Server Responsibilities](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-6.2.1) |
| `key`  | `Key`   | No       | undefined | See [EXT-X-KEY](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.4) |
| `map`  | `MediaInitializationSection`   | No       | undefined | See [EXT-X-MAP](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.5) |
| `programDateTime`  | `Date`   | No       | undefined | See [EXT-X-PROGRAM-DATE-TIME](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.6) |
| `dateRange`  | `DateRange`   | No       | undefined | See [EXT-X-DATERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.7) |

### `Key`
| Property          | Type     | Required | Default   | Description   |
| ----------------- | -------- | -------- | --------- | ------------- |
| `method`  | string   | Yes       | N/A | See METHOD attribute in [EXT-X-KEY](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.4) |
| `uri`        | `URL` (WHATWG)  | No       | undefined        | See URI attribute in [EXT-X-KEY](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.4) |
| `data`        | `Buffer`(length=16) | No       | undefined        | If `uri` is specified, the downloaded key  |
| `iv`        | `Buffer`(length=16)   | No       | undefined        | See IV attribute in [EXT-X-KEY](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.4) |
| `format`  | string   | No       | undefined | See KEYFORMAT attribute in [EXT-X-KEY](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.4) |
| `formatVersion`  | string   | No       | undefined | See KEYFORMATVERSIONS attribute in [EXT-X-KEY](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.4) |

### `MediaInitializationSection`
| Property          | Type     | Required | Default   | Description   |
| ----------------- | -------- | -------- | --------- | ------------- |
| `uri`        | `URL` (WHATWG)  | Yes       | N/A        | See URI attribute in [EXT-X-MAP](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.5) |
| `mimeType`        | string  | No       | undefined        | MIME type of the media initialization section |
| `byterange`        | object ({length: number, offset: number})   | No       | undefined        | See BYTERANGE attribute in [EXT-X-MAP](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.5) |
| `data`        | `Buffer` | No       | undefined        | The downloaded media initialization section (the data is trimmed based on the `byterange`)  |

### `DateRange`
| Property          | Type     | Required | Default   | Description   |
| ----------------- | -------- | -------- | --------- | ------------- |
| `id`        | string  | Yes       | N/A        | See ID attribute in [EXT-X-DATERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.7) |
| `classId`        | string   | No       | undefined        | See CLASS attribute in [EXT-X-DATERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.7) |
| `start`        | `Date`  | Yes       | N/A        | See START-DATE attribute in [EXT-X-DATERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.7) |
| `end`        | `Date`  | No       | undefined        | See END-DATE attribute in [EXT-X-DATERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.7) |
| `duration`        | number  | No       | undefined        | See DURATION attribute in [EXT-X-DATERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.7) |
| `plannedDuration`        | number  | No       | undefined        | See PLANNED-DURATION attribute in [EXT-X-DATERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.7) |
| `endOnNext`        | boolean  | No       | undefined        | See END-ON-NEXT attribute in [EXT-X-DATERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.7) |
| `attributes`        | object  | No       | {}        | A hash object that holds SCTE35 attributes and user defined attributes. See SCTE35-* and X-<client-attribute> attributes in [EXT-X-DATERANGE](https://tools.ietf.org/html/draft-pantos-http-live-streaming-21#section-4.3.2.7) |
