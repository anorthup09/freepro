import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
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

// Program picker: choose an existing program (so like-programs group together)
// or add a new one. Saves on selection.
function ProgramPicker({ value, programs, onSave }) {
  const NEW = '__new__';
  const [mode, setMode] = useState('');
  const [nv, setNv] = useState('');
  const opts = [...new Set([...(value ? [value] : []), ...programs])];
  const sel = { fontSize: 12, padding: '6px 10px', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)' };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={mode === NEW ? NEW : (value || '')}
        onChange={e => { const v = e.target.value; if (v === NEW) setMode(NEW); else { setMode(''); onSave(v); } }}
        style={sel}>
        <option value="">— None —</option>
        {opts.map(p => <option key={p} value={p}>{p}</option>)}
        <option value={NEW}>+ Add new program…</option>
      </select>
      {mode === NEW && (
        <>
          <input value={nv} onChange={e => setNv(e.target.value)} placeholder="New program name" autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && nv.trim()) { onSave(nv.trim()); setMode(''); setNv(''); } }}
            style={{ ...sel, background: 'var(--bg)' }} />
          <button className="btn btn-primary btn-sm" disabled={!nv.trim()} onClick={() => { onSave(nv.trim()); setMode(''); setNv(''); }}>Add</button>
        </>
      )}
    </div>
  );
}

export default function DebriefPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const canEdit = ['ADMIN', 'PRODUCER'].includes(user?.role);
  const [project, setProject] = useState(null);
  const [entries, setEntries] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ code: '', title: '', client: '', year: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProject(id).then(setProject).catch(() => setProject(null));
    api.projectDebrief(id).then(setEntries).catch(() => setEntries([]));
  }, [id]);

  // Programs are scoped to this project's client (a client only offers its own).
  useEffect(() => {
    if (project?.client) api.debriefPrograms(project.client).then(setPrograms).catch(() => setPrograms([]));
  }, [project?.client]);

  async function saveProgram(v) {
    try {
      const p = await api.updateProject(id, { program: v });
      setProject(p);
      if (v && !programs.includes(v)) setPrograms(ps => [...ps, v].sort((a, b) => a.localeCompare(b)));
    } catch (e) { alert(e.message); }
  }

  function startEdit() {
    setForm({
      code: project?.code || '', title: project?.title || '', client: project?.client || '',
      year: project?.start_date ? String(project.start_date).slice(0, 4) : '',
    });
    setEditing(true);
  }
  async function saveDetails() {
    setSaving(true);
    const patch = {
      code: form.code.trim(), title: form.title.trim(), client: form.client.trim(),
    };
    if (form.year && /^\d{4}$/.test(form.year.trim())) patch.startDate = `${form.year.trim()}-01-01`;
    try {
      const p = await api.updateProject(id, patch);
      setProject(p); setEditing(false);
    } catch (e) { alert(e.message); }
    setSaving(false);
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div className="page-title">{project ? `${project.code} — ${project.title}` : 'Project Debrief'}</div>
            <div className="page-sub">
              {project?.client ? `${project.client} · ` : ''}
              {project?.program ? `${project.program} · ` : ''}
              {project?.start_date ? `${String(project.start_date).slice(0, 4)} · ` : ''}
              Start / Stop / Continue and notes for consideration
            </div>
          </div>
          {canEdit && !editing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={startEdit} className="btn btn-ghost btn-sm">Edit details</button>
              {user?.role === 'ADMIN' && (
                <button className="btn btn-ghost btn-sm" style={{ color: '#e05252', borderColor: '#e05252' }}
                  onClick={async () => {
                    if (!confirm(`Delete this project and its debrief? (${project?.code} — ${project?.title})\nUse this to remove duplicates.`)) return;
                    try { await api.deleteProject(id); nav('/reports/debrief'); }
                    catch (e) { alert(e.message); }
                  }}>Delete project</button>
              )}
            </div>
          )}
        </div>

        {canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Program</span>
            <ProgramPicker value={project?.program || ''} programs={programs} onSave={saveProgram} />
            <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>Groups like programs together in the Debrief report.</span>
          </div>
        )}

        {editing && (
          <div style={{ marginTop: 14, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[['code', 'Project Code'], ['title', 'Title'], ['client', 'Client'], ['year', 'Year']].map(([k, label]) => (
                <div key={k}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</span>
                  <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    inputMode={k === 'year' ? 'numeric' : undefined}
                    style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', width: '100%' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={saveDetails} disabled={saving || !form.code.trim() || !form.title.trim() || !form.client.trim()} className="btn btn-primary btn-sm">{saving ? 'Saving…' : 'Save details'}</button>
            </div>
          </div>
        )}

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
