import path from 'node:path';

export function printOnCurrentLine(msg: string) {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(msg);
}

/**
 * @param pathName Some path in the dist folder
 * @returns The app path, i.e. `/path/to/apps/fxc-tiles/`
 */
export function getAppFolderFromDist(pathName: string) {
  return pathName.replace(/\/dist\/.*/, '');
}
