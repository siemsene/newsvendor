function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredString(key: string): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function saveStoredString(key: string, value: string): void {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures so the app still boots in restricted contexts.
  }
}
