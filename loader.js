const debug = require('debug');
const fetch = require('node-fetch');
const through = require('through2-parallel');
const utils = require('./utils');
const Cache = require('./cache');

const print = debug('hls-stream');

class Loader {
  constructor(options = {}) {
    const concurrency = options.concurrency || 6;
    this.cache = new Cache();
    this.waitlist = new Set();
    this.stream = through.obj({concurrency}, ({url, options}, enc, cb) => {
      print(`[GET] ${url}`);
      fetch(url)
      .then(res => {
        if (res.status < 200 || res.status >= 300) {
          utils.THROW(new Error(`${res.status} ${res.statusText}`));
        }
        if (options.readAsBuffer) {
          return res.buffer().then(data => {
            return {data, mimeType: res.headers ? res.headers.get('Content-Type') : null};
          });
        }
        return res.text().then(data => {
          return {data};
        });
      })
      .then(data => {
        this.cache.append(url, data);
        this.stream.push({url, data});
        cb();
      }).catch(err => {
        print(`Error: ${err.message}`);
        setImmediate(() => this.stream.emit('error', {url, err}));
        cb();
      });
    });
  }

  load(...args) {
    const url = args[0];
    const cb = args[args.length - 1];
    const options = args.length > 2 ? args[1] : {};

    utils.PARAMCHECK(url, cb);
    utils.ASSERT('Loader.load: cb is not a function', typeof cb === 'function');

    if (!options.noCache) {
      const data = this.cache.get(url);
      if (data) {
        return process.nextTick(() => {
          cb(null, data);
        });
      }
    }

    const waitlist = this.waitlist;
    const stream = this.stream;

    if (!waitlist.has(url)) {
      stream.write({url, options});
      waitlist.add(url);
    }

    stream.on('data', function onData(result) {
      if (result.url === url) {
        stream.removeListener('data', onData);
        waitlist.delete(url);
        cb(null, result.data);
      }
    })
    .on('error', function onError(result) {
      if (result.url === url) {
        stream.removeListener('errir', onError);
        waitlist.delete(url);
        cb(result.err);
      }
    });
  }
}

module.exports = Loader;
