const LOG_KEY = 'profitly-activity-log';
const MAX_ENTRIES = 200;

interface ActivityLog {
  timestamp: string;
  action: string;
  role: string;
  userId?: string;
}

export function logActivity(action: string, role: string, userId?: string): void {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const logs: ActivityLog[] = raw ? JSON.parse(raw) : [];
    logs.unshift({ timestamp: new Date().toISOString(), action, role, userId });
    if (logs.length > MAX_ENTRIES) logs.length = MAX_ENTRIES;
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch { /* non-fatal */ }
}

export function getLogs(): ActivityLog[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
