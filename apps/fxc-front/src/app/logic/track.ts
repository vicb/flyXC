import { extractGroupId } from '@flyxc/common';

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
  return await fetchAndReturnGroupIds('/api/track/upload.pbf', { method: 'POST', body: formData });
}

// Download tracks given their urls.
export async function downloadTracksByUrls(urls: string[]): Promise<number[]> {
  if (urls.length == 0) {
    return [];
  }
  const params = new URLSearchParams();
  urls.forEach((track) => params.append('track', track));
  return await fetchAndReturnGroupIds(`/api/track/byurl.pbf?${params}`);
}

// Download tracks given then datastore ids.
export async function downloadTracksByGroupIds(ids: Array<number | string>): Promise<number[]> {
  if (ids.length == 0) {
    return [];
  }
  const params = new URLSearchParams();
  ids.forEach((id) => params.append('id', String(id)));
  return await fetchAndReturnGroupIds(`/api/track/byid.pbf?${params}`);
}

// Fetch tracks and return their group ids.
async function fetchAndReturnGroupIds(url: string, options?: RequestInit): Promise<number[]> {
  const groupIds = new Set<number>();
  try {
    const tracks = unwrapResult(await store.dispatch(fetchTrack({ url, options })));
    tracks.forEach((t) => groupIds.add(extractGroupId(t.id)));
  } catch {
    //empty
  }
  return Array.from(groupIds);
}
