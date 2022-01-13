import { getDistance, getGreatCircleBearing, toDeg, toRad } from 'geolib';

import { LatLon } from 'flyxc/common/src/runtime-track';

const SECTOR_COLORS = ['#f00', '#0f0', '#00f'];

export class FaiSectors {
  polygons: google.maps.Polygon[] = [];

  constructor() {
    for (let i = 0; i < 3; i++) {
      this.polygons.push(
        new google.maps.Polygon({
          strokeColor: SECTOR_COLORS[i],
          fillColor: SECTOR_COLORS[i],
          fillOpacity: 0.3,
          strokeOpacity: 0.5,
          strokeWeight: 1,
          zIndex: 10,
        }),
      );
    }
  }

  addListeners(name: string, handler: (...args: any[]) => void): google.maps.MapsEventListener[] {
    return this.polygons.map((p) => p.addListener(name, handler));
  }

  setMap(map?: google.maps.Map | null): void {
    this.polygons.forEach((p) => p.setMap(map ?? null));
  }

  update(points: LatLon[]): void {
    const v0 = [points[0].lat - points[1].lat, points[0].lon - points[1].lon];
    const v1 = [points[2].lat - points[1].lat, points[2].lon - points[1].lon];
    const reverse = v0[0] * v1[1] - v0[1] * v1[0] < 0;
    [
      generateFAITriangleArea(points[0], points[1], reverse),
      generateFAITriangleArea(points[1], points[2], reverse),
      generateFAITriangleArea(points[2], points[0], reverse),
    ].forEach((path, i) => {
      this.polygons[i].setPath(path);
    });
  }
}

const SMALL_MIN_LEG = 0.28;
const SMALL_MAX_LEG = 1 - 2 * SMALL_MIN_LEG;
const STEPS = 15;
const FLATTENING = 1 / 298.257223563;
const EQUATOR_RADIUS = 6378137;
const POLE_RADIUS = EQUATOR_RADIUS * (1 - FLATTENING);
const FACTOR = (EQUATOR_RADIUS ** 2 - POLE_RADIUS ** 2) / POLE_RADIUS ** 2;

function calcUSquare(cosSqAlpha: number): number {
  return cosSqAlpha * FACTOR;
}

function calcA(uSq: number): number {
  const a16k = 16384 + uSq * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  return a16k / 16384;
}

function calcB(uSq: number): number {
  const b1k = uSq * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  return b1k / 1024;
}

function calcC(cosSqAlpha: number): number {
  return (FLATTENING / 16) * cosSqAlpha * (4 + FLATTENING * (4 - 3 * cosSqAlpha));
}

// Code adapted from XCSoar - https://github.com/XCSoar/XCSoar
function generateFAITriangleArea(point1: LatLon, point2: LatLon, reverse: boolean): google.maps.LatLng[] {
  const coords: google.maps.LatLng[] = [];
  const distance = getDistance(point1, point2);
  const bearing = toRad(getGreatCircleBearing(point1, point2));
  const distMax = distance / SMALL_MIN_LEG;
  const distMin = distance / SMALL_MAX_LEG;
  coords.push(
    ...generateFAITriangleRight(point1, distance, bearing, distMin, distMax, reverse),
    ...generateFAITriangleTop(point1, distance, bearing, distMax, reverse),
    ...generateFAITriangleLeft(point1, distance, bearing, distMin, distMax, reverse),
  );
  return coords;
}

function generateFAITriangleRight(
  origin: LatLon,
  distance: number,
  bearing: number,
  distMin: number,
  distMax: number,
  reverse: boolean,
): google.maps.LatLng[] {
  const coords: google.maps.LatLng[] = [];
  const deltaDistance = (distMax - distMin) / STEPS;
  let totalDistance = distMin;
  for (let i = 0; i < STEPS; ++i, totalDistance += deltaDistance) {
    const distA = SMALL_MIN_LEG * totalDistance;
    const distB = totalDistance - distA - distance;
    coords.push(calcGeoPoint(origin, bearing, distA, distB, distance, reverse));
  }

  return coords;
}

function generateFAITriangleTop(
  origin: LatLon,
  distance: number,
  bearing: number,
  distMax: number,
  reverse: boolean,
): google.maps.LatLng[] {
  const coords: google.maps.LatLng[] = [];
  const deltaDistance = (distMax * (1 - 3 * SMALL_MIN_LEG)) / STEPS;
  let distA = distance;
  let distB = distMax - distA - distance;
  for (let i = 0; i < STEPS; ++i, distA += deltaDistance, distB -= deltaDistance) {
    coords.push(calcGeoPoint(origin, bearing, distA, distB, distance, reverse));
  }
  return coords;
}

function generateFAITriangleLeft(
  origin: LatLon,
  distance: number,
  bearing: number,
  distMin: number,
  distMax: number,
  reverse: boolean,
): google.maps.LatLng[] {
  const coords: google.maps.LatLng[] = [];

  const deltaDistance = (distMax - distMin) / STEPS;
  let totalDistance = distMax;
  for (let i = 0; i < STEPS; ++i, totalDistance -= deltaDistance) {
    const distB = SMALL_MIN_LEG * totalDistance;
    const distA = totalDistance - distB - distance;
    coords.push(calcGeoPoint(origin, bearing, distA, distB, distance, reverse));
  }
  return coords;
}

function calcGeoPoint(
  origin: LatLon,
  angle: number,
  distA: number,
  distB: number,
  distC: number,
  reverse: boolean,
): google.maps.LatLng {
  return findLatitudeLongitude(origin, calcAngle(angle, distA, distB, distC, reverse), distB);
}

function calcAngle(angle: number, distA: number, distB: number, distC: number, reverse: boolean): number {
  const alpha = calcAlpha(distA, distB, distC);
  return reverse ? angle + alpha : angle - alpha;
}

function calcAlpha(distA: number, distB: number, distC: number): number {
  const cosAlpha = (distB ** 2 + distC ** 2 - distA ** 2) / (2 * distC * distB);
  return Math.acos(cosAlpha);
}

function findLatitudeLongitude(loc: LatLon, bearing: number, distance: number): google.maps.LatLng {
  const lon1 = toRad(loc.lon);
  const lat1 = toRad(loc.lat);

  const sinAlpha1 = Math.sin(bearing);
  const cosAlpha1 = Math.cos(bearing);

  const tanU1 = (1 - FLATTENING) * Math.tan(lat1);
  const cosU1 = 1 / Math.sqrt(1 + tanU1 ** 2);
  const sinU1 = tanU1 * cosU1;

  const sigma1 = Math.atan2(tanU1, cosAlpha1);

  const sinAlpha = cosU1 * sinAlpha1;
  const cosSqAlpha = 1 - sinAlpha ** 2;

  const uSq = calcUSquare(cosSqAlpha);
  const a = calcA(uSq);
  const b = calcB(uSq);

  let sigma = distance / (POLE_RADIUS * a);
  let sigmaP = 2 * Math.PI;

  let sinSigma, cosSigma, cos2SigmaM;

  do {
    cos2SigmaM = Math.cos(2 * sigma1 + sigma);
    sinSigma = Math.sin(sigma);
    cosSigma = Math.cos(sigma);

    const deltaSigma =
      b *
      sinSigma *
      (cos2SigmaM +
        (b / 4) *
          (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
            (b / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
    sigmaP = sigma;
    sigma = distance / (POLE_RADIUS * a) + deltaSigma;
  } while (Math.abs(sigma - sigmaP) > 1e-7);

  const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
  const lat2 = Math.atan2(
    sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
    (1 - FLATTENING) * Math.sqrt(sinAlpha ** 2 + tmp ** 2),
  );

  const lambda = Math.atan2(sinSigma * sinAlpha1, cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1);

  const c = calcC(cosSqAlpha);

  const l =
    lambda -
    (1 - c) * FLATTENING * sinAlpha * (sigma + c * sinSigma * (cos2SigmaM + c * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));

  return new google.maps.LatLng(toDeg(lat2), toDeg(lon1 + l));
}
