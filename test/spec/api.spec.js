const test = require('ava');
const {createReadStream} = require('../..');

test('createReadStream', t => {
  t.truthy(createReadStream('url', {foo: 'bar'}));
  t.truthy(createReadStream('url'));
});
