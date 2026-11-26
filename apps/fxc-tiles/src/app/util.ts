import path from 'node:path';

/**
 * @param pathName Some path in the dist folder
 * @returns The app path, i.e. `/path/to/apps/fxc-tiles/`
 */
export function getAppFolderFromDist(pathName: string) {
  return pathName.replace(/\/dist\/.*/, '');
}
