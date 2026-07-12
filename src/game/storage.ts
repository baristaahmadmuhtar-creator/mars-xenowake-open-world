export type Quality = 'low' | 'high';

export interface GameSettings {
  muted: boolean;
  quality: Quality;
}

export interface GameStorageState {
  settings: GameSettings;
  /** Best completion time in milliseconds, or null before the first win. */
  bestTime: number | null;
}

interface PersistedGameStorageState extends GameStorageState {
  version: 1;
}

export const STORAGE_KEY = 'mars-xenowake:save:v1';

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  muted: false,
  quality: 'high',
});

let memoryState: GameStorageState = createDefaultState();
let persistentStorageUnavailable = false;

function createDefaultState(): GameStorageState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    bestTime: null,
  };
}

function cloneState(state: GameStorageState): GameStorageState {
  return {
    settings: { ...state.settings },
    bestTime: state.bestTime,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQuality(value: unknown): value is Quality {
  return value === 'low' || value === 'high';
}

function isValidTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeSettings(value: unknown, fallback: GameSettings): GameSettings {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  return {
    muted: typeof value.muted === 'boolean' ? value.muted : fallback.muted,
    quality: isQuality(value.quality) ? value.quality : fallback.quality,
  };
}

function normalizeBestTime(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }
  return isValidTime(value) ? value : fallback;
}

function normalizeState(value: unknown, fallback: GameStorageState): GameStorageState | null {
  if (!isRecord(value)) {
    return null;
  }

  // Accept the current nested shape and the flat shape used by early builds.
  // Valid fields survive even when a sibling field has become corrupted.
  const settingsValue = isRecord(value.settings) ? value.settings : value;
  return {
    settings: normalizeSettings(settingsValue, fallback.settings),
    bestTime: normalizeBestTime(value.bestTime, fallback.bestTime),
  };
}

function getPersistentStorage(): Storage | null {
  if (persistentStorageUnavailable || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    persistentStorageUnavailable = true;
    return null;
  }
}

function removeCorruptedValue(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    persistentStorageUnavailable = true;
  }
}

function writeState(state: GameStorageState): void {
  memoryState = cloneState(state);
  const storage = getPersistentStorage();
  if (storage === null) {
    return;
  }

  const persisted: PersistedGameStorageState = {
    version: 1,
    ...cloneState(state),
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Safari private mode, a full quota, and restrictive iframe policies may
    // all reject writes. The in-memory copy remains usable for this session.
    persistentStorageUnavailable = true;
  }
}

export function loadGameData(): GameStorageState {
  const storage = getPersistentStorage();
  if (storage === null) {
    return cloneState(memoryState);
  }

  let serialized: string | null;
  try {
    serialized = storage.getItem(STORAGE_KEY);
  } catch {
    persistentStorageUnavailable = true;
    return cloneState(memoryState);
  }

  if (serialized === null) {
    return cloneState(memoryState);
  }

  try {
    const normalized = normalizeState(JSON.parse(serialized) as unknown, memoryState);
    if (normalized === null) {
      removeCorruptedValue(storage);
      return cloneState(memoryState);
    }

    memoryState = normalized;
    return cloneState(normalized);
  } catch {
    removeCorruptedValue(storage);
    return cloneState(memoryState);
  }
}

export function saveGameData(state: GameStorageState): GameStorageState {
  const current = loadGameData();
  const normalized = normalizeState(state, current) ?? current;
  writeState(normalized);
  return cloneState(normalized);
}

export function loadSettings(): GameSettings {
  return loadGameData().settings;
}

export function saveSettings(settings: GameSettings): GameSettings {
  const current = loadGameData();
  const normalized = normalizeSettings(settings, current.settings);
  writeState({ ...current, settings: normalized });
  return { ...normalized };
}

export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  const current = loadGameData();
  return saveSettings({ ...current.settings, ...patch });
}

export function loadBestTime(): number | null {
  return loadGameData().bestTime;
}

export function saveBestTime(bestTime: number | null): number | null {
  const current = loadGameData();
  const normalized = normalizeBestTime(bestTime, current.bestTime);
  writeState({ ...current, bestTime: normalized });
  return normalized;
}

/** Save a time only when it is the player's first or fastest completed run. */
export function recordBestTime(elapsedMilliseconds: number): number | null {
  const current = loadGameData();
  if (!isValidTime(elapsedMilliseconds)) {
    return current.bestTime;
  }

  if (current.bestTime === null || elapsedMilliseconds < current.bestTime) {
    writeState({ ...current, bestTime: elapsedMilliseconds });
    return elapsedMilliseconds;
  }

  return current.bestTime;
}

export function clearGameData(): void {
  memoryState = createDefaultState();
  const storage = getPersistentStorage();
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    persistentStorageUnavailable = true;
  }
}

export const gameStorage = Object.freeze({
  load: loadGameData,
  save: saveGameData,
  loadSettings,
  saveSettings,
  updateSettings,
  loadBestTime,
  saveBestTime,
  recordBestTime,
  clear: clearGameData,
});
