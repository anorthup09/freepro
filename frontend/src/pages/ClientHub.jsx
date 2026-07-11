import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';

const WHITE = '#e8e8e8';
const KINDS = [
  ['logo', 'Logo', '#4a9eff'],
  ['brand', 'Brand Guidelines', '#9DC183'],
  ['other', 'Other', '#8a8f98'],
];
const kindMeta = k => KINDS.find(x => x[0] === k) || KINDS[2];
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

function authFetch(path) {
  return fetch(path, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } });
}

// Small authenticated image thumbnail (logos)
function Thumb({ id }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let obj;
    authFetch(`/api/clients/resources/${id}/file?inline=1`)
      .then(r => r.ok ? r.blob() : null)
      .then(b => { if (b) { obj = URL.createObjectURL(b); setUrl(obj); } });
    return () => obj && URL.revokeObjectURL(obj);
  }, [id]);
  if (!url) return <div style={{ width:44, height:44, borderRadius:8, background:'rgba(255,255,255,0.05)' }} />;
  return <img src={url} alt="" style={{ width:44, height:44, borderRadius:8, objectFit:'contain', background:'#fff', padding:3 }} />;
}

function ClientResources({ client }) {
  const [rows, setRows] = useState(null);
  const [kind, setKind] = useState('logo');
  const [busy, setBusy] = useState(false);

  const load = () => api.clientResources(client).then(setRows).catch(e => alert(e.message));
  useEffect(() => { load(); }, [client]);

  async function pick(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const b64 = await new Promise((ok, bad) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(',')[1]);
        r.onerror = bad;
        r.readAsDataURL(file);
      });
      await api.uploadClientResource(client, { filename: file.name, mime: file.type, fileBase64: b64, kind });
      load();
    } catch (err) { alert(err.message); }
    setBusy(false);
  }

  async function download(f) {
    const r = await authFetch(`/api/clients/resources/${f.id}/file`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob());
    a.download = f.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px', marginTop:22 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:12 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:800 }}>Client Resources</div>
          <div style={{ fontSize:10, color:'var(--muted)' }}>Logos, brand guidelines, and anything the team needs for {client}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <select value={kind} onChange={e => setKind(e.target.value)} style={{ width:'auto', fontSize:11 }}>
            {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <label className="btn btn-sm" style={{ cursor:'pointer' }}>
            {busy ? 'Uploading…' : '+ Upload'}
            <input type="file" onChange={pick} disabled={busy} style={{ display:'none' }} />
          </label>
        </div>
      </div>
      {!rows && <div className="empty">Loading…</div>}
      {rows && rows.length === 0 && <div className="empty">Nothing yet — upload the client's logo and brand guidelines.</div>}
      {rows && rows.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:10 }}>
          {rows.map(f => {
            const [, label, color] = kindMeta(f.kind);
            const isImg = (f.mime || '').startsWith('image/');
            return (
              <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px' }}>
                {isImg ? <Thumb id={f.id} /> : <div style={{ width:44, height:44, borderRadius:8, background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📄</div>}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.filename}</div>
                  <div style={{ fontSize:9, color:'var(--muted)' }}>
                    <span style={{ color, fontWeight:800 }}>{label}</span> · {fmtSize(f.size)} · {f.uploaded_by || ''}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => download(f)} title="Download">⬇</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Delete ${f.filename}?`)) api.deleteClientResource(f.id).then(load); }} title="Delete">✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ClientHub() {
  const { client } = useParams();
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const [projects, setProjects] = useState(null);
  const [view, setView] = useState('team'); // 'team' | 'client'
  const [meta, setMeta] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  async function copyClientLink() {
    const url = `${window.location.origin}/client/${encodeURIComponent(client)}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { window.prompt('Client link:', url); }
  }

  useEffect(() => { api.financeProjects().then(setProjects).catch(e => alert(e.message)); }, []);
  useEffect(() => { api.clientMeta(client).then(setMeta).catch(() => setMeta({})); }, [client]);

  async function changePassword() {
    const pw = prompt(meta?.hub_password
      ? `New Client Hub password for ${client} (leave empty to remove):`
      : `Set a Client Hub password for ${client} — clients will need it to open their portal:`,
      '');
    if (pw == null) return;
    try { setMeta(await api.setClientHubPassword(client, pw)); }
    catch (e) { alert(e.message); }
  }

  const mine = useMemo(() => (projects || [])
    .filter(p => (p.client || '').trim().toLowerCase() === client.trim().toLowerCase())
    .sort((a, b) => (a.code || '').localeCompare(b.code || '')), [projects, client]);

  const clientView = view === 'client';

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', borderTop: clientView ? '5px solid var(--orange)' : '5px solid transparent' }}>
      {clientView && (
        <div style={{ background:'rgba(232,80,10,0.12)', borderBottom:'1px solid rgba(232,80,10,0.4)', textAlign:'center', padding:'5px 10px', fontSize:10, fontWeight:800, letterSpacing:'0.08em', color:'var(--orange)', textTransform:'uppercase' }}>
          Client Access View — everything on this screen is what {client} will see
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }}>
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
          <Link to="/project-view" style={{ fontSize:12, color:WHITE, fontWeight:700, letterSpacing:'0.04em', textDecoration:'none' }}>🗂 Project View</Link>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Back to Hub</Link>
        </div>
      </div>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 16px 80px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:18 }}>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/project-view')} style={{ marginBottom:8 }}>‹ All Projects</button>
            <div className="page-title">{client}</div>
            <div className="page-sub">{mine.length} active project{mine.length !== 1 ? 's' : ''} · client hub</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden' }}>
              {[['team', 'Team View'], ['client', 'Client View']].map(([k, label]) => (
                <button key={k} onClick={() => setView(k)}
                  style={{ background: view === k ? 'rgba(255,255,255,0.07)' : 'transparent', border:'none',
                    color: view === k ? (k === 'client' ? 'var(--orange)' : WHITE) : 'var(--muted)', fontSize:11, fontWeight:800, padding:'7px 16px', cursor:'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            {clientView && (
              <button onClick={copyClientLink} title="Copy the link to this client's view"
                style={linkCopied
                  ? { background:'#5ABF80', border:'1px solid #5ABF80', color:'#0b0b0b', borderRadius:18, padding:'7px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }
                  : { background:'rgba(74,158,255,0.12)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:18, padding:'7px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                {linkCopied ? '✓ Copied' : '🔗 Copy Client Link'}
              </button>
            )}
            <button onClick={changePassword}
              title={meta?.hub_password ? 'Client Hub password is set — click to change or remove it' : 'Set the password clients will use to open their portal'}
              style={meta?.hub_password
                ? { background:'rgba(90,191,128,0.12)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:18, padding:'7px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }
                : { background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:18, padding:'7px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
              {meta?.hub_password ? '🔒 Password Set' : '🔒 Set Hub Password'}
            </button>
          </div>
        </div>

        {clientView ? (
          <div style={{ textAlign:'center', padding:'90px 20px', border:'1px dashed rgba(232,80,10,0.5)', borderRadius:12 }}>
            <div style={{ fontSize:34, marginBottom:10 }}>🚧</div>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--orange)' }}>Client Portal — Coming Soon</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:6, maxWidth:420, margin:'6px auto 0' }}>
              This will become {client}'s window into their projects — status, deliverables, and shared documents.
            </div>
          </div>
        ) : (
          <>
            {!projects && <div className="empty">Loading…</div>}
            {projects && mine.length === 0 && <div className="empty">No projects found for this client.</div>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:14 }}>
              {mine.map(p => (
                <div key={p.id} onClick={() => nav(`/project-view/${p.id}`)}
                  style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${WHITE}44`, borderRadius:10, padding:'16px 18px', cursor:'pointer' }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'var(--muted)', letterSpacing:'0.04em' }}>{p.code}</div>
                  <div style={{ fontSize:14, fontWeight:800, margin:'4px 0 2px' }}>{p.title}</div>
                  <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                    <span style={{ fontSize:9, fontWeight:800, color:'#5ABF80', border:'1px solid #5ABF8055', borderRadius:10, padding:'2px 8px' }}>{p.budget_status || 'No budget'}</span>
                    {(p.shoots || []).length > 0 && <span style={{ fontSize:9, fontWeight:800, color:'var(--orange)', border:'1px solid rgba(232,80,10,0.4)', borderRadius:10, padding:'2px 8px' }}>{p.shoots.length} shoot{p.shoots.length !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
              ))}
            </div>
            <ClientResources client={client} />
          </>
        )}
      </div>
    </div>
  );
}
