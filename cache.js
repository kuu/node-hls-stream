const DEFAULT_MAX_CACHE_SIZE = 1024 * 1024 * 10;

class Cache {
  constructor(options = {}) {
    this.MAX_CACHE_SIZE = options.maxCacheSize || DEFAULT_MAX_CACHE_SIZE;
    this.map = new Map();
    this.size = 0;
    this.fifo = [];
  }

  append(url, data) {
    let size;
    if (typeof data === 'string') {
      size = data.length * 2;
    } else {
      size = data.length;
    }
    while (this.size + size > this.MAX_CACHE_SIZE) {
      const url = this.fifo.shift();
      const entry = this.map.get(url);
      this.size -= entry.size;
      this.map.delete(url);
    }
    this.map.set(url, {url, data, size});
    this.size += size;
    this.fifo.push(url);
  }

  get(url) {
    const entry = this.map.get(url);
    if (entry) {
      return entry.data;
    }
    return null;
  }

  clear() {
    this.map.clear();
    this.size = 0;
    this.fifo = [];
  }
}

module.exports = Cache;
