const stream = require('stream');

class WriteStream extends stream.Writable {
  constructor(filePath, options) {
    super({objectMode: true});
    this.filePath = filePath;
    this.options = options;
  }
}

module.exports = WriteStream;
