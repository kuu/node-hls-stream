const stream = require('stream');
const crypto = require('crypto');
const debug = require('debug');
const Loader = require('./loader');
const Parser = require('./parser');
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

class ReadStream extends stream.Readable {
  constructor(url, options) {
    super({objectMode: true});
    this.loader = new Loader(options);
    this.parser = new Parser(options);
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
    const oldPlaylists = this.mediaPlaylists;
    const oldPlaylistIndex = oldPlaylists.findIndex(elem => {
      if (elem.uri.href === playlist.uri.href) {
        return true;
      }
      return false;
    });
    const oldPlaylist = oldPlaylistIndex === -1 ? null : oldPlaylists[oldPlaylistIndex];
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
        } else {
          this._loadSegment(segment);
        }
      } else {
        this._loadSegment(segment);
      }
    }
    if (oldPlaylist) {
      oldPlaylists[oldPlaylistIndex] = playlist;
    } else {
      this.mediaPlaylists.push(playlist);
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
      const playlist = this.parser.parse(result.data, url);
      this._emit('playlist', playlist);
      if (playlist.isMasterPlaylist) {
        // Master Playlist
        this.state = STATE_MASTER_PLAYLIST_PARSED;
        this._updateMasterPlaylist(playlist);
      } else {
        // Media Playlist
        this.state = STATE_MEDIA_PLAYLIST_PARSED;
        playlist.hash = hash;
        this._updateMediaPlaylist(playlist);
      }
    });
  }

  _loadSegment(segment) {
    this._INCREMENT();
    this.loader.load(segment.uri.href, {readAsBuffer: true}, (err, result) => {
      this._DECREMENT();
      if (err) {
        return this._emit('error', err);
      }
      segment.data = result.data;
      segment.mimeType = result.mimeType;
      this._emit('data', segment);
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

module.exports = {ReadStream};
// es2015 default export compatibility
module.exports.default = module.exports;
