var test = require('tape');
var barsh = require('../..');
var fs = require('fs');

test('[my script] downloads the latest file', function(assert) {
  var testBucket = 'my-bucket';
  var testPrefix = 'some-prefix';
  var fixture = './fixtures/file';
  var destination = './file-received';

  var stubs = {};
  stubs.aws = `
    #!/usr/bin/env bash

    assert equal $1 s3 "calls aws s3"
    assert equal $2 cp "calls aws s3 cp"

    if [[ "$3" == *latest ]]; then
      assert equal $3 s3://${testBucket}/${testPrefix}/latest "request the correct latest file"
      assert equal $4 - "pipes latest file to stdout"
      echo "contents-of-latest-file"
    else
      assert equal $3 s3://${testBucket}/${testPrefix}/contents-of-latest-file "downloads the correct file"
      cp ${fixture} $4
    fi
  `;

  var command = `../scripts/download-latest.sh ${testBucket} ${testPrefix} ${destination}`;

  barsh(assert).exec(command, stubs, function(err, stdout, stderr) {
    assert.ifError(err, 'completed without error');
    var downloaded = fs.readFileSync(destination, 'utf8');
    var expected = fs.readFileSync(fixture, 'utf8');
    assert.equal(downloaded, expected, 'downloaded latest file');
    assert.end();
  });
});
