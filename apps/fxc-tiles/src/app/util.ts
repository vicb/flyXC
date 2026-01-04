import path from 'node:path';

export function printOnCurrentLine(msg: string) {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(msg);
}

export function getAppFolderFromDist(pathName: string) {
  return path.resolve(pathName, '../..');
}
