const PLUGIN_NAMESPACE = 'fxc-sounding:';

export const Settings = {
  location: 1,
  model: 2,
} as const;

type SettingKey = (typeof Settings)[keyof typeof Settings];

export function loadSetting(key: SettingKey): string | undefined {
  const value = localStorage.getItem(`${PLUGIN_NAMESPACE}${key}`);
  return value === null ? undefined : value;
}

export function saveSetting(key: SettingKey, value: string): void {
  localStorage.setItem(`${PLUGIN_NAMESPACE}${key}`, value);
}
