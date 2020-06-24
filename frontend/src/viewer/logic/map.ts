import { schemeCategory10 } from 'd3-scale-chromatic';

import { createRuntimeTracks } from '../../../../common/track';
import * as mapActions from '../actions/map';
import { dispatch } from '../store';

// Uploads files to the server and adds the tracks.
export function uploadTracks(tracks: File[]): Promise<unknown> {
  if (tracks.length == 0) {
    return Promise.resolve();
  }
  const formData = new FormData();
  tracks.forEach((track) => formData.append('track', track));

  dispatch(mapActions.setLoading(true));

  return fetch('/_upload', { method: 'POST', body: formData })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((metaTracks) => {
      if (metaTracks) {
        const runtimeTracks = createRuntimeTracks(metaTracks);
        dispatch(mapActions.receiveTracks(runtimeTracks));
        dispatch(mapActions.zoomTracks());
      }
      dispatch(mapActions.setLoading(false));
    });
}

// Download tracks given their urls.
export function downloadTracks(tracks: string[]): Promise<unknown> {
  if (tracks.length == 0) {
    return Promise.resolve();
  }

  const params = new URLSearchParams();
  tracks.forEach((track) => params.append('track', track));

  dispatch(mapActions.setLoading(true));

  return fetch(`/_download?${params}`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((metaTracks) => {
      if (metaTracks) {
        const runtimeTracks = createRuntimeTracks(metaTracks);
        dispatch(mapActions.receiveTracks(runtimeTracks));
        dispatch(mapActions.zoomTracks());
      }
      dispatch(mapActions.setLoading(false));
    });
}

// Download tracks given then datastore ids
export function downloadTracksFromHistory(ids: string[]): Promise<unknown> {
  if (ids.length == 0) {
    return Promise.resolve();
  }

  const params = new URLSearchParams();
  ids.forEach((id) => params.append('h', id));

  dispatch(mapActions.setLoading(true));

  return fetch(`/_history?${params}`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((metaTracks) => {
      if (metaTracks) {
        const runtimeTracks = createRuntimeTracks(metaTracks);
        dispatch(mapActions.receiveTracks(runtimeTracks));
        dispatch(mapActions.zoomTracks());
      }
      dispatch(mapActions.setLoading(false));
    });
}

export function zoomTracks(map: google.maps.Map, minLat: number, minLon: number, maxLat: number, maxLon: number): void {
  const bounds = new google.maps.LatLngBounds({ lat: minLat, lng: minLon }, { lat: maxLat, lng: maxLon });
  map.fitBounds(bounds);
}

export function trackColor(index: number): string {
  return schemeCategory10[(index + 3) % 10];
}
