# barsh

For stubbing CLI tools to test your wild and crazy shell scripts

## Why should I use this?

- I am happier when I write tests in JavaScript using [tape](https://github.com/substack/tape) or [tap](https://github.com/tapjs/node-tap).
- The shell script that I need to test integrates one or more CLI tools that perform I/O or long-running processes.
- I want to stub those CLI tools because I'm confident that they're independently well tested and I understand their interface enough to mock it.

## What does it do?

It runs the shell script that you want to test via [child_process.exec](https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback). Before it does that, it takes a bunch of stub scripts that you've written and places them in a temporary directory. It adds that directory to the `$PATH` that the child process will have access to. So, your stub scripts get called instead of the real CLI tools.

It also gives you a way to make assertions from within your stubbed scripts about the expected arguments that the function was called with.

## What does it look like?

Say that the script I want to test is a file called `download-latest.sh` and looks like this:

```sh
#!/usr/bin/env bash

bucket=${1}
prefix=${2}
destination=${3}

latest=$(aws s3 cp s3://${bucket}/${prefix}/latest -)
aws s3 cp s3://${bucket}/${prefix}/${latest} ${destination}
```

When I test this script, I am confident that as long as I provide `aws` with the right arguments, it will do what I expect it to do. However
I don't want to have to reach out an talk to *real-life S3* every time I run the test. So I can write a test like this:

```js
var test = require('tape');
var barsh = require('barsh');
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
```

Running this example test will give a console output like this:

```
TAP version 13
# [my script] downloads the latest file
ok 1 calls aws s3
ok 2 calls aws s3 cp
ok 3 request the correct latest file
ok 4 pipes latest file to stdout
ok 5 calls aws s3
ok 6 calls aws s3 cp
ok 7 downloads the correct file
ok 8 completed without error
ok 9 downloaded latest file

1..9
# tests 9
# pass  9

# ok
```
