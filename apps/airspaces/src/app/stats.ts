import { readFileSync } from 'node:fs';

const airspaces = JSON.parse(readFileSync('asp/airspaces.json', 'utf-8'));

const classes = new Map([
  [0, 'A'],
  [1, 'B'],
  [2, 'C'],
  [3, 'D'],
  [4, 'E'],
  [5, 'F'],
  [6, 'G'],
  [7, 'Special Use Airspace (SUA)'],
  [8, 'Unclassified'],
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
]);

const geoType = new Set();
const type = new Set();
const icaoClass = new Set();
const limitUnit = new Set();
const limitDatum = new Set();
const country = new Set();
const classTypes = new Set();

const CTR = new Set();
const RMZ = new Set();
const TMA = new Set();
const TMZ = new Set();
const ATZ = new Set();
const FIR = new Set();

for (const airspace of airspaces) {
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
      CTR.add(airspace.icaoClass);
      break;
    case 6:
      RMZ.add(airspace.icaoClass);
      break;
    case 7:
      TMA.add(airspace.icaoClass);
      break;
    case 5:
      TMZ.add(airspace.icaoClass);
      break;
    case 13:
      ATZ.add(airspace.icaoClass);
      break;
    case 10:
      FIR.add(airspace.icaoClass);
      break;
  }
}

console.log(`Total airspaces: ${airspaces.length}`);
console.log(`type`, type);
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

// Total airspaces: 19006
// type Set(15) { 2, 1, 21, 0, 4, 6, 3, 18, 5, 13, 10, 26, 23, 24, 8 }
// icaoClass Set(8) { 7, 4, 1, 3, 6, 2, 0, 5 }
// geoType Set(1) { 'Polygon' }
// limitUnit Set(2) { 6, 1 }
// limitDatum Set(3) { 2, 0, 1 }

// classTypes [
//   'A - Other',
//   'B - Other',
//   'C - Controlled Area (CTA)  ',
//   'C - Controlled Tower Region (CTR)',
//   'C - Other',
//   'D - Controlled Tower Region (CTR)',
//   'D - Other',
//   'E - Other',
//   'F - Other',
//   'G - Airport Traffic Zone (ATZ)',
//   'G - Other',
//   'G - Traffic Information Area (TIA)',
//   'G - Traffic Information Zone (TIZ)',
//   'Special Use Airspace (SUA) - Airport Traffic Zone (ATZ)',
//   'Special Use Airspace (SUA) - Controlled Tower Region (CTR)',
//   'Special Use Airspace (SUA) - Danger',
//   'Special Use Airspace (SUA) - Flight Information Region (FIR)',
//   'Special Use Airspace (SUA) - Gliding Sector',
//   'Special Use Airspace (SUA) - Other',
//   'Special Use Airspace (SUA) - Prohibited',
//   'Special Use Airspace (SUA) - Radio Mandatory Zone (RMZ)',
//   'Special Use Airspace (SUA) - Restricted',
//   'Special Use Airspace (SUA) - Temporary Reserved Area (TRA)',
//   'Special Use Airspace (SUA) - Transponder Mandatory Zone (TMZ)',
//   'Special Use Airspace (SUA) - Warning Area'
// ]
