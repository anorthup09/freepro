// Most-recently-viewed project tracking for the hub's Project Hub ordering.
// Stored per browser in localStorage: { [projectId]: lastViewedMs }
const KEY = 'recent_projects';

export function markRecentProject(pid) {
  if (!pid) return;
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || '{}');
    m[pid] = Date.now();
    // keep the map from growing unbounded
    const entries = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 100);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* storage unavailable */ }
}

export function recentProjectTimes() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
