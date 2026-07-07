import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { AvoHeader, EditorSelect, AVO, AVO_STATUSES, fmtV, stepV } from './Avo.jsx';

const lbl = { fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4, display:'block' };
const KIND_STYLE = {
  comment: { border:`1px solid var(--border)`, background:'var(--bg2)' },
  rfr: { border:'1px solid rgba(230,194,41,0.5)', background:'rgba(230,194,41,0.06)' },
  sent: { border:'1px solid rgba(74,158,255,0.5)', background:'rgba(74,158,255,0.06)' },
};
const CATEGORIES = ['Event Recap', 'Sizzle', 'Interstitial', 'Documentary', 'Teaser', 'Social Cutdown', 'Photo Slideshow', 'Other'];

const fmtDT = d => new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });

export default function AvoEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [e, setE] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const feedRef = useRef(null);

  const load = () => api.avoEdit(id).then(setE).catch(err => alert(err.message));
  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [e?.activity?.length]);

  if (!e) return <div style={{ minHeight:'100vh', background:'var(--bg)' }}><AvoHeader /><div className="empty">Loading…</div></div>;

  const patch = fields => setE(v => ({ ...v, ...fields }));
  const save = data => api.updateAvoEdit(id, data).then(full => setE(v => ({ ...v, ...full }))).catch(err => alert(err.message));

  async function post() {
    if (!comment.trim() || busy) return;
    setBusy(true);
    try { const activity = await api.avoComment(id, comment); setE(v => ({ ...v, activity })); setComment(''); }
    catch (err) { alert(err.message); }
    setBusy(false);
  }

  async function action(fn) {
    setBusy(true);
    try { const activity = await fn(); setE(v => ({ ...v, activity })); } catch (err) { alert(err.message); }
    setBusy(false);
  }

  function upload(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return alert('File too large (20MB max)');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.avoUploadFile(id, { filename: file.name, mime: file.type, fileBase64: String(reader.result).split(',')[1] });
        load();
      } catch (err) { alert(err.message); }
    };
    reader.readAsDataURL(file);
  }

  const field = (label, key, apiKey, type = 'text') => (
    <div style={{ flex:1, minWidth:150 }}>
      <span style={lbl}>{label}</span>
      <input type={type} value={type === 'date' ? (e[key] ? String(e[key]).slice(0, 10) : '') : (e[key] || '')}
        onChange={ev => patch({ [key]: ev.target.value })}
        onBlur={ev => save({ [apiKey]: ev.target.value })} />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <AvoHeader />
      <div style={{ maxWidth:1250, margin:'0 auto', padding:'6px 16px 80px' }}>
        <button className="btn btn-ghost btn-sm" style={{ marginBottom:12 }} onClick={() => nav('/avo')}>‹ Pipeline</button>
        <div style={{ display:'flex', gap:18, flexWrap:'wrap', alignItems:'flex-start' }}>

          {/* ── Left: details ── */}
          <div style={{ flex:'1 1 480px', minWidth:320 }}>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${AVO}`, borderRadius:12, padding:'18px 20px' }}>
              <input value={e.title || ''} onChange={ev => patch({ title: ev.target.value })} onBlur={ev => save({ title: ev.target.value })}
                style={{ fontSize:18, fontWeight:800, background:'transparent', border:'1px solid transparent', borderRadius:6, padding:'4px 8px', width:'100%' }} />
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:12 }}>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Status</span>
                    <select value={e.status} onChange={ev => { patch({ status: ev.target.value }); save({ status: ev.target.value }); }}>
                      {AVO_STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Version</span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button className="btn btn-ghost btn-sm" title="Version down 0.1"
                        onClick={() => save({ version: stepV(e.version, -1) })}>−.1</button>
                      <span style={{ fontSize:16, fontWeight:800, color:AVO }}>{fmtV(e.version)}</span>
                      <button className="btn btn-ghost btn-sm" title="Version up 0.1"
                        onClick={() => save({ version: stepV(e.version, 1) })}>+.1</button>
                    </div>
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <span style={lbl}>Approved</span>
                    <button onClick={() => save({ approved: !e.approved })}
                      style={{ background: e.approved ? 'rgba(90,191,128,0.15)' : 'transparent', border:`1px solid ${e.approved ? '#5ABF80' : 'var(--border)'}`,
                        color: e.approved ? '#5ABF80' : 'var(--muted)', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                      {e.approved ? '✓ Approved' : 'Not Approved'}
                    </button>
                  </div>
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {field('Project Code', 'project_code', 'projectCode')}
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Lead Editor</span>
                    <EditorSelect value={e.lead_editor_id} onChange={v => { patch({ lead_editor_id: v }); save({ leadEditorId: v }); }} />
                  </div>
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Project Manager</span>
                    <EditorSelect value={e.pm_id} onChange={v => { patch({ pm_id: v }); save({ pmId: v }); }} placeholder="— No PM —" />
                  </div>
                </div>
                <div>
                  <span style={lbl}>Description</span>
                  <textarea value={e.description || ''} style={{ minHeight:70 }}
                    onChange={ev => patch({ description: ev.target.value })}
                    onBlur={ev => save({ description: ev.target.value })} />
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {field('Aspect Ratio', 'aspect_ratio', 'aspectRatio')}
                  {field('Resolution', 'resolution', 'resolution')}
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Category</span>
                    <select value={e.category || ''} onChange={ev => { patch({ category: ev.target.value }); save({ category: ev.target.value }); }}>
                      <option value="">—</option>
                      {e.category && !CATEGORIES.includes(e.category) && <option value={e.category}>{e.category}</option>}
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {field('Asset Ref', 'asset_ref', 'assetRef')}
                  {field('Music Ref', 'music_ref', 'musicRef')}
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {field('Start Date', 'start_date', 'startDate', 'date')}
                  {field('Due Date', 'end_date', 'endDate', 'date')}
                </div>
                <div>
                  <span style={lbl}>Current Review Link</span>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                    <input value={e.review_link || ''} style={{ flex:1, minWidth:200 }}
                      onChange={ev => patch({ review_link: ev.target.value })}
                      onBlur={ev => save({ reviewLink: ev.target.value })} />
                    {e.review_link && <a className="btn btn-ghost btn-sm" href={e.review_link} target="_blank" rel="noreferrer" style={{ textDecoration:'none' }}>▶ Open</a>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button disabled={busy} onClick={() => action(() => api.avoRfr(id))}
                    style={{ background:'rgba(230,194,41,0.12)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:20, padding:'6px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                    RFR — Ready For Review
                  </button>
                  <button disabled={busy} onClick={() => action(() => api.avoSent(id))}
                    style={{ background:'rgba(74,158,255,0.12)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:20, padding:'6px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                    Sent to Client
                  </button>
                </div>
              </div>
            </div>

            {/* ── Uploads ── */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:AVO }}>Uploads</div>
                <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>+ Upload File</button>
                <input ref={fileRef} type="file" style={{ display:'none' }} onChange={upload} />
              </div>
              {(e.files || []).length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>Drop creative briefs, music, logos, photos, clips here (20MB max each).</div>}
              {(e.files || []).map(f => (
                <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <a href={`/api/avo/files/${f.id}`} onClick={async ev => {
                    ev.preventDefault();
                    const r = await fetch(`/api/avo/files/${f.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } });
                    const blob = await r.blob();
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob); a.download = f.filename; a.click(); URL.revokeObjectURL(a.href);
                  }} style={{ color:'#4a9eff', fontSize:12, flex:1 }}>📎 {f.filename}</a>
                  <span style={{ fontSize:10, color:'var(--muted)' }}>{(f.size / 1024 / 1024).toFixed(1)}MB · {f.uploaded_by}</span>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }}
                    onClick={async () => { if (confirm(`Delete ${f.filename}?`)) { await api.avoDeleteFile(f.id); load(); } }}>✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: activity ── */}
          <div style={{ flex:'1 1 380px', minWidth:300, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, display:'flex', flexDirection:'column', maxHeight:'80vh' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em' }}>Activity</div>
            <div ref={feedRef} style={{ flex:1, overflowY:'auto', padding:'12px 18px', display:'flex', flexDirection:'column', gap:8 }}>
              {(e.activity || []).map(a => a.kind === 'log' ? (
                <div key={a.id} style={{ fontSize:10, color:'var(--muted)', display:'flex', justifyContent:'space-between', gap:10 }}>
                  <span>• {a.author && a.author !== 'system' ? `${a.author} ` : ''}{a.body}</span>
                  <span style={{ whiteSpace:'nowrap' }}>{fmtDT(a.created_at)}</span>
                </div>
              ) : (
                <div key={a.id} style={{ ...KIND_STYLE[a.kind] || KIND_STYLE.comment, borderRadius:10, padding:'8px 12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:3 }}>
                    <span style={{ fontSize:10, fontWeight:700, color: a.kind === 'rfr' ? '#e6c229' : a.kind === 'sent' ? '#4a9eff' : AVO }}>
                      {a.kind === 'rfr' ? '⚑ ' : a.kind === 'sent' ? '➤ ' : ''}{a.author}
                    </span>
                    <span style={{ fontSize:9, color:'var(--muted)', whiteSpace:'nowrap' }}>{fmtDT(a.created_at)}</span>
                  </div>
                  <div style={{ fontSize:12, whiteSpace:'pre-wrap' }}>{a.body}</div>
                </div>
              ))}
              {(e.activity || []).length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No activity yet.</div>}
            </div>
            <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)' }}>
              <textarea value={comment} placeholder="Write a comment… @Name to email someone"
                style={{ minHeight:52, marginBottom:8 }}
                onChange={ev => setComment(ev.target.value)}
                onKeyDown={ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) post(); }} />
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button disabled={!comment.trim() || busy} onClick={post}
                  style={{ background: comment.trim() ? AVO : 'var(--border)', color:'#0b0b0b', border:'none', borderRadius:8, padding:'7px 18px', fontSize:12, fontWeight:800, cursor: comment.trim() ? 'pointer' : 'default' }}>
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
