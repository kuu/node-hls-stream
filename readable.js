const stream = require('stream');
const crypto = require('crypto');
const debug = require('debug');
const HLS = require('hls-parser');
const Loader = require('./fetch');
const utils = require('./utils');

const print = debug('hls-stream');

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

function getUrl(url, base) {
  return utils.createUrl(url, base).href;
}

class ReadStream extends stream.Readable {
  constructor(url, options) {
    super({objectMode: true});
    this.loader = new Loader(options);
    this.state = 'initialized';
    this.url = url;
    this.masterPlaylist = null;
    this.mediaPlaylists = [];
    this.counter = 0;
    this.rawResponseMode = Boolean(options.rawResponse);
  }

  _INCREMENT() {
    this.counter++;
  }

  _DECREMENT() {
    this.counter--;
  }

  get consumed() {
    return this.state === 'ended' && this.counter === 0;
  }

  _deferIfUnchanged(url, hash) {
    const {mediaPlaylists} = this;
    if (mediaPlaylists.length === 0) {
      return false;
    }
    for (const playlist of mediaPlaylists) {
      const waitSeconds = playlist.targetDuration * 1.5;
      if (playlist.playlistType !== 'VOD' && playlist.hash === hash) {
        print(`No update. Wait for a period of one-half the target duration before retrying (${waitSeconds}) sec`);
        setTimeout(() => {
          this._loadPlaylist(url);
        }, waitSeconds * 1000);
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
    if (this.state !== 'reading') {
      utils.THROW(new Error('the state should be "reading"'));
    }
    const playlist = this.masterPlaylist;
    const {variants} = playlist;
    let variantsToLoad = [...new Array(variants.length).keys()];
    this._emit('variants', variants, indices => {
      // Get feedback from the client synchronously
      variantsToLoad = indices;
    });
    for (const index of variantsToLoad) {
      const variant = variants[index];
      this._loadPlaylist(getUrl(variant.uri, playlist.uri));
      this._updateRendition(playlist, variant);
    }
  }

  _updateRendition(playlist, variant) {
    ['audio', 'video', 'subtitles', 'closedCaptions'].forEach(type => {
      const renditions = variant[type];
      if (renditions.length > 0) {
        let renditionsToLoad = [...new Array(renditions.length).keys()];
        this._emit('renditions', renditions, indices => {
          // Get feedback from the client synchronously
          renditionsToLoad = indices;
        });
        for (const index of renditionsToLoad) {
          const url = renditions[index].uri;
          if (url) {
            this._loadPlaylist(getUrl(url, playlist.uri));
          }
        }
      }
    });
  }

  _updateMediaPlaylist(playlist) {
    const {mediaPlaylists} = this;
    const oldPlaylistIndex = mediaPlaylists.findIndex(elem => {
      if (elem.uri === playlist.uri) {
        return true;
      }
      return false;
    });

    const oldPlaylist = oldPlaylistIndex === -1 ? null : mediaPlaylists[oldPlaylistIndex];
    const newSegments = playlist.segments;
    for (const segment of newSegments) {
      if (oldPlaylist) {
        const oldSegment = oldPlaylist.segments.find(elem => {
          if (elem.uri === segment.uri) {
            return true;
          }
          return false;
        });
        if (oldSegment) {
          segment.data = oldSegment.data;
          segment.key = oldSegment.key;
          segment.map = oldSegment.map;
        } else {
          this._loadSegment(playlist, segment);
        }
      } else {
        this._loadSegment(playlist, segment);
      }
    }

    if (oldPlaylist) {
      mediaPlaylists[oldPlaylistIndex] = playlist;
    } else {
      mediaPlaylists.push(playlist);
    }

    if (playlist.playlistType === 'VOD' || playlist.endlist) {
      this.state = 'ended';
    } else {
      print(`Wait for at least the target duration before attempting to reload the Playlist file again (${playlist.targetDuration}) sec`);
      setTimeout(() => {
        this._loadPlaylist(playlist.uri);
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
    for (const sessionKey of playlist.sessionKeyList) {
      if (!sessionKey.data) {
        return;
      }
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
      const playlist = HLS.parse(result.data);
      playlist.source = result.data;
      playlist.uri = url;
      if (playlist.isMasterPlaylist) {
        // Master Playlist
        this._emitPlaylistEvent(playlist);
        if (playlist.sessionDataList.length > 0) {
          this._loadSessionData(playlist, () => {
            this._emitPlaylistEvent(playlist);
          });
        }
        if (playlist.sessionKeyList.length > 0) {
          this._loadSessionKey(playlist, () => {
            this._emitPlaylistEvent(playlist);
          });
        }
        this._updateMasterPlaylist(playlist);
      } else {
        // Media Playlist
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

  _loadSegment(playlist, segment) {
    this._INCREMENT();
    this.loader.load(getUrl(segment.uri, playlist.uri), {readAsBuffer: true}, (err, result) => {
      this._DECREMENT();
      if (err) {
        return this._emit('error', err);
      }
      if (this.rawResponseMode) {
        segment.data = result.data;
      } else {
        segment.data = trimData(result.data, segment.byterange);
      }
      segment.mimeType = result.mimeType;
      this._emitDataEvent(segment);
    });
    if (segment.key) {
      this._loadKey(playlist, segment.key, () => {
        this._emitDataEvent(segment);
      });
    }
    if (segment.map) {
      this._loadMap(playlist, segment.map, () => {
        this._emitDataEvent(segment);
      });
    }
  }

  _loadSessionData(playlist, cb) {
    const list = playlist.sessionDataList;
    for (const sessionData of list) {
      if (sessionData.value || !sessionData.url) {
        continue;
      }
      this._INCREMENT();
      this.loader.load(getUrl(sessionData.uri, playlist.uri), (err, result) => {
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

  _loadSessionKey(playlist, cb) {
    const list = playlist.sessionKeyList;
    for (const key of list) {
      this._loadKey(playlist, key, cb);
    }
  }

  _loadKey(playlist, key, cb) {
    this._INCREMENT();
    this.loader.load(getUrl(key.uri, playlist.uri), {readAsBuffer: true}, (err, result) => {
      this._DECREMENT();
      if (err) {
        return this._emit('error', err);
      }
      key.data = result.data;
      cb();
    });
  }

  _loadMap(playlist, map, cb) {
    this._INCREMENT();
    this.loader.load(getUrl(map.uri, playlist.uri), {readAsBuffer: true}, (err, result) => {
      this._DECREMENT();
      if (err) {
        return this._emit('error', err);
      }
      if (this.rawResponseMode) {
        map.data = result.data;
      } else {
        map.data = trimData(result.data, map.byterange);
      }
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
    if (this.consumed) {
      this.push(null);
      this.masterPlaylist = null;
      this.mediaPlaylists = [];
    }
  }

  _read() {
    if (this.state === 'initialized') {
      this.state = 'reading';
      this._loadPlaylist(this.url);
    }
  }
}

module.exports = ReadStream;
