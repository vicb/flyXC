#! /usr/bin/env sh

APP_FOLDER=`realpath $(dirname "$0")/..`
ASSETS_FOLDER=`realpath $APP_FOLDER/assets`
DIST_FOLDER=`realpath $APP_FOLDER/dist`

echo "# Download openaip airspaces"

node "$DIST_FOLDER/airspaces/download-openaip.js" -o "$ASSETS_FOLDER"

# no more available
# echo "# Download Ukraine airspaces"
# mkdir -p /tmp/asp/
# wget -O /tmp/asp/ukraine.zip "https://fly.net.ua/airspaces/UKRAINE%20(UK).zip"
# unzip -o "/tmp/asp/ukraine.zip" -d $DST_FOLDER