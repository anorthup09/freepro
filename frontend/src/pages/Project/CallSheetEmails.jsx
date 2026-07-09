import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';

const KEY_PRODUCTION_POSITIONS = ['Director', 'Executive Producer', 'Field Producer', 'Producer', 'Line Producer'];
const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' };
const secHdr = { fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 };

function Row({ checked, onToggle, name, sub, noEmail, onPreview }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, padding:'5px 2px', opacity: noEmail ? 0.45 : 1 }}>
      <input type="checkbox" checked={checked} disabled={noEmail} onChange={onToggle} style={{ width:'auto', accentColor:'var(--orange)', cursor: noEmail ? 'default' : 'pointer' }} />
      <span style={{ fontSize:12, fontWeight:700, cursor: noEmail ? 'default' : 'pointer' }} onClick={() => !noEmail && onToggle()}>{name}</span>
      <span style={{ fontSize:10, color:'var(--muted)', flex:1 }}>{noEmail ? 'no email on file' : sub}</span>
      {onPreview && (
        <button title={`Review ${name}'s call sheet`} onClick={onPreview}
          style={{ background:'none', border:'1px solid var(--border)', borderRadius:12, color:'var(--muted)', fontSize:10, fontWeight:700, cursor:'pointer', padding:'2px 10px', whiteSpace:'nowrap' }}>Review</button>
      )}
    </div>
  );
}

export default function CallSheetEmails() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [sel, setSel] = useState({});          // email -> true
  const [drafting, setDrafting] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(null);   // { name, url }

  // kind: 'crew' opens the shared crew view filtered to this person via ?for=;
  // 'client' opens the client call sheet; 'talent' opens that talent's sheet.
  async function previewFor(name, kind = 'crew') {
    try {
      const viewType = kind === 'talent' ? 'talent' : kind === 'client' ? 'client' : 'crew';
      const body = kind === 'talent' ? { viewType, talentName: name } : { viewType };
      const share = await api.createShare(id, body);
      const suffix = kind === 'crew' ? `?for=${encodeURIComponent(name)}` : '';
      setPreview({ name, kind, url: `/share/${share.token}${suffix}` });
    } catch (e) { alert(e.message); }
  }

  useEffect(() => { api.getProject(id).then(setProject).catch(e => alert(e.message)); }, [id]);

  const groups = useMemo(() => {
    if (!project) return null;
    const crew = (project.crewAssignments || []).map(a => ({
      name: [a.cm_pref_first, a.cm_pref_last].filter(Boolean).join(' ').trim() || a.cm_name || a.name,
      email: a.cm_email || a.email, sub: a.position_name, crew: true,
    }));
    const seen = new Set();
    const uniqCrew = crew.filter(c => c.name && !seen.has(c.name + '|' + c.email) && seen.add(c.name + '|' + c.email));
    return {
      producers: uniqCrew.filter(c => KEY_PRODUCTION_POSITIONS.includes(c.sub)),
      crew: uniqCrew.filter(c => !KEY_PRODUCTION_POSITIONS.includes(c.sub)),
      clients: (project.clientContacts || []).map(c => ({ name: c.name, email: c.email, sub: c.title })),
      talent: (project.keyTalent || []).map(t => ({ name: t.name, email: t.email, sub: t.role })),
    };
  }, [project]);

  const poc = useMemo(() => {
    if (!project?.poc_crew_member_id) return null;
    const a = (project.crewAssignments || []).find(x => x.cm_id === project.poc_crew_member_id || x.crew_member_id === project.poc_crew_member_id);
    return a ? { name: a.cm_name || a.name, email: a.cm_email || a.email } : null;
  }, [project]);

  const toggle = email => setSel(s => ({ ...s, [email]: !s[email] }));
  const toggleAll = (list, on) => setSel(s => {
    const next = { ...s };
    for (const p of list) if (p.email) next[p.email] = on;
    return next;
  });
  const selected = Object.keys(sel).filter(e => sel[e]);

  async function draft(length) {
    setDrafting(length);
    try {
      const d = await api.draftCallSheetEmail(id, length);
      setSubject(d.subject); setBody(d.body);
    } catch (e) { alert(e.message); }
    setDrafting(null);
  }

  const nameOf = useMemo(() => {
    const map = {};
    if (groups) for (const list of Object.values(groups)) for (const p of list) if (p.email) map[p.email] = p.name;
    return map;
  }, [groups]);

  // The [Name] placeholder renders live: one recipient → their first name; several → "Hey everyone,"
  const firstName = selected.length === 1 && nameOf[selected[0]] ? String(nameOf[selected[0]]).split(/\s+/)[0] : null;
  const displayBody = firstName
    ? body.replace(/\[Name\]/g, firstName)
    : selected.length > 1
      ? body.replace(/\b(Hi|Hello|Hey) \[Name\]/g, 'Hey everyone').replace(/\[Name\]/g, 'everyone')
      : body;

  function openMail() {
    const b = displayBody.replace(/\[Name\]/g, 'everyone');
    if (selected.length === 1) {
      window.location.href = `mailto:${encodeURIComponent(selected[0])}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b)}`;
      return;
    }
    window.location.href = `mailto:?bcc=${encodeURIComponent(selected.join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b)}`;
  }

  const section = (title, list, color, previewKind) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ ...secHdr, marginBottom:0, color }}>{title}</div>
        {list.some(p => p.email) && (
          <>
            <button onClick={() => toggleAll(list, true)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:0 }}>All</button>
            <button onClick={() => toggleAll(list, false)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:0 }}>None</button>
          </>
        )}
      </div>
      {list.length === 0 && <div style={{ fontSize:10, color:'var(--muted)', fontStyle:'italic', padding:'4px 2px' }}>None on this project.</div>}
      {list.map((p, i) => (
        <Row key={i} name={p.name} sub={p.sub} noEmail={!p.email}
          onPreview={previewKind ? () => previewFor(p.name, previewKind) : undefined}
          checked={!!(p.email && sel[p.email])} onToggle={() => p.email && toggle(p.email)} />
      ))}
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'20px 16px 80px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => nav(`/projects/${id}`)} style={{ marginBottom:12 }}>‹ Back to Project</button>
        {!project && <div className="empty">Loading…</div>}
        {project && groups && (
          <>
            <div className="page-title">Send Call Sheet Emails</div>
            <div className="page-sub">{project.code} — {project.title}</div>
            <div style={{ fontSize:11, color:'var(--muted)', margin:'6px 0 18px' }}>
              Emails send from the Main POC's inbox{poc ? ` — ${poc.name}${poc.email ? ` (${poc.email})` : ''}` : ' — set a Main POC on the project Overview'}.
            </div>

            <div className="cse-grid" style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:16, alignItems:'start' }}>
              <div style={card}>
                <div style={{ ...secHdr, marginBottom:12 }}>Recipients {selected.length > 0 && <span style={{ color:'var(--orange)' }}>({selected.length})</span>}</div>
                {section('Producers', groups.producers, '#5ABF80', 'crew')}
                {section('Crew', groups.crew, 'var(--orange)', 'crew')}
                {section('Client', groups.clients, '#4a9eff', 'client')}
                {section('Talent', groups.talent, '#e6c229', 'talent')}
              </div>

              <div style={card}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:12 }}>
                  <div style={{ ...secHdr, marginBottom:0 }}>Email</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, color:'#e6c229', fontWeight:800 }}>✨ Draft with AI:</span>
                    {['short', 'medium', 'long'].map(len => (
                      <button key={len} onClick={() => draft(len)} disabled={!!drafting}
                        style={{ background:'rgba(230,194,41,0.15)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:16, padding:'4px 12px', fontSize:10, fontWeight:800, cursor:'pointer', opacity: drafting && drafting !== len ? 0.4 : 1, textTransform:'capitalize' }}>
                        {drafting === len ? 'Drafting…' : len}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Subject</div>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Call Sheet/Production Schedule — …" style={{ marginBottom:10 }} />
                <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Body</div>
                <textarea value={displayBody} onChange={e => setBody(e.target.value)} placeholder="Click Draft with AI for a synopsis of the shoot, or write your own…"
                  style={{ minHeight:260, fontSize:12, lineHeight:1.5 }} />
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12, alignItems:'center' }}>
                  <button disabled title="Direct sending arrives when email is connected — it will send from the Main POC's inbox"
                    style={{ background:'var(--border)', border:'none', color:'var(--muted)', borderRadius:16, padding:'6px 18px', fontSize:12, fontWeight:800, cursor:'not-allowed' }}>
                    Send Emails (coming soon)
                  </button>
                  <button onClick={openMail} disabled={!selected.length || !subject}
                    style={{ background:'rgba(232,80,10,0.16)', border:'1px solid var(--orange)', color:'var(--orange)', borderRadius:16, padding:'6px 18px', fontSize:12, fontWeight:800, cursor: selected.length && subject ? 'pointer' : 'default', opacity: selected.length && subject ? 1 : 0.5 }}>
                    Open in Mail App ({selected.length})
                  </button>
                  <span style={{ fontSize:10, color:'var(--muted)' }}>"Hi [Name]" becomes the recipient's first name; multiple recipients read "Hey everyone," and go in BCC.</span>
                </div>
              </div>
            </div>
          </>
        )}
        {preview && (
          <div onClick={e => e.target === e.currentTarget && setPreview(null)}
            style={{ position:'fixed', inset:0, zIndex:130, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, width:'100%', maxWidth:1000, height:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:800 }}>{preview.kind === 'client' ? 'Client call sheet' : `Call sheet — ${preview.name}`} <span style={{ color:'var(--muted)', fontWeight:400 }}>{preview.kind === 'client' ? '(client view)' : '(their events only)'}</span></div>
                <div style={{ display:'flex', gap:8 }}>
                  <a href={preview.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Open in Tab ↗</a>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>✕</button>
                </div>
              </div>
              <iframe title="call sheet preview" src={preview.url} style={{ flex:1, border:'none', background:'#0b0b0b' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
