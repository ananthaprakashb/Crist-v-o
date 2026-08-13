const STORAGE_KEY = 'cristovao:synthetic-source-change';

export function isSourceImpactDemoActive() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSourceImpactDemoActive(active: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (active) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is optional; the control can still reload without persistence.
  }
}
