import React, { useState } from 'react';

// Ready-For-Review prompt: the editor writes review notes for the director,
// then commits with the yellow "Confirm RFR" button. Notes ride along in the
// notification email. onConfirm(notes) should perform the actual RFR call.
export default function RfrModal({ title, onConfirm, onClose }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(notes.trim()); }
    catch (e) { alert(e.message); setBusy(false); }
  };
  return (
    <div onClick={ev => ev.target === ev.currentTarget && !busy && onClose()}
      style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:480, background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #e6c229', borderRadius:12, padding:'20px 22px' }}>
        <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>Ready For Review</div>
        <div style={{ fontSize:11.5, color:'var(--muted)', lineHeight:1.5, marginBottom:12 }}>
          {title ? `${title} — ` : ''}Add review notes for the director. They’re included in the review notification.
        </div>
        <textarea autoFocus value={notes} onChange={e => setNotes(e.target.value)} rows={4}
          placeholder="Notes for the director… what to look at, what changed, any questions."
          style={{ width:'100%', fontSize:13, lineHeight:1.5, resize:'vertical' }} />
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:14 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button onClick={confirm} disabled={busy}
            style={{ background:'rgba(230,194,41,0.16)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:20, padding:'7px 18px', fontSize:12, fontWeight:800, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'Sending…' : 'Confirm RFR'}
          </button>
        </div>
      </div>
    </div>
  );
}
