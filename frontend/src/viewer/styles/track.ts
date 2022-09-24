export function getUniqueColor(uid: number): string {
  return distinctColors[uid % distinctColors.length];
}

// From http://phrogz.net/tmp/24colors.html.
const distinctColors = [
  '#FF0000',
  '#FFFF00',
  '#00EAFF',
  '#AA00FF',
  '#FF7F00',
  '#BFFF00',
  '#0095FF',
  '#FF00AA',
  '#FFD400',
  '#6AFF00',
  '#0040FF',
  '#EDB9B9',
  '#B9D7ED',
  '#E7E9B9',
  '#DCB9ED',
  '#B9EDE0',
  '#8F2323',
  '#23628F',
  '#8F6A23',
  '#6B238F',
  '#4F8F23',
  '#000000',
  '#737373',
  '#CCCCCC',
];

export function getUniqueContrastColor(uid: number): string {
  return distinctContrastColors[uid % distinctColors.length];
}

// http://phrogz.net/css/distinct-colors.html
const distinctContrastColors = [
  '#cc2929',
  '#590c00',
  '#e55c00',
  '#7f5233',
  '#593c00',
  '#e5a82e',
  '#8c8738',
  '#e5f230',
  '#5db324',
  '#44ff00',
  '#396629',
  '#2bd988',
  '#008066',
  '#29c1cc',
  '#2ea8e6',
  '#38708c',
  '#122e59',
  '#002999',
  '#5779d9',
  '#0a004d',
  '#7461f2',
  '#4100f2',
  '#cd2bd9',
  '#7a3380',
  '#e60099',
  '#4c0029',
  '#f23064',
  '#a6425d',
];
