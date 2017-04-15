const Parser = require('@kuu/hls-parser');

const ReadStream = require('./readable');
const WriteStream = require('./writable');

function createReadStream(url, options) {
  return new ReadStream(url, options);
}

function createWriteStream(filePath, options) {
  return new WriteStream(filePath, options);
}

module.exports = {createReadStream, createWriteStream, types: Parser.types};
// es2015 default export compatibility
module.exports.default = module.exports;
