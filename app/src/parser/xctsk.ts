// https://xctrack.org/Competition_Interfaces.html

import { Route } from 'flyxc/common/protos/track';

export function parse(content: string): Route | null {
  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    return null;
  }

  if (json.taskType !== 'CLASSIC') {
    return null;
  }

  if (json.version !== 1) {
    return null;
  }

  if (!Array.isArray(json.turnpoints) || json.turnpoints.length < 2) {
    return null;
  }

  const route = Route.create();

  json.turnpoints.forEach((tp: any) => {
    route.lat.push(Number(tp.waypoint?.lat ?? 0));
    route.lon.push(Number(tp.waypoint?.lon ?? 0));
    route.alt.push(Number(tp.waypoint?.altSmoothed ?? 0));
  });

  return route;
}
