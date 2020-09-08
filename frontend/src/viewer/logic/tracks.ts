import { createRuntimeTracks } from '../../../../common/track';
import * as act from '../actions';
import * as sel from '../selectors';
import { dispatch, store } from '../store';
import * as msg from './messages';

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

// Download tracks given then datastore ids.
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
  dispatch(act.setTrackLoading(true));

  const response = await fetch(url, options);
  if (!response.ok) {
    dispatch(act.setTrackLoading(false));
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
    dispatch(act.receiveTracks(runtimeTracks));
    msg.tracksAdded.emit(ids);
  }
  dispatch(act.setTrackLoading(false));
  dispatch(act.setAspAltitude(sel.maxAlt(store.getState().map)));
  return ids;
}

// from http://phrogz.net/tmp/24colors.html
const colors = [
  '#FF0000',
  '#FFFF00',
  '#00EAFF',
  '#AA00FF',
  '#FF7F00',
  '#BFFF00',
  '#0095FF',
  '#FF00AA',
  '#FFD400',
  '#6AFF00',
  '#0040FF',
  '#EDB9B9',
  '#B9D7ED',
  '#E7E9B9',
  '#DCB9ED',
  '#B9EDE0',
  '#8F2323',
  '#23628F',
  '#8F6A23',
  '#6B238F',
  '#4F8F23',
  '#000000',
  '#737373',
  '#CCCCCC',
];

export function trackColor(index: number): string {
  return colors[index % colors.length];
}
