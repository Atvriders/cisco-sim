import type { DeviceState } from './types';

const KEY = 'cisco-sim-startup-config';

export function loadSavedConfig(): Partial<DeviceState> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<DeviceState>;
  } catch {
    return null;
  }
}

export function saveConfig(state: DeviceState): void {
  try {
    // Don't save startupConfig inside startupConfig (circular)
    const { startupConfig: _sc, ...toSave } = state;
    localStorage.setItem(KEY, JSON.stringify(toSave));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function clearSavedConfig(): void {
  localStorage.removeItem(KEY);
}
