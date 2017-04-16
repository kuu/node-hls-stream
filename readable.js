const stream = require('stream');
const crypto = require('crypto');
const debug = require('debug');
const Loader = require('@kuu/parallel-fetch');
const HLS = require('@kuu/hls-parser');
const utils = require('./utils');

const print = debug('hls-stream');

const STATE_NO_PLAYLIST = 'no-playlist';
const STATE_PLAYLIST_RETRIEVING = 'no-playlist';
const STATE_MASTER_PLAYLIST_PARSED = 'master-playlist-parsed';
const STATE_MEDIA_PLAYLIST_PARSED = 'media-playlist-parsed';
const STATE_NO_MORE_DATA = 'no-more-data';

function digest(str) {
  const md5 = crypto.createHash('md5');
  md5.update(str, 'utf8');
  return md5.digest('hex');
}

function trimData(data, byterange) {
  if (byterange) {
    const offset = byterange.offset || 0;
    const length = byterange.length || data.length - offset;
    return data.slice(offset, offset + length);
  }
  return data;
}

class ReadStream extends stream.Readable {
  constructor(url, options) {
    super({objectMode: true});
    this.loader = new Loader(options);
    this.state = STATE_NO_PLAYLIST;
    this.url = url;
    this.masterPlaylist = null;
    this.mediaPlaylists = [];
    this.counter = 0;
  }

  _INCREMENT() {
    this.counter++;
  }

  _DECREMENT() {
    this.counter--;
  }

  get exhausted() {
    return this.state === STATE_NO_MORE_DATA && this.counter === 0;
  }

  _deferIfUnchanged(url, hash) {
    const mediaPlaylists = this.mediaPlaylists;
    if (mediaPlaylists.length === 0) {
      return false;
    }
    for (const playlist of mediaPlaylists) {
      if (playlist.playlistType !== 'VOD' && playlist.hash === hash) {
        print(`No update. Wait for a period of one-half the target duration before retrying (${playlist.targetDuration * 1.5}) sec`);
        setTimeout(() => {
          this._loadPlaylist(url);
        }, playlist.targetDuration * 1.5 * 1000);
        return true;
      }
    }
    return false;
  }

  _updateMasterPlaylist(playlist) {
    this.masterPlaylist = playlist;
    this.mediaPlaylists = [];
    this.updateVariant();
  }

  updateVariant() {
    if (this.exhausted) {
      utils.THROW(new Error('the stream has already been exhausted'));
    }
    const playlist = this.masterPlaylist;
    const variants = playlist.variants;
    let currentVariant = 0;
    this._emit('variants', variants, index => {
      // Get feedback from the client synchronously
      currentVariant = index;
    });
    playlist.currentVariant = currentVariant;
    const variant = variants[currentVariant];
    this._loadPlaylist(variant.uri.href);
    this._updateRendition(variant);
  }

  _updateRendition(variant) {
    ['audio', 'video', 'subtitles', 'closedCaptions'].forEach(type => {
      const renditions = variant[type];
      let currentRendition = 0;
      if (renditions.length > 0) {
        this._emit('renditions', renditions, index => {
          // Get feedback from the client synchronously
          currentRendition = index;
        });
        variant.currentRenditions[type] = currentRendition;
        const url = renditions[currentRendition].uri;
        if (url) {
          this._loadPlaylist(url.href);
        }
      }
    });
  }

  _updateMediaPlaylist(playlist) {
    const mediaPlaylists = this.mediaPlaylists;
    const oldPlaylistIndex = mediaPlaylists.findIndex(elem => {
      if (elem.uri.href === playlist.uri.href) {
        return true;
      }
      return false;
    });

    const oldPlaylist = oldPlaylistIndex === -1 ? null : mediaPlaylists[oldPlaylistIndex];
    const newSegments = playlist.segments;
    for (const segment of newSegments) {
      if (oldPlaylist) {
        const oldSegment = oldPlaylist.segments.find(elem => {
          if (elem.uri.href === segment.uri.href) {
            return true;
          }
          return false;
        });
        if (oldSegment) {
          segment.data = oldSegment.data;
          segment.key = oldSegment.key;
          segment.map = oldSegment.map;
        } else {
          this._loadSegment(segment);
        }
      } else {
        this._loadSegment(segment);
      }
    }

    if (oldPlaylist) {
      mediaPlaylists[oldPlaylistIndex] = playlist;
    } else {
      mediaPlaylists.push(playlist);
    }

    if (playlist.playlistType === 'VOD' || playlist.endlist) {
      this.state = STATE_NO_MORE_DATA;
    } else {
      print(`Wait for at least the target duration before attempting to reload the Playlist file again (${playlist.targetDuration}) sec`);
      setTimeout(() => {
        this._loadPlaylist(playlist.uri.href);
      }, playlist.targetDuration * 1000);
    }
  }

  _emitPlaylistEvent(playlist) {
    if (!playlist.isMasterPlaylist) {
      return this._emit('data', playlist);
    }
    for (const sessionData of playlist.sessionDataList) {
      if (!sessionData.value && !sessionData.data) {
        return;
      }
    }
    if (playlist.sessionKey && !playlist.sessionKey.data) {
      return;
    }
    this._emit('data', playlist);
  }

  _loadPlaylist(url) {
    this._INCREMENT();
    this.loader.load(url, {noCache: true}, (err, result) => {
      this._DECREMENT();
      if (err) {
        return this._emit('error', err);
      }
      const hash = digest(result.data);
      if (this._deferIfUnchanged(url, hash)) {
        // The file is not changed
        return;
      }
      const playlist = HLS.parse(result.data, url);
      playlist.source = result.data;
      if (playlist.isMasterPlaylist) {
        // Master Playlist
        this.state = STATE_MASTER_PLAYLIST_PARSED;
        this._emitPlaylistEvent(playlist);
        if (playlist.sessionDataList.length > 0) {
          this._loadSessionData(playlist.sessionDataList, () => {
            this._emitPlaylistEvent(playlist);
          });
        }
        if (playlist.sessionKey) {
          this._loadKey(playlist.sessionKey, () => {
            this._emitPlaylistEvent(playlist);
          });
        }
        this._updateMasterPlaylist(playlist);
      } else {
        // Media Playlist
        this.state = STATE_MEDIA_PLAYLIST_PARSED;
        playlist.hash = hash;
        this._emitPlaylistEvent(playlist);
        this._updateMediaPlaylist(playlist);
      }
    });
  }

  _emitDataEvent(segment) {
    if (!segment.data) {
      return;
    }
    if (segment.key && !segment.key.data) {
      return;
    }
    if (segment.map && !segment.map.data) {
      return;
    }
    this._emit('data', segment);
  }

  _loadSegment(segment) {
    this._INCREMENT();
    this.loader.load(segment.uri.href, {readAsBuffer: true}, (err, result) => {
      this._DECREMENT();
      if (err) {
        return this._emit('error', err);
      }
      segment.data = trimData(result.data, segment.byterange);
      segment.mimeType = result.mimeType;
      this._emitDataEvent(segment);
    });
    if (segment.key) {
      this._loadKey(segment.key, () => {
        this._emitDataEvent(segment);
      });
    }
    if (segment.map) {
      this._loadMap(segment.map, () => {
        this._emitDataEvent(segment);
      });
    }
  }

  _loadSessionData(list, cb) {
    for (const sessionData of list) {
      if (sessionData.value || !sessionData.url) {
        continue;
      }
      this._INCREMENT();
      this.loader.load(sessionData.uri.href, (err, result) => {
        this._DECREMENT();
        if (err) {
          return this._emit('error', err);
        }
        sessionData.data = utils.tryCatch(
          () => {
            return JSON.parse(result.data);
          },
          err => {
            print(`The session data MUST be formatted as JSON. ${err.stack}`);
          }
        );
        cb();
      });
    }
  }

  _loadKey(key, cb) {
    this._INCREMENT();
    this.loader.load(key.uri.href, {readAsBuffer: true}, (err, result) => {
      this._DECREMENT();
      if (err) {
        return this._emit('error', err);
      }
      key.data = result.data;
      cb();
    });
  }

  _loadMap(map, cb) {
    this._INCREMENT();
    this.loader.load(map.uri.href, {readAsBuffer: true}, (err, result) => {
      this._DECREMENT();
      if (err) {
        return this._emit('error', err);
      }
      map.data = trimData(result.data, map.byterange);
      map.mimeType = result.mimeType;
      cb();
    });
  }

  _emit(...params) {
    if (params[0] === 'data') {
      this.push(params[1]); // TODO: stop loading segments when this.push() returns false
    } else {
      this.emit(...params);
    }
    if (this.state === STATE_NO_MORE_DATA && this.counter === 0) {
      this.push(null);
      this.masterPlaylist = null;
      this.mediaPlaylists = null;
    }
  }

  _read() {
    if (this.state === STATE_NO_PLAYLIST) {
      this._loadPlaylist(this.url);
      this.state = STATE_PLAYLIST_RETRIEVING;
    }
  }
}

module.exports = ReadStream;
