import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';

// Debrief report — every project's Start / Stop / Continue / Notes, rolled up by
// client and then by project across years, so a program can be reviewed over time.
const KINDS = [
  { key: 'start', label: 'Start', color: '#5ABF80' },
  { key: 'stop', label: 'Stop', color: '#e05252' },
  { key: 'continue', label: 'Continue', color: '#4a9eff' },
  { key: 'note', label: 'Notes', color: '#e6c229' },
];
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '';

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
        <span style={{ fontSize: 11, color: 'var(--muted)', width: 20 }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0 }}>{p.code} — {p.title}</span>
        {p.year && <span style={{ fontSize: 11, fontWeight: 800, color: '#E8500A' }}>{p.year}</span>}
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{p.entries.length}</span>
        <button onClick={e => { e.stopPropagation(); nav(`/projects/${p.id}/debrief`); }}
          style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Open →</button>
      </div>
      {open && (
        <div style={{ padding: '0 16px 14px 44px' }}>
          {KINDS.map(k => <KindBlock key={k.key} meta={k} entries={p.entries.filter(e => e.kind === k.key)} />)}
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
  const [openClient, setOpenClient] = useState(null);

  useEffect(() => { api.debriefReport().then(setData).catch(e => alert(e.message)); }, []);

  const shown = (data || []).filter(c => !q.trim()
    || c.client.toLowerCase().includes(q.trim().toLowerCase())
    || c.projects.some(p => `${p.code} ${p.title}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <span style={{ fontSize: 12, color: '#e6c229', fontWeight: 700, letterSpacing: '0.04em' }}>Reports</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Reports</Link>
          <HomeButton />
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Debriefs</div>
            <div className="page-sub">Start / Stop / Continue across every project, by client and year{data && <span> · {data.length} {data.length === 1 ? 'client' : 'clients'}</span>}</div>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search client or project…"
            style={{ fontSize: 12, padding: '7px 12px', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', minWidth: 220 }} />
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!data && <div className="empty">Loading…</div>}
          {data && shown.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{q ? 'No matches.' : 'No debriefs yet — add Start / Stop / Continue notes from any project overview.'}</div>}
          {shown.map(c => {
            const isOpen = openClient === c.client || !!q.trim();
            return (
              <div key={c.client} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div onClick={() => setOpenClient(o => o === c.client ? null : c.client)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', width: 20 }}>{isOpen ? '▾' : '▸'}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, flex: 1, minWidth: 0 }}>{c.client}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{c.projects.length} {c.projects.length === 1 ? 'project' : 'projects'} · {c.count} notes</span>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {c.projects.map(p => <ProjectCard key={p.id} p={p} nav={nav} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
