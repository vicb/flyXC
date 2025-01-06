#! /usr/bin/env sh

DIST_ASP_FOLDER=`realpath $(dirname "$0")`
DST_FOLDER=`realpath $DIST_ASP_FOLDER/../../../../apps/fxc-tiles/src/assets/airspaces`

echo "# Download openaip airspaces"
node $DIST_ASP_FOLDER/download-openaip.js -o $DST_FOLDER

# no more available
# echo "# Download Ukraine airspaces"
# mkdir -p /tmp/asp/
# wget -O /tmp/asp/ukraine.zip "https://fly.net.ua/airspaces/UKRAINE%20(UK).zip"
# unzip -o "/tmp/asp/ukraine.zip" -d $DST_FOLDER