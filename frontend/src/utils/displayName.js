export function displayName(m) {
  if (!m) return '';
  const first = m.preferredFirstName || m.preferred_first_name || '';
  const last = m.preferredLastName || m.preferred_last_name || '';
  if (first || last) return [first, last].filter(Boolean).join(' ');
  return m.name || '';
}
