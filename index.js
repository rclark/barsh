var os = require('os');
var crypto = require('crypto');
var path = require('path');
var fs = require('fs');
var exec = require('child_process').exec;
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

module.exports = faker;

function faker(assert) {
  assert.exec = runner.bind(null, assert);
  return assert;
}

function runner(assert, cmd, files, callback) {
  var tmp = path.join(os.tmpdir(), crypto.randomBytes(8).toString('hex'));

  var env = Object.assign({}, process.env, {
    PATH: [tmp, process.env.PATH].join(':')
  });

  var assertions = asserter(tmp, assert);

  files = Object.assign({}, files, { assert: assertions.file });

  setupFiles()
    .then(runCommand)
    .then(checkAssertions)
    .then(cleanup)
    .then(runCallback);

  function setupFiles() {
    return new Promise(function(resolve, reject) {
      mkdirp(tmp, function(err) {
        if (err) return reject(err);
        Object.keys(files).forEach(function(name) {
          var file = path.join(tmp, name);
          fs.writeFileSync(file, files[name].trim());
          fs.chmodSync(file, '0755');
        });
        resolve();
      });
    });
  }

  function runCommand() {
    return new Promise(function(resolve) {
      exec(cmd, { env: env }, function(err, stdout, stderr) {
        return resolve({ err, stdout, stderr });
      });
    });
  }

  function checkAssertions(output) {
    return assertions.verify()
      .catch(function(err) {
        process.stderr.write(`[warn] assertion error: ${err.message}\n`);
      })
      .then(function() { return output; });
  }

  function cleanup(output) {
    return new Promise(function(resolve, reject) {
      rimraf(tmp, function(err) {
        if (err) return reject(err);
        resolve(output);
      });
    });
  }

  function runCallback(output) {
    callback(output.err, output.stdout, output.stderr);
  }
}

function asserter(tmp, assert) {
  var asserterOutput = path.join(tmp, 'assertions');

  var file = `
  #!/usr/bin/env bash

  echo "$1|$2|$3|$4" >> ${asserterOutput}
  `;

  var verify = function() {
    return new Promise(function(resolve, reject) {
      fs.readFile(asserterOutput, 'utf8', function(err, data) {
        if (err && err.code === 'ENOENT') return resolve();
        if (err) return reject(err);

        data.split('\n').forEach(function(line) {
          if (!line) return;
          line = line.split('|');
          assert[line[0]](line[1], line[2], line[3]);
        });

        resolve();
      });
    });
  };

  return { file, verify };
}
