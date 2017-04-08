const test = require('ava');
const Loader = require('../helpers/fakeloader');

const loader = new Loader();

test.cb('load', t => {
  try {
    loader.load();
  } catch (err) {
    t.truthy(err);
  }
  try {
    loader.load('http://xxx.com');
  } catch (err) {
    t.truthy(err);
  }
  try {
    loader.load('http://xxx.com', {});
  } catch (err) {
    t.truthy(err);
  }

  loader.load('http://xxx.com', (err, data) => {
    t.falsy(err);
    t.is(data.data, '0');
    loader.load('http://xxx.com', (err, data) => {
      t.falsy(err);
      t.is(data.data, '0'); // From cache
    });
  });
  loader.load('http://yyy.com', (err, data) => {
    t.falsy(err);
    t.is(data.data, '1');
  });

  loader.load('http://zzz.com', {readAsBuffer: true}, (err, data) => {
    t.falsy(err);
    t.true(Buffer.isBuffer(data.data));
    t.is(data.data[0], 2);
  });
  loader.load('http://err.com', err => {
    t.truthy(err);
    t.end();
  });
});
