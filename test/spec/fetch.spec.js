const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

const mockFetch = {
  fetch(url) {
    // console.log(`[mockFetch] url=${url}`);
    return Promise.resolve({
      status: 200,
      statusText: 'OK',
      text: () => {
        return new Promise(resolve => {
          resolve(url);
        });
      }
    });
  }
};

const Loader = proxyquire('../../fetch', {'node-fetch': mockFetch.fetch});

test.cb('fetch.single', t => {
  const obj = {
    callback() {
      // console.log(err, data);
      process.nextTick(checkResult);
    }
  };
  const cbSpy = sinon.spy(obj, 'callback');
  const loader = new Loader();
  const url = 'abc';
  loader.load(url, obj.callback);
  function checkResult() {
    t.is(cbSpy.callCount, 1);
    t.true(cbSpy.calledWith(null, {data: url}));
    t.end();
  }
});

test.cb('fetch.multiple', t => {
  let count = 0;
  const REQNUM = 30;
  const obj = {
    callback() {
      // console.log(err, data);
      if (++count === REQNUM) {
        process.nextTick(checkResult);
      }
    }
  };
  const cbSpy = sinon.spy(obj, 'callback');
  const loader = new Loader();
  const url = 'abc';
  for (let i = 0; i < REQNUM; i++) {
    loader.load(url, obj.callback);
  }
  function checkResult() {
    t.is(cbSpy.callCount, REQNUM);
    t.true(cbSpy.calledWith(null, {data: url}));
    t.end();
  }
});
