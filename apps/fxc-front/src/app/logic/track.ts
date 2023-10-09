import { extractGroupId, Point, RuntimeTrack } from '@flyxc/common';

import { unwrapResult } from '@reduxjs/toolkit';

import { AppDispatch, store } from '../redux/store';
import { fetchTrack } from '../redux/track-slice';
// @ts-ignore
import ScoreWorker from '../workers/score-track?worker';
import { setPlannerEnabled, setPlannerIsFreeDrawing, setPlannerRoute, setPlannerScore } from '../redux/planner-slice';
import { ScoreAndRoute } from './score/improvedScorer';
import { LeagueCode } from "./score/league";

// Uploads files to the server and adds the tracks.
// after loading, the planner menu is displayed to permit
// score computation on loaded tracks
export async function uploadTracks(files: File[]): Promise<number[]> {
  if (files.length == 0) {
    return [];
  }
  const formData = new FormData();
  files.forEach((track) => formData.append('track', track));
  store.dispatch(setPlannerEnabled(true));
  store.dispatch(setPlannerIsFreeDrawing(false))
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

export function scoreTrack(track: RuntimeTrack, leagueCode: LeagueCode) {
  getScoreWorker(store.dispatch).postMessage({ track, leagueCode });
}

let scoreWorker: Worker | undefined;

function getScoreWorker(dispatch: AppDispatch): Worker {
  if (!scoreWorker) {
    scoreWorker = new ScoreWorker() as Worker;
    scoreWorker.onmessage = (msg: MessageEvent<ScoreAndRoute>) => {
      const { score, route } = msg.data;
      dispatch(setPlannerEnabled(true));
      dispatch(setPlannerIsFreeDrawing(false));
      dispatch(setPlannerRoute(getEncodedRoute(route)));
      dispatch(setPlannerScore(score));
    };
  }
  return scoreWorker;
}

function getEncodedRoute(route: Point[]) {
  const gRoute = route.map((it) => new google.maps.LatLng({ lat: it.y, lng: it.x }));
  return google.maps.geometry.encoding.encodePath(gRoute);
}

