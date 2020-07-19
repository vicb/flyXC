import { schemeCategory10 } from 'd3-scale-chromatic';

import { createRuntimeTracks } from '../../../../common/track';
import * as mapActions from '../actions/map';
import { dispatch } from '../store';

// Uploads files to the server and adds the tracks.
export async function uploadTracks(tracks: File[]): Promise<number[]> {
  if (tracks.length == 0) {
    return [];
  }
  const formData = new FormData();
  tracks.forEach((track) => formData.append('track', track));
  return await fetchTracks('/_upload', { method: 'POST', body: formData });
}

// Download tracks given their urls.
export async function downloadTracksByUrl(urls: string[]): Promise<number[]> {
  if (urls.length == 0) {
    return [];
  }
  const params = new URLSearchParams();
  urls.forEach((track) => params.append('track', track));
  return await fetchTracks(`/_download?${params}`);
}

// Download tracks given then datastore ids
export async function downloadTracksById(ids: Array<number | string>): Promise<number[]> {
  if (ids.length == 0) {
    return [];
  }
  const params = new URLSearchParams();
  ids.forEach((id) => params.append('id', String(id)));
  return await fetchTracks(`/_history?${params}`);
}

// Fetch tracks using the given URL and options.
// Returns the list of ids.
async function fetchTracks(url: string, options: RequestInit | undefined = undefined): Promise<number[]> {
  dispatch(mapActions.setLoading(true));

  const response = await fetch(url, options);
  if (!response.ok) {
    return [];
  }
  const ids: number[] = [];
  const metaTracks = await response.arrayBuffer();
  if (metaTracks) {
    const runtimeTracks = createRuntimeTracks(metaTracks);
    runtimeTracks.forEach((track) => {
      if (track.id != null) {
        ids.push(track.id);
      }
    });
    dispatch(mapActions.receiveTracks(runtimeTracks));
    dispatch(mapActions.zoomTracks());
  }
  dispatch(mapActions.setLoading(false));
  return ids;
}

export function zoomTracks(map: google.maps.Map, minLat: number, minLon: number, maxLat: number, maxLon: number): void {
  const bounds = new google.maps.LatLngBounds({ lat: minLat, lng: minLon }, { lat: maxLat, lng: maxLon });
  map.fitBounds(bounds);
}

export function trackColor(index: number): string {
  return schemeCategory10[(index + 3) % 10];
}
