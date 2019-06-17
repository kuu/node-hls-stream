const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

function getDataAndType(url) {
  const type = 'application/vnd.apple.mpegurl';
  if (url === 'master.m3u8') {
    return [`
      #EXTM3U
      #EXT-X-STREAM-INF:BANDWIDTH=1280000,CODECS="avc1.640029,mp4a.40.2",VIDEO="low"
      low-main.m3u8
      #EXT-X-STREAM-INF:BANDWIDTH=2560000,CODECS="avc1.640029,mp4a.40.2",VIDEO="mid"
      mid-main.m3u8
      #EXT-X-STREAM-INF:BANDWIDTH=7680000,CODECS="avc1.640029,mp4a.40.2",VIDEO="high"
      high-main.m3u8

      #EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="low",NAME="Main",DEFAULT=YES,URI="low-main.m3u8"
      #EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="low",NAME="Sub-1",DEFAULT=NO,URI="low-sub1.m3u8"
      #EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="low",NAME="Sub-2",DEFAULT=NO,URI="low-sub2.m3u8"

      #EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="mid",NAME="Main",DEFAULT=YES,URI="mid-main.m3u8"
      #EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="mid",NAME="Sub-1",DEFAULT=NO,URI="mid-sub1.m3u8"
      #EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="mid",NAME="Sub-2",DEFAULT=NO,URI="mid-sub2.m3u8"

      #EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="high",NAME="Main",DEFAULT=YES,URI="high-main.m3u8"
      #EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="high",NAME="Sub-1",DEFAULT=NO,URI="high-sub1.m3u8"
      #EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="high",NAME="Sub-2",DEFAULT=NO,URI="high-sub2.m3u8"
    `, type];
  }
  if (url.endsWith('.m3u8')) {
    return [`
      #EXTM3U
      #EXT-X-VERSION:3
      #EXT-X-TARGETDURATION:10
      #EXTINF:9.009,
      http://media.example.com/01_${url}.ts
      #EXTINF:9.009,
      http://media.example.com/02_${url}.ts
      #EXTINF:3.003,
      http://media.example.com/03_${url}.ts
      #EXT-X-ENDLIST
    `, type];
  }
  return [Buffer.alloc(10), 'video/mp2t'];
}

const mockFetch = {
  fetch(url) {
    // console.log(`[mockFetch] url=${url}, params=${params}`);
    const [data, type] = getDataAndType(url);
    return Promise.resolve({
      status: 200,
      statusText: 'OK',
      headers: {
        get: h => {
          const header = h.toLowerCase();
          if (header === 'content-type') {
            return type;
          }
        }
      },
      text: () => {
        return new Promise(resolve => {
          resolve(data);
        });
      },
      buffer: () => {
        return new Promise(resolve => {
          resolve(data);
        });
      }
    });
  }
};

const mockFetchLib = proxyquire('../../fetch', {'node-fetch': mockFetch.fetch});
const mockReadable = proxyquire('../../readable', {'./fetch': mockFetchLib});
const {createReadStream} = proxyquire('../..', {'./readable': mockReadable});

test('createReadStream', t => {
  t.truthy(createReadStream('url', {foo: 'bar'}));
  t.truthy(createReadStream('url'));
});

test.cb('createReadStream.renditions', t => {
  const obj = {
    onVariants() {
      // Nop
    },
    onRenditions() {
      // Nop
    },
    onData() {
      // Nop
    },
    onEnd() {
      process.nextTick(checkResult);
    }
  };

  const spyVariants = sinon.spy(obj, 'onVariants');
  const spyRenditions = sinon.spy(obj, 'onRenditions');
  const spyData = sinon.spy(obj, 'onData');
  const spyEnd = sinon.spy(obj, 'onEnd');

  createReadStream('master.m3u8')
  .on('variants', obj.onVariants)
  .on('renditions', obj.onRenditions)
  .on('data', obj.onData)
  .on('end', obj.onEnd);

  function checkResult() {
    t.is(spyVariants.callCount, 1);
    t.is(spyRenditions.callCount, 3);
    t.is(spyData.callCount, 1 + 9 + 27);
    t.true(spyEnd.calledOnce);
    t.end();
  }
});
