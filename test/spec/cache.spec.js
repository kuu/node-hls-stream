const test = require('ava');
const Cache = require('../../cache');

test('cache', t => {
  const cache = new Cache({maxCacheSize: 200});
  const buf = Buffer.alloc(10);
  const str = '0123456789';
  for (let i = 0; i < 10; i++) {
    cache.append(`http://xxx.com/buf${i}`, buf);
  }
  for (let i = 0; i < 5; i++) {
    cache.append(`http://xxx.com/str${i}`, str);
  }
  for (let i = 0; i < 15; i++) {
    if (i >= 0 && i < 10) {
      const data = cache.get(`http://xxx.com/buf${i}`);
      t.truthy(data);
      t.is(data, buf);
    } else if (i >= 10 && i < 15) {
      const data = cache.get(`http://xxx.com/str${i - 10}`);
      t.truthy(data);
      t.is(data, str);
    }
  }
  cache.append(`http://xxx.com/str5`, str);
  for (let i = 0; i < 16; i++) {
    if (i >= 0 && i < 2) {
      t.falsy(cache.get(`http://xxx.com/buf${i}`));
    } else if (i >= 2 && i < 10) {
      const data = cache.get(`http://xxx.com/buf${i}`);
      t.truthy(data);
      t.is(data, buf);
    } else if (i >= 10 && i < 16) {
      const data = cache.get(`http://xxx.com/str${i - 10}`);
      t.truthy(data);
      t.is(data, str);
    }
  }
  cache.clear();
  for (let i = 0; i < 16; i++) {
    if (i >= 0 && i < 10) {
      t.falsy(cache.get(`http://xxx.com/buf${i}`));
    } else if (i >= 10 && i < 16) {
      t.falsy(cache.get(`http://xxx.com/str${i - 10}`));
    }
  }
});
