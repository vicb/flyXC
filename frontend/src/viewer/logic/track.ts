import { extractGroupId } from 'flyxc/common/src/runtime-track';

import { unwrapResult } from '@reduxjs/toolkit';

import { store } from '../redux/store';
import { fetchTrack } from '../redux/track-slice';

// Uploads files to the server and adds the tracks.
export async function uploadTracks(files: File[]): Promise<number[]> {
  if (files.length == 0) {
    return [];
  }
  const formData = new FormData();
  files.forEach((track) => formData.append('track', track));
  return await fetchAndReturnGroupIds('/_upload', { method: 'POST', body: formData });
}

// Download tracks given their urls.
export async function downloadTracksByUrls(urls: string[]): Promise<number[]> {
  if (urls.length == 0) {
    return [];
  }
  const params = new URLSearchParams();
  urls.forEach((track) => params.append('track', track));
  return await fetchAndReturnGroupIds(`/_download?${params}`);
}

// Download tracks given then datastore ids.
export async function downloadTracksByGroupIds(ids: Array<number | string>): Promise<number[]> {
  if (ids.length == 0) {
    return [];
  }
  const params = new URLSearchParams();
  ids.forEach((id) => params.append('id', String(id)));
  return await fetchAndReturnGroupIds(`/_history?${params}`);
}

// Fetch tracks and return their group ids.
async function fetchAndReturnGroupIds(url: string, options?: RequestInit) {
  const groupIds = new Set<number>();
  try {
    const tracks = unwrapResult(await store.dispatch(fetchTrack({ url, options })));
    tracks.forEach((t) => groupIds.add(extractGroupId(t.id)));
  } finally {
    return Array.from(groupIds);
  }
}
