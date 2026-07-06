#!/usr/bin/env bash

GH_REPO="${GITHUB_REPOSITORY:-local}"
GH_SHA="${GITHUB_SHA:-local}"
GH_OWNER="${GITHUB_REPOSITORY_OWNER:-flyxc}"

if [ -z "$WINDY_API_KEY" ]; then
    echo "WINDY_API_KEY is not configured" >&2
    exit 1
fi

echo "# Creating plugin archive..."
echo "repository=${GH_REPO}"
echo "sha=${GH_SHA}"
echo "owner=${GH_OWNER}"

GH_INFO_FILE=$(mktemp)
echo "{\"repositoryName\": \"${GH_REPO}\", \"commitSha\": \"${GH_SHA}\", \"repositoryOwner\": \"${GH_OWNER}\"}" > $GH_INFO_FILE

PLUGIN_JSON_FILE=$(mktemp)
cat libs/windy-sounding/dist/plugin.json > $PLUGIN_JSON_FILE

jq -s '.[0] * .[1]' $PLUGIN_JSON_FILE $GH_INFO_FILE > libs/windy-sounding/dist/plugin.json

tar cf /tmp/plugin.tar -C libs/windy-sounding/dist plugin.min.js plugin.min.js.map plugin.js plugin.json screenshot.jpg 
echo "# Publishing plugin..."

curl -s --fail-with-body -XPOST 'https://node.windy.com/plugins/v1.0/upload' -H "x-windy-api-key: ${WINDY_API_KEY}" -F "plugin_archive=@/tmp/plugin.tar"
