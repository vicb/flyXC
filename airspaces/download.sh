#! /usr/bin/env sh

node download.mjs

# Ukraine
wget -P asp "https://fly.net.ua/airspaces/UKRAINE%20(UK).zip"
unzip "asp/UKRAINE (UK).zip" -d asp/