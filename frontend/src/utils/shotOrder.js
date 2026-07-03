// Shared ordering for shot-list blocks (scenes + breaks).

// Parse a display time like "9:00 AM" / "12:30 PM" into minutes-since-midnight.
// Returns null for empty / unparseable values.
export function parseShotTime(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let [, h, min, mer] = m;
  h = parseInt(h, 10); min = parseInt(min, 10);
  if (mer.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (mer.toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

// Order blocks by their estimated start time so breaks (and scenes) fall into
// the timeline where they belong. Blocks with a start time sort to that time;
// blocks without one stay anchored to the block that precedes them (stable
// carry-forward), so an untimed scene never jumps around when a timed break is
// added elsewhere.
export function orderShotBlocks(blocks) {
  let prev = -1; // leading untimed blocks stay at the top
  return blocks
    .map((b, i) => {
      const m = parseShotTime(b.est_start_time);
      const eff = m == null ? prev : m;
      prev = eff;
      return { b, eff, i };
    })
    .sort((a, z) => a.eff - z.eff || a.i - z.i)
    .map((x) => x.b);
}
