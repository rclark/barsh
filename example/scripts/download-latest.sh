#!/usr/bin/env bash

bucket=${1}
prefix=${2}
destination=${3}

latest=$(aws s3 cp s3://${bucket}/${prefix}/latest -)
aws s3 cp s3://${bucket}/${prefix}/${latest} ${destination}
