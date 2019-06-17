const test = require('ava');
const utils = require('../../utils');

test('utils.THROW', t => {
  try {
    utils.THROW(new Error('abc'));
  } catch (err) {
    t.truthy(err);
    t.is(err.message, 'abc');
  }
});

test('utils.ASSERT', t => {
  utils.ASSERT('No error occurs', 1, 2, 3);
  try {
    utils.ASSERT('Error occurs', 1, 2, false);
  } catch (err) {
    t.truthy(err);
    t.is(err.message, 'Error occurs : Failed at [2]');
  }
});

test('utils.PARAMCHECK', t => {
  utils.PARAMCHECK(1, 2, 3);
  try {
    utils.PARAMCHECK(1, 2, undefined);
  } catch (err) {
    t.truthy(err);
    t.is(err.message, 'Param Check : Failed at [2]');
  }
});

test('utils.CONDITIONALPARAMCHECK', t => {
  utils.CONDITIONALPARAMCHECK([true, 1], [true, 2], [true, 3]);
  utils.CONDITIONALPARAMCHECK([false, undefined], [false, 1], [false, 2]);
  try {
    utils.CONDITIONALPARAMCHECK([false, undefined], [true, 1], [true, undefined]);
  } catch (err) {
    t.truthy(err);
    t.is(err.message, 'Conditional Param Check : Failed at [2]');
  }
});

test('utils.tryCatch', t => {
  let result = utils.tryCatch(
    () => {
      return 1;
    },
    () => {
      return 0;
    }
  );
  t.is(result, 1);
  result = utils.tryCatch(
    () => {
      return JSON.parse('{{');
    },
    () => {
      return 0;
    }
  );
  t.is(result, 0);
  t.throws(() => {
    utils.tryCatch(
      () => {
        return JSON.parse('{{');
      },
      () => {
        return JSON.parse('}}');
      }
    );
  });
  result = utils.tryCatch(
    () => {
      return JSON.parse('{{');
    },
    () => {
      return JSON.parse('}}');
    },
    () => {
      return 0;
    }
  );
  t.is(result, 0);
});

test('utils.createUrl', t => {
  let url = utils.createUrl('http://abc.com');
  t.is(url.href, 'http://abc.com/');
  url = utils.createUrl('http://abc.com', 'http://def.com');
  t.is(url.href, 'http://abc.com/');
  url = utils.createUrl('/abc', 'http://def.com');
  t.is(url.href, 'http://def.com/abc');
});
