import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';

// Subscriptions register — post-pro tools/logins, grouped by type. Passwords are
// deliberately not stored here (use Bitwarden). Types persist for reuse.
const ACCENT = '#c084fc';
const lbl = { fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' };
const th = { padding: '8px 12px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '8px 12px', fontSize: 12, verticalAlign: 'middle' };
const NEW_TYPE = '__new__';

const linkHref = url => { const u = (url || '').trim(); if (!u) return null; return /^https?:\/\//i.test(u) ? u : `https://${u}`; };
const BLANK = { type: '', name: '', website: '', loginName: '' };

export default function SubscriptionsReport() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [types, setTypes] = useState([]);
  const [open, setOpen] = useState(false);       // form expanded
  const [f, setF] = useState(BLANK);
  const [typeMode, setTypeMode] = useState('');   // '' = pick existing, NEW_TYPE = typing new
  const [newType, setNewType] = useState('');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { api.subscriptions().then(d => { setItems(d.items); setTypes(d.types); }).catch(e => alert(e.message)); }, []);

  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const resolvedType = typeMode === NEW_TYPE ? newType.trim() : f.type;
  const canSubmit = resolvedType && f.name.trim();

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const d = await api.createSubscription({ ...f, type: resolvedType });
      setItems(is => [...(is || []), d.item]);
      setTypes(d.types);
      setF(BLANK); setTypeMode(''); setNewType('');
    } catch (e) { alert(e.message); }
    setSaving(false);
  }
  async function remove(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await api.deleteSubscription(id); setItems(is => is.filter(i => i.id !== id)); }
    catch (e) { alert(e.message); }
  }

  const shown = (items || []).filter(i => !q.trim() || [i.type, i.name, i.website, i.login_name].some(v => (v || '').toLowerCase().includes(q.trim().toLowerCase())));
  // Group by type, alphabetically; untyped last.
  const groups = {};
  for (const i of shown) { const k = i.type || 'Uncategorized'; (groups[k] ||= []).push(i); }
  const groupKeys = Object.keys(groups).sort((a, b) => (a === 'Uncategorized') - (b === 'Uncategorized') || a.localeCompare(b));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <span style={{ fontSize: 12, color: '#e6c229', fontWeight: 700, letterSpacing: '0.04em' }}>Reports & Resources</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Reports</Link>
          <HomeButton />
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Subscriptions</div>
            <div className="page-sub">Post-production tools and logins, grouped by type{items && <span> · {items.length}</span>}</div>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
            style={{ fontSize: 12, padding: '7px 12px', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)' }} />
        </div>

        {/* Password warning */}
        <div style={{ marginTop: 14, background: 'rgba(224,82,82,0.10)', border: '1px solid #e05252', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#ff6b6b' }}>
          Passwords are not saved on this site — please use Bitwarden.
        </div>

        {/* Collapsed add form */}
        <div style={{ marginTop: 14, background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: `3px solid ${ACCENT}`, borderRadius: 12, overflow: 'hidden' }}>
          <div onClick={() => setOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', cursor: 'pointer' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Add a Subscription</div>
            <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border)', color: ACCENT, fontSize: 13, fontWeight: 800 }}>
              {open ? '–' : '+'}
            </span>
          </div>
          {open && (
            <div style={{ padding: '0 18px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div>
                  <span style={lbl}>Type *</span>
                  <select value={typeMode === NEW_TYPE ? NEW_TYPE : f.type}
                    onChange={e => { const v = e.target.value; if (v === NEW_TYPE) { setTypeMode(NEW_TYPE); } else { setTypeMode(''); setF(x => ({ ...x, type: v })); } }}>
                    <option value="">Select type…</option>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value={NEW_TYPE}>+ Add new type…</option>
                  </select>
                  {typeMode === NEW_TYPE && (
                    <input value={newType} onChange={e => setNewType(e.target.value)} placeholder="New type name" autoFocus style={{ marginTop: 8 }} />
                  )}
                </div>
                <div>
                  <span style={lbl}>Name *</span>
                  <input value={f.name} onChange={set('name')} placeholder="e.g. Frame.io" />
                </div>
                <div>
                  <span style={lbl}>Website Link</span>
                  <input value={f.website} onChange={set('website')} placeholder="e.g. frame.io" />
                </div>
                <div>
                  <span style={lbl}>Login Name</span>
                  <input value={f.loginName} onChange={set('loginName')} placeholder="e.g. post@unbridledmedia.com" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button disabled={!canSubmit || saving} onClick={submit}
                  style={{ background: canSubmit ? ACCENT : 'var(--border)', border: 'none', color: canSubmit ? '#14092e' : 'var(--muted)', borderRadius: 8, padding: '9px 26px', fontSize: 13, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'default' }}>
                  {saving ? 'Adding…' : 'Add Subscription'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Grouped list */}
        <div style={{ marginTop: 22 }}>
          {!items && <div className="empty">Loading…</div>}
          {items && shown.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{q ? 'No subscriptions match that search.' : 'No subscriptions yet.'}</div>}
          {groupKeys.map(key => (
            <div key={key} style={{ marginBottom: 22 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 14, padding: '3px 12px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{key}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{groups[key].length}</span>
              </div>
              <div className="budget-tbl-wrap" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th style={th}>Name</th><th style={th}>Website</th><th style={th}>Login Name</th><th style={{ ...th, width: 34 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups[key].map(i => (
                      <tr key={i.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ ...td, fontWeight: 700 }}>{i.name}</td>
                        <td style={td}>
                          {linkHref(i.website)
                            ? <a href={linkHref(i.website)} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: 'none' }}>{i.website}</a>
                            : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td style={{ ...td, color: 'var(--tan)' }}>{i.login_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button title="Delete" onClick={() => remove(i.id, i.name)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
