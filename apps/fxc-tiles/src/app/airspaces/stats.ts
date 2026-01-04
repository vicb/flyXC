import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAppFolderFromDist } from '../util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputFolder = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces'));

const airspaces = JSON.parse(readFileSync(join(inputFolder, 'openaip.json'), 'utf-8'));

const classes = new Map([
  [0, 'A'],
  [1, 'B'],
  [2, 'C'],
  [3, 'D'],
  [4, 'E'],
  [5, 'F'],
  [6, 'G'],
  [8, 'Unclassified / Special Use Airspace (SUA)'],
]);

const types = new Map([
  [0, 'Other'],
  [1, 'Restricted'],
  [2, 'Danger'],
  [3, 'Prohibited'],
  [4, 'Controlled Tower Region (CTR)'],
  [5, 'Transponder Mandatory Zone (TMZ)'],
  [6, 'Radio Mandatory Zone (RMZ)'],
  [7, 'Terminal Maneuvering Area (TMA)'],
  [8, 'Temporary Reserved Area (TRA)'],
  [9, 'Temporary Segregated Area (TSA)'],
  [10, 'Flight Information Region (FIR)'],
  [11, 'Upper Flight Information Region (UIR)'],
  [12, 'Air Defense Identification Zone (ADIZ)'],
  [13, 'Airport Traffic Zone (ATZ)'],
  [14, 'Military Airport Traffic Zone (MATZ)'],
  [15, 'Airway'],
  [16, 'Military Training Route (MTR)'],
  [17, 'Alert Area'],
  [18, 'Warning Area'],
  [19, 'Protected Area'],
  [20, 'Helicopter Traffic Zone (HTZ)'],
  [21, 'Gliding Sector'],
  [22, 'Transponder Setting (TRP)'],
  [23, 'Traffic Information Zone (TIZ)'],
  [24, 'Traffic Information Area (TIA)'],
  [25, 'Military Training Area (MTA)'],
  [26, 'Controlled Area (CTA)'],
  [27, 'ACC Sector (ACC)'],
  [28, 'Aerial Sporting Or Recreational Activity'],
  [29, 'Low Altitude Overflight Restriction'],
  [30, 'Military Route (MRT)'],
  [31, 'TSA/TRA Feeding Route (TFR)'],
  [32, 'VFR Sector'],
]);

const geoType = new Set();
const type = new Set();
const icaoClass = new Set();
const limitUnit = new Set();
const limitDatum = new Set();
const country = new Set();
const classTypes = new Set();
const classCount = new Map();
const typeCount = new Map();
const typeWithClassABCDE = new Set();

const typeCountWhenActivity = new Map();
const classCountWhenActivity = new Map();

const CTR = new Set();
const RMZ = new Set();
const TMA = new Set();
const TMZ = new Set();
const ATZ = new Set();
const FIR = new Set();

for (const airspace of airspaces) {
  typeCount.set(airspace.type, (typeCount.get(airspace.type) ?? 0) + 1);
  classCount.set(airspace.icaoClass, (classCount.get(airspace.icaoClass) ?? 0) + 1);
  if (airspace.activity > 0) {
    typeCountWhenActivity.set(airspace.type, (typeCountWhenActivity.get(airspace.type) ?? 0) + 1);
    classCountWhenActivity.set(airspace.icaoClass, (classCountWhenActivity.get(airspace.icaoClass) ?? 0) + 1);
  }
  if (airspace.icaoClass <= 4) {
    typeWithClassABCDE.add(airspace.type);
  }
  type.add(airspace.type);
  icaoClass.add(airspace.icaoClass);
  geoType.add(airspace.geometry.type);
  limitUnit.add(airspace.upperLimit.unit);
  limitDatum.add(airspace.upperLimit.referenceDatum);
  limitUnit.add(airspace.lowerLimit.unit);
  limitDatum.add(airspace.lowerLimit.referenceDatum);
  country.add(airspace.country);
  classTypes.add(`${classes.get(Number(airspace.icaoClass))} - ${types.get(Number(airspace.type))}`);

  switch (airspace.type) {
    case 4:
      CTR.add(getClassLabel(airspace.icaoClass));
      break;
    case 6:
      RMZ.add(getClassLabel(airspace.icaoClass));
      break;
    case 7:
      TMA.add(getClassLabel(airspace.icaoClass));
      break;
    case 5:
      TMZ.add(getClassLabel(airspace.icaoClass));
      break;
    case 13:
      ATZ.add(getClassLabel(airspace.icaoClass));
      break;
    case 10:
      FIR.add(getClassLabel(airspace.icaoClass));
      break;
  }
}

function getClassLabel(id: number): string {
  return classes.has(id) ? `${classes.get(id)} (${id})` : `Unknown (${id})`;
}

function getTypeLabel(id: number): string {
  return types.has(id) ? `${types.get(id)} (${id})` : `Unknown (${id})`;
}

console.log(`Total airspaces: ${airspaces.length}`);
console.log(
  `type`,
  Array.from(type).map((type: number) => getTypeLabel(type)),
);
console.log(
  `type (class A, B, C, E)`,
  Array.from(typeWithClassABCDE).map((type: number) => getTypeLabel(type)),
);
console.log(`icaoClass`, icaoClass);
console.log(`geoType`, geoType);
console.log(`limitUnit`, limitUnit);
console.log(`limitDatum`, limitDatum);
console.log(`country`, country);
console.log(`classTypes`, Array.from(classTypes).sort());

console.log('CTR icao classes: ', CTR);
console.log('RMZ icao classes: ', RMZ);
console.log('TMA icao classes: ', TMA);
console.log('TMZ icao classes: ', TMZ);
console.log('ATZ icao classes: ', ATZ);
console.log('FIR icao classes: ', FIR);

console.log('* types -> count');
for (const [type, count] of typeCount.entries()) {
  console.log(` - ${getTypeLabel(type)}: ${count}`);
}

console.log('* classes -> count');
for (const [cl, count] of classCount.entries()) {
  console.log(` - ${getClassLabel(cl)}: ${count}`);
}

console.log('* types -> count (when activity)');
for (const [type, count] of typeCountWhenActivity.entries()) {
  console.log(` - ${getTypeLabel(type)}: ${count}`);
}

console.log('* classes -> count (when activity)');
for (const [cl, count] of classCountWhenActivity.entries()) {
  console.log(` - ${getClassLabel(cl)}: ${count}`);
}
