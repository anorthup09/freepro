import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// Searchable client dropdown backed by the client roster.
// New names go through /clients/roster, which flags likely duplicates;
// the user can pick the existing client or override and add anyway.
export default function ClientSelect({ value, onChange, inputStyle }) {
  const [roster, setRoster] = useState(null);
  const [q, setQ] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [dups, setDups] = useState(null);   // possible duplicates awaiting a decision
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  useEffect(() => { api.clientRoster().then(setRoster).catch(() => setRoster([])); }, []);
  useEffect(() => { setQ(value || ''); }, [value]);
  useEffect(() => {
    const close = e => { if (box.current && !box.current.contains(e.target)) { setOpen(false); setDups(null); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const s = q.trim().toLowerCase();
  const matches = (roster || []).filter(c => c.name.toLowerCase().includes(s));
  const exact = (roster || []).some(c => c.name.toLowerCase() === s);

  function pick(name) {
    onChange(name);
    setQ(name);
    setOpen(false);
    setDups(null);
  }

  async function addNew(force) {
    const name = q.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const c = await api.addClient(name, force);
      setRoster(r => (r || []).some(x => x.name === c.name) ? r : [...(r || []), c].sort((a, b) => a.name.localeCompare(b.name)));
      pick(c.name);
    } catch (e) {
      const list = e.body?.possibleDuplicates;
      if (list?.length) setDups(list);
      else alert(e.message);
    }
    setBusy(false);
  }

  return (
    <div ref={box} style={{ position:'relative' }}>
      <input value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); setDups(null); if (!e.target.value.trim()) onChange(''); }}
        onFocus={() => setOpen(true)}
        placeholder="Search clients…"
        style={inputStyle || { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'8px 10px', fontSize:13, width:'100%' }} />
      {open && roster && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:40, marginTop:4, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, maxHeight:220, overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
          {dups ? (
            <div style={{ padding:'10px 12px' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#e6c229', marginBottom:6 }}>⚠ Possible duplicate</div>
              <div style={{ fontSize:10, color:'var(--muted)', marginBottom:8 }}>“{q.trim()}” looks a lot like an existing client. Pick the existing one, or add anyway if it's really a different client.</div>
              {dups.map(name => (
                <div key={name} onClick={() => pick(name)}
                  style={{ padding:'7px 10px', fontSize:12, fontWeight:700, cursor:'pointer', borderRadius:6, border:'1px solid var(--border)', marginBottom:6 }}>
                  Use “{name}”
                </div>
              ))}
              <button onClick={() => addNew(true)} disabled={busy}
                style={{ width:'100%', background:'none', border:'1px solid #e6c229', color:'#e6c229', borderRadius:6, padding:'7px 10px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                {busy ? 'Adding…' : `It's a different client — add “${q.trim()}”`}
              </button>
            </div>
          ) : (
            <>
              {matches.map(c => (
                <div key={c.id} onClick={() => pick(c.name)}
                  style={{ padding:'8px 12px', fontSize:12, cursor:'pointer', fontWeight: c.name === value ? 800 : 500 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  {c.name}
                </div>
              ))}
              {matches.length === 0 && !s && <div style={{ padding:'8px 12px', fontSize:11, color:'var(--muted)' }}>Type to search the client roster.</div>}
              {s && !exact && (
                <div onClick={() => addNew(false)}
                  style={{ padding:'8px 12px', fontSize:12, fontWeight:800, color:'#5ABF80', cursor:'pointer', borderTop: matches.length ? '1px solid var(--border)' : 'none' }}>
                  {busy ? 'Checking…' : `+ Add “${q.trim()}” as a new client`}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
