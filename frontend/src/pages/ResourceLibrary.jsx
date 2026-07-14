import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import HomeButton from '../components/HomeButton.jsx';

// Shared link library page used by the Music Resources and Video References
// reports: a team-editable list of links grouped by category.
export default function ResourceLibrary({ kind, title, sub, accent, placeholderTitle, placeholderCat }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);   // { title, url, category, note } | null
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { api.resourceLinks(kind).then(setRows).catch(e => alert(e.message)); }, [kind]);

  async function add(ev) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.addResourceLink(kind, form);
      setRows(rs => [...(rs || []), r]);
      setForm(null);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }
  async function remove(r) {
    if (!confirm(`Remove "${r.title}"?`)) return;
    try { await api.deleteResourceLink(kind, r.id); setRows(rs => rs.filter(x => x.id !== r.id)); }
    catch (e) { alert(e.message); }
  }

  const needle = q.trim().toLowerCase();
  const shown = (rows || []).filter(r => !needle
    || [r.title, r.category, r.note, r.url].some(v => (v || '').toLowerCase().includes(needle)));
  const cats = [...new Set(shown.map(r => r.category || 'General'))].sort((a, b) => a.localeCompare(b));
  const existingCats = [...new Set((rows || []).map(r => r.category).filter(Boolean))].sort();
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
          <span style={{ fontSize:12, color:accent, fontWeight:700, letterSpacing:'0.04em', cursor:'pointer' }} onClick={() => nav('/reports')}>Reports</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <HomeButton />
        </div>
      </div>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'10px 16px 60px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
          <div>
            <div className="page-title">{title}</div>
            <div className="page-sub">{sub}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setForm({ title:'', url:'', category:'', note:'' })}>+ Add Resource</button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, category, or link…"
          style={{ width:'100%', margin:'12px 0 4px', fontSize:12, padding:'9px 12px', borderRadius:8, background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text)' }} />

        {!rows && <div className="empty">Loading…</div>}
        {rows && rows.length === 0 && <div className="empty">Nothing here yet — add the first resource with the button above.</div>}
        {rows && rows.length > 0 && shown.length === 0 && <div className="empty">No matches for “{q}”.</div>}

        {cats.map(cat => (
          <div key={cat} style={{ marginTop:18 }}>
            <div className="sec-lbl">{cat}</div>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
              {shown.filter(r => (r.category || 'General') === cat).map(r => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    {r.url
                      ? <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize:13, fontWeight:700, color:'#4a9eff', textDecoration:'none' }}>{r.title} ↗</a>
                      : <span style={{ fontSize:13, fontWeight:700 }}>{r.title}</span>}
                    <div style={{ fontSize:10.5, color:'var(--muted)', marginTop:2 }}>
                      {[r.url ? host(r.url) : null, r.note].filter(Boolean).join(' — ')}
                    </div>
                  </div>
                  {r.added_by && <span style={{ fontSize:10, color:'var(--muted)', whiteSpace:'nowrap', flexShrink:0 }}>{r.added_by}</span>}
                  <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e05252)', flexShrink:0 }} onClick={() => remove(r)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <div className="modal-title">Add to {title}</div>
            <form onSubmit={add}>
              <div className="form-grid cols1" style={{ marginBottom:12 }}>
                <div className="field"><label>Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={placeholderTitle} required autoFocus /></div>
                <div className="field"><label>Link</label>
                  <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" /></div>
                <div className="field"><label>Category</label>
                  <input value={form.category} list={`cats-${kind}`} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder={placeholderCat} />
                  <datalist id={`cats-${kind}`}>{existingCats.map(c => <option key={c} value={c} />)}</datalist></div>
                <div className="field"><label>Notes</label>
                  <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="What it's good for, license notes…" /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add Resource'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
