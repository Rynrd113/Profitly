import { storageGet } from './storage';

export const BACKUP_KEYS = [
  'profitly-saved-raw-ingredients',
  'profitly-sales-records',
  'profitly-saved-recipes',
  'profitly-stock-transactions',
  'profitly-derived-ingredients',
  'profitly-monthly-opex',
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

export interface BackupPayload {
  version: string;
  appName: string;
  exportedAt: string;
  data: Partial<Record<BackupKey, unknown>>;
}

export function exportBackup(): void {
  const payload: BackupPayload = {
    version: '1.0',
    appName: 'ProfitLy',
    exportedAt: new Date().toISOString(),
    data: {},
  };

  for (const key of BACKUP_KEYS) {
    const value = storageGet<unknown>(key);
    if (value !== null) payload.data[key] = value;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date()
    .toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '-');
  a.href = url;
  a.download = `profitly-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importBackup(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const payload = JSON.parse(e.target?.result as string) as BackupPayload;
        if (!payload.data) throw new Error('Format backup tidak valid');
        for (const [key, value] of Object.entries(payload.data)) {
          if (key.startsWith('profitly-') && value !== undefined) {
            localStorage.setItem(key, btoa(encodeURIComponent(JSON.stringify(value))));
          }
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file);
  });
}
