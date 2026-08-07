import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';

// Debrief report — auto-populated with every client as a gradient tile. Open one
// to review its programs and projects (by year) of Start / Stop / Continue / Notes.
const KINDS = [
  { key: 'start', label: 'Start', color: '#5ABF80' },
  { key: 'stop', label: 'Stop', color: '#e05252' },
  { key: 'continue', label: 'Continue', color: '#4a9eff' },
  { key: 'note', label: 'Notes', color: '#e6c229' },
];
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '';

// Gray → Unbridled orange down the list, matching the Reports tiles.
const GRAY = [122, 117, 101], ORANGE = [232, 80, 10];
const gradientAccent = (i, n) => {
  const t = n <= 1 ? 1 : i / (n - 1);
  const c = GRAY.map((g, k) => Math.round(g + (ORANGE[k] - g) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

function KindBlock({ meta, entries }) {
  if (!entries.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{meta.label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {entries.map(e => (
          <div key={e.id} style={{ borderLeft: `2px solid ${meta.color}`, paddingLeft: 9 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text)', overflowWrap: 'anywhere' }}>{e.text}</div>
            <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 1 }}>{e.author_name || 'Someone'} · {fmtDate(e.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ p, nav }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', width: 16 }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0 }}>{p.code} — {p.title}</span>
        {p.year && <span style={{ fontSize: 11, fontWeight: 800, color: '#E8500A' }}>{p.year}</span>}
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{p.entries.length}</span>
        <button onClick={e => { e.stopPropagation(); nav(`/projects/${p.id}/debrief`); }}
          style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Open →</button>
      </div>
      {open && (
        <div style={{ padding: '0 16px 14px 40px' }}>
          {KINDS.map(k => <KindBlock key={k.key} meta={k} entries={p.entries.filter(e => e.kind === k.key)} />)}
        </div>
      )}
    </div>
  );
}

function ClientTile({ c, accent, nav }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderLeft: `4px solid ${accent}`, borderRadius: 9, overflow: 'hidden', transition: 'transform .15s ease' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer' }}>
        <span style={{ fontSize: 14, fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.client}</span>
        <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {c.programs.length ? `${c.programs.reduce((a, g) => a + g.projects.length, 0)} proj · ${c.count} notes` : 'No debriefs yet'}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: accent, whiteSpace: 'nowrap' }}>{open ? 'Close ▾' : 'Open →'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {c.programs.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>No debriefs recorded for this client yet.</div>}
          {c.programs.map((g, gi) => (
            <div key={gi}>
              {g.program && (
                <div style={{ fontSize: 11, fontWeight: 800, color: '#E8500A', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 8px' }}>
                  {g.program} <span style={{ color: 'var(--muted)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>· program</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.projects.map(p => <ProjectCard key={p.id} p={p} nav={nav} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportStatus() {
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  async function load(run) {
    setBusy(true);
    try { setSt(await api.debriefSeedStatus(run)); } catch (e) { alert(e.message); }
    setBusy(false);
  }
  return (
    <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => { const n = !open; setOpen(n); if (n && !st) load(false); }}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
          {open ? '▾' : '▸'} Post-mortem import status (admin)
        </button>
        {open && <button onClick={() => load(true)} disabled={busy} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>{busy ? '…' : 'Re-run import'}</button>}
      </div>
      {open && st && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted)' }}>
          {st.docs.map(d => (
            <div key={d.docCode} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <b style={{ color: 'var(--text)' }}>{d.docCode}</b> ({d.expected} entries) →{' '}
              {d.matched
                ? <span style={{ color: '#5ABF80' }}>matched {d.matched.code} · {d.matched.client || 'no client'} · {d.existing} on file</span>
                : <span style={{ color: '#e05252' }}>no project matched</span>}
            </div>
          ))}
          <div style={{ marginTop: 8, color: 'var(--text)', fontWeight: 700 }}>All project codes:</div>
          <div style={{ maxHeight: 160, overflowY: 'auto', fontSize: 10.5, lineHeight: 1.5 }}>
            {st.projects.map((p, i) => <div key={i}>{p.code} — {p.client}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DebriefReport() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => { api.debriefReport().then(setData).catch(e => alert(e.message)); }, []);

  const shown = (data || []).filter(c => !q.trim()
    || c.client.toLowerCase().includes(q.trim().toLowerCase())
    || c.programs.some(g => (g.program || '').toLowerCase().includes(q.trim().toLowerCase())
      || g.projects.some(p => `${p.code} ${p.title}`.toLowerCase().includes(q.trim().toLowerCase()))));

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

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Debriefs</div>
            <div className="page-sub">Start / Stop / Continue by client, program, and year{data && <span> · {data.length} {data.length === 1 ? 'client' : 'clients'}</span>}</div>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search client, program, project…"
            style={{ fontSize: 12, padding: '7px 12px', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', minWidth: 240 }} />
        </div>

        {user?.role === 'ADMIN' && <ImportStatus />}

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {!data && <div className="empty">Loading…</div>}
          {data && shown.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{q ? 'No matches.' : 'No clients yet.'}</div>}
          {shown.map((c, i) => <ClientTile key={c.client} c={c} accent={gradientAccent(i, shown.length)} nav={nav} />)}
        </div>
      </div>
    </div>
  );
}
