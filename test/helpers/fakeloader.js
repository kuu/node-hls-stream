// const sinon = require('sinon');
const proxyquire = require('proxyquire');

const ERROR_STATUS_CODE = 500;
const ERROR_MESSAGE = 'Mock Error';
const mock = {
  counter: 0,
  fetch(url) {
    // console.log(`[mockFetch] url=${url}, params=${params}`);
    if (url === 'http://err.com') {
      return Promise.resolve({
        status: ERROR_STATUS_CODE,
        statusText: ERROR_MESSAGE
      });
    }
    return Promise.resolve({
      status: 200,
      statusText: 'OK',
      text: mock.text,
      buffer: mock.buffer,
      headers: {
        get: h => {
          const header = h.toLowerCase();
          if (header === 'content-type') {
            return 'video/MP2T';
          }
          return '';
        }
      }
    });
  },

  text() {
    return Promise.resolve(`${mock.counter++}`);
  },

  buffer() {
    return Promise.resolve(Buffer.from([mock.counter++]));
  }
};

module.exports = proxyquire('../../loader', {'node-fetch': mock.fetch});
