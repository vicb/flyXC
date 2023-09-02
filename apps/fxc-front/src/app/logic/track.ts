import {extractGroupId, RuntimeTrack} from '@flyxc/common';

import { unwrapResult } from '@reduxjs/toolkit';

import {AppDispatch, store} from '../redux/store';
import { currentLeague } from '../redux/selectors';
import {fetchTrack, RuntimeTrackId, setScore as setTrackStore} from '../redux/track-slice';
// @ts-ignore
import ScoreWorker from '../workers/score-track?worker';
import {Request as ScoreRequest, Response as ScoreResponse} from '../workers/score-track'
import {
  setIsFreeDrawing as setPlannerIsFreeDrawing,
  setEnabled as setPlannerEnabled,
  setRoute as setPlannerRoute,
  setScore as setPlannerScore
} from '../redux/planner-slice';
import { Point, ScoreInfo } from 'igc-xc-score';
import { CircuitType, Score } from "./score/scorer";

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

export function scoreTrack(track: RuntimeTrack){
	const request: ScoreRequest = {track: track, league: currentLeague(store.getState())}
	getScoreWorker(store.dispatch).postMessage(request)
}

let scoreWorker: Worker | undefined;

function getScoreWorker(dispatch: AppDispatch): Worker {
  if (!scoreWorker){
    scoreWorker = new ScoreWorker() as Worker;
    scoreWorker.onmessage = (msg: MessageEvent<ScoreResponse & RuntimeTrackId>) => {
      const data = msg.data;
      const {encodedRoute, indexes} = getEncodeRouteAndIndices(data.scoreInfo);
      const score: Score = {
        circuit: circuitType(data.scoring.code as CircuitTypeCode),
        points: data.scoreInfo.score,
        distance: data.scoreInfo.distance,
        multiplier: data.scoring.multiplier,
        closingRadius: null,
        indexes: indexes
      }
      dispatch(setPlannerEnabled(true));
      dispatch(setPlannerIsFreeDrawing(false))
      dispatch(setPlannerRoute(encodedRoute));
      dispatch(setPlannerScore(score));
      dispatch(setTrackStore({...score, id: data.trackId}))
    }
  }
  return scoreWorker
}

type CircuitTypeCode = "od" | "tri" | "fai" | "oar"
function circuitType(code: CircuitTypeCode){
  switch (code) {
    case "od":return CircuitType.OpenDistance;
    case "fai": return CircuitType.FaiTriangle
    case "oar": return CircuitType.OutAndReturn
    case "tri": return CircuitType.FlatTriangle
  }
}

function getEncodeRouteAndIndices(scoreInfo: ScoreInfo) {
  const legs = scoreInfo.legs;
  let indexes:number[]=[];
  let encodedRoute = "";
  if (!legs) {
    return {encodedRoute, indexes}
  }
  let path: google.maps.LatLng[] = []

  let currentIndex =-1;
  function addPoint(point: Point) {
    const latLng = getLatLng(point);
    if (latLng) {
      path.push(latLng);
      currentIndex++;
      indexes.push(currentIndex);
      return true;
    }
    return false;
  }

  // entry point
  if (scoreInfo.ep){
    addPoint(scoreInfo.ep.start);
  }
  // closing point
  if (scoreInfo.cp) {
    addPoint(scoreInfo.cp.in);
  }
  legs.forEach(leg => {
    addPoint(leg.start)
  });
  if (scoreInfo.cp) {
    addPoint(scoreInfo.cp.out);
  }
  if (scoreInfo.ep){
    addPoint(scoreInfo.ep.finish);
  }
  console.info("path to encode", path.map(it=>({lat:it.lat(),lng:it.lng()})))
  encodedRoute = google.maps.geometry.encoding.encodePath(path);
  return {encodedRoute, indexes};
}

function getLatLng(start: Point) {
  if (start && isFinite(start.x) && isFinite(start.y) && !isNaN(start.x) && !isNaN(start.y))
	return new google.maps.LatLng({lat: start.y, lng: start.x});
  else
    return undefined
}
