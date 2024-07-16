#! /usr/bin/env sh

DIST_FOLDER=`realpath $(dirname "$0")`
DST_FOLDER=`realpath $DIST_FOLDER/../../../apps/fxc-tiles/src/assets/airspaces`

echo "# Download openaip airspaces"
node $DIST_FOLDER/download-openaip.js -o $DST_FOLDER

echo "# Download Ukraine airspaces"
mkdir -p /tmp/asp/
wget -O /tmp/asp/ukraine.zip "https://fly.net.ua/airspaces/UKRAINE%20(UK).zip"
unzip -o "/tmp/asp/ukraine.zip" -d $DST_FOLDER