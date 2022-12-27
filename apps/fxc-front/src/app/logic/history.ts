export enum ParamNames {
  // URL of a track file (multiple).
  trackUrl = 'track',
  // ID of a track group (multiple).
  groupId = 'id',
  // Encoded route.
  route = 'p',
  league = 'l',
  speed = 's',
  view3d = '3d',
}
// Pushes the current URL on the stack to create a checkpoint.
export function pushCurrentState(): void {
  history.pushState({}, '', getCurrentUrl().href);
}

// Returns whether the URL contains any track or route.
//
// When the URL contains a track or a route, flyxc would center on that.
export function hasTrackOrRoute(): boolean {
  const params = getSearchParams();
  return params.has(ParamNames.groupId) || params.has(ParamNames.trackUrl) || params.has(ParamNames.route);
}

// Returns the list of values of an URL search parameter.
export function getUrlParamValues(name: string): string[] {
  const url = getCurrentUrl();
  const params = getSearchParams(url);
  const values = params.getAll(name);
  updateUrl(url);
  return values;
}

// Deletes all the values for the given parameter.
export function deleteUrlParam(name: string): void {
  const url = getCurrentUrl();
  const params = getSearchParams(url);
  params.delete(name);
  updateUrl(url);
}

// Adds a value to the list of values for this parameter.
//
// Note: the value is not added if already present.
export function addUrlParamValue(name: string, value: string): void {
  const url = getCurrentUrl();
  const params = getSearchParams(url);
  const values = params.getAll(name);
  if (values.indexOf(value) == -1) {
    params.append(name, value);
  }
  updateUrl(url);
}

// Adds multiple values for the given parameter.
export function addUrlParamValues(name: string, values: Array<string | number>): void {
  values.map((v) => addUrlParamValue(name, String(v)));
}

// Sets the value of an URL parameter.
export function setUrlParamValue(name: string, value: string): void {
  const url = getCurrentUrl();
  const params = getSearchParams(url);
  params.set(name, value);
  updateUrl(url);
}

// Removes a single value from the values of one parameter.
//
// Returns whether the values has effectively been removed (i.e. was present in the URL).
export function deleteUrlParamValue(name: string, value: string): boolean {
  let deleted = false;
  const url = getCurrentUrl();
  const params = getSearchParams(url);
  const values = params.getAll(name);
  params.delete(name);
  values.forEach((v) => {
    if (v == value) {
      deleted = true;
    } else {
      params.append(name, v);
    }
  });
  updateUrl(url);
  return deleted;
}

// Returns the current URL.
export function getCurrentUrl(): URL {
  return new URL(document.location.href);
}

// Returns the search params for the passed url.
export function getSearchParams(url: URL = getCurrentUrl()): URLSearchParams {
  return url.searchParams;
}

// Update the current URL without pushing a new state.
function updateUrl(url: URL) {
  history.replaceState({}, '', url.href);
}
