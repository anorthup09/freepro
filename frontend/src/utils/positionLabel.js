// Number positions that appear more than once within a set of crew assignments:
// On-Site Editor 1, On-Site Editor 2, … A position with a single slot is left
// unnumbered. Numbering follows slot_number order so labels are stable and match
// the Crew tab. Keyed by assignment id.
//
// Assignments come straight off the API row, so position id lives at either
// a.position.id or a.position_id, and the slot at a.slot_number.
export function positionLabels(assignments) {
  const byPos = {};
  (assignments || []).forEach(a => {
    const pid = a.position?.id || a.position_id;
    if (pid == null) return;
    (byPos[pid] ||= []).push(a);
  });
  const labels = {};
  Object.values(byPos).forEach(list => {
    if (list.length < 2) return;
    [...list]
      .sort((x, y) => (Number(x.slot_number) || 0) - (Number(y.slot_number) || 0))
      .forEach((a, i) => { labels[a.id] = i + 1; });
  });
  return labels;
}

// Position name with its slot number appended when the position is one of
// several of the same kind. `labels` comes from positionLabels().
export function positionName(a, labels) {
  const base = a.position?.name || '';
  const n = labels && labels[a.id];
  return n ? `${base} ${n}` : base;
}
