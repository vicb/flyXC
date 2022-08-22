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

const distinctContrastColors = [
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
  '#8F2323',
  '#23628F',
  '#8F6A23',
  '#6B238F',
  '#4F8F23',
  '#000000',
  '#737373',
];
