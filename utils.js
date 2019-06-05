const {URL} = require('url');

function THROW(err) {
  throw err;
}

function ASSERT(msg, ...params) {
  for (const [index, param] of params.entries()) {
    if (!param) {
      THROW(new Error(`${msg} : Failed at [${index}]`));
    }
  }
}

function PARAMCHECK(...params) {
  for (const [index, param] of params.entries()) {
    if (param === undefined) {
      THROW(new Error(`Param Check : Failed at [${index}]`));
    }
  }
}

function CONDITIONALPARAMCHECK(...params) {
  for (const [index, [cond, param]] of params.entries()) {
    if (!cond) {
      continue;
    }
    if (param === undefined) {
      THROW(new Error(`Conditional Param Check : Failed at [${index}]`));
    }
  }
}

function _empty() {}

function tryCatch(body, errorHandler) {
  try {
    return body();
  } catch (err) {
    return errorHandler(err);
  }
}

function createUrl(url, base) {
  return tryCatch(
    () => {
      return new URL(url);
    },
    () => {
      return new URL(url, base);
    }
  );
}

module.exports = {
  THROW,
  ASSERT: process.env.NODE_ENV === 'production' ? _empty : ASSERT,
  PARAMCHECK: process.env.NODE_ENV === 'production' ? _empty : PARAMCHECK,
  CONDITIONALPARAMCHECK: process.env.NODE_ENV === 'production' ? _empty : CONDITIONALPARAMCHECK,
  tryCatch,
  createUrl
};
