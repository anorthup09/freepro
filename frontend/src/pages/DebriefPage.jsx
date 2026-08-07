import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';

// Full Start / Stop / Continue / Note debrief for one project. Authored + dated.
const KINDS = [
  { key: 'start', label: 'Start', color: '#5ABF80', hint: 'What should we start doing?' },
  { key: 'stop', label: 'Stop', color: '#e05252', hint: 'What should we stop doing?' },
  { key: 'continue', label: 'Continue', color: '#4a9eff', hint: 'What worked — keep doing it?' },
  { key: 'note', label: 'Notes for Consideration', color: '#e6c229', hint: 'Anything else worth capturing.' },
];
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

function Column({ meta, entries, onAdd, onDelete }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!text.trim() || saving) return;
    setSaving(true);
    await onAdd(text.trim());
    setText(''); setSaving(false);
  }
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: `3px solid ${meta.color}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meta.label}</div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', margin: '4px 0 10px' }}>{meta.hint}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="Add…" style={{ flex: 1, fontSize: 12 }} />
        <button onClick={submit} disabled={!text.trim() || saving}
          style={{ background: text.trim() ? meta.color : 'var(--border)', border: 'none', color: text.trim() ? '#0b0b0b' : 'var(--muted)', borderRadius: 8, padding: '0 14px', fontSize: 12, fontWeight: 800, cursor: text.trim() ? 'pointer' : 'default' }}>Add</button>
      </div>
      {entries.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>Nothing yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map(e => (
          <div key={e.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', overflowWrap: 'anywhere' }}>{e.text}</div>
              <button title="Delete" onClick={() => onDelete(e.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 5 }}>{e.author_name || 'Someone'} · {fmtDate(e.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DebriefPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [entries, setEntries] = useState(null);
  const [program, setProgram] = useState('');

  useEffect(() => {
    api.getProject(id).then(p => { setProject(p); setProgram(p?.program || ''); }).catch(() => setProject(null));
    api.projectDebrief(id).then(setEntries).catch(() => setEntries([]));
  }, [id]);

  async function saveProgram() {
    if ((project?.program || '') === program.trim()) return;
    try { await api.updateProject(id, { program: program.trim() }); setProject(p => ({ ...p, program: program.trim() })); }
    catch (e) { alert(e.message); }
  }

  async function add(kind, text) {
    try { const e = await api.addDebrief(id, { kind, text }); setEntries(es => [e, ...(es || [])]); }
    catch (e) { alert(e.message); }
  }
  async function remove(entryId) {
    try { await api.deleteDebrief(entryId); setEntries(es => es.filter(x => x.id !== entryId)); }
    catch (e) { alert(e.message); }
  }
  const byKind = k => (entries || []).filter(e => e.kind === k);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, minWidth: 0 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <span style={{ fontSize: 12, color: '#E8500A', fontWeight: 700, letterSpacing: '0.04em' }}>Debrief</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => nav(`/projects/${id}`)} className="btn btn-ghost btn-sm">‹ Overview</button>
          <HomeButton />
        </div>
      </div>

      <div style={{ maxWidth: 1250, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div className="page-title">{project ? `${project.code} — ${project.title}` : 'Project Debrief'}</div>
        <div className="page-sub">{project?.client ? `${project.client} · ` : ''}Start / Stop / Continue and notes for consideration</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Program</span>
          <input value={program} onChange={e => setProgram(e.target.value)} onBlur={saveProgram}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            placeholder="Optional — e.g. LPL Focus (groups this project in the Debrief report)"
            style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', maxWidth: 420, width: '100%' }} />
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {KINDS.map(k => (
            <Column key={k.key} meta={k} entries={byKind(k.key)}
              onAdd={text => add(k.key, text)} onDelete={remove} />
          ))}
        </div>
      </div>
    </div>
  );
}
