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

function runner(assert, cmd, files, env, callback) {
  if (typeof env === 'function') {
    callback = env;
    env = null;
  }

  var tmp = path.join(os.tmpdir(), crypto.randomBytes(8).toString('hex'));
  env = env ? env : process.env;
  var runtime = Object.assign({}, env, {
    PATH: [tmp, env.PATH].join(':')
  });

  var assertions = asserter(tmp, assert);
  files = Object.assign({}, files, { assert: assertions.file });

  var stdout, stderr;

  setupFiles()
    .then(runCommand)
    .then(checkAssertions)
    .then(cleanup)
    .then(runCallback)
    .catch(function(err) {
      callback(err, stdout, stderr);
    });

  function setupFiles() {
    return new Promise(function(resolve, reject) {
      mkdirp(tmp, function(err) {
        if (err) return reject(err);

        Promise.all(Object.keys(files).map(writeFile))
          .then(resolve, reject);
      });
    });
  }

  function writeFile(name) {
    var file = path.join(tmp, name);
    var contents = files[name].trim();

    return new Promise(function(resolve, reject) {
      fs.writeFile(file, contents, function(err) {
        if (err) return reject(err);
        fs.chmod(file, '0755', function(err) {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  function runCommand() {
    return new Promise(function(resolve) {
      var p = exec(cmd, { env: runtime }, function(err, one, two) {
        stdout = one;
        stderr = two;
        return resolve({ err, stdout, stderr });
      });

      if (process.env.VERBOSE) {
        p.stdout.pipe(process.stdout);
        p.stderr.pipe(process.stderr);
      }
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
          if (line[0] === 'match') {
            assert.ok((new RegExp(line[2])).test(line[1]), line[3]);
          } else {
            assert[line[0]](line[1], line[2], line[3]);
          }
        });

        resolve();
      });
    });
  };

  return { file, verify };
}
