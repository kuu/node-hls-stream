#!/usr/bin/env node
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2));

try {
  require(`./${argv._[0]}`)(argv._.slice(1))
  .then(result => {
    console.log(result);
  });
} catch (err) {
  console.error(`${err.message} ${err.stack}`);
}
