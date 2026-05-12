// Simple base64 obfuscation for localStorage.
// Hides data from casual inspection; not cryptographically secure.
// Backwards-compatible: falls back to plain JSON for unencoded legacy values.

export function storageSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, btoa(encodeURIComponent(JSON.stringify(data))));
  } catch {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

export function storageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(atob(raw))) as T;
    } catch {
      // Legacy plain-JSON — migrates automatically on next write
      return JSON.parse(raw) as T;
    }
  } catch {
    return null;
  }
}
