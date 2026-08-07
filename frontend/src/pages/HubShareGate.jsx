import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

// Password gate for a read-only Hub preview link. On success it stores the guest
// producer token as the app session and reloads into the Hub.
export default function HubShareGate() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Clear any existing (real) session so the preview doesn't inherit it.
  useEffect(() => { localStorage.removeItem('fp_token'); localStorage.removeItem('fp_role_preview'); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api.hubShareAuth(token, password);
      localStorage.setItem('fp_token', r.token);
      window.location.href = '/';
    } catch (e) {
      setErr(e.message || 'Could not open the preview');
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:20 }}>
      <form onSubmit={submit}
        style={{ width:'100%', maxWidth:380, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16, padding:'30px 28px', display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:'.16em', color:'var(--orange)', textTransform:'uppercase' }}>Unbridled</div>
          <div style={{ fontSize:20, fontWeight:800, color:'var(--text)', marginTop:4 }}>Hub Preview</div>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:6, lineHeight:1.4 }}>Read-only walkthrough of the platform. Enter the password to continue.</div>
        </div>
        <input type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          style={{ fontSize:14, padding:'10px 12px', borderRadius:10, background:'var(--bg)', color:'var(--text)', border:'1px solid var(--border)' }} />
        {err && <div style={{ fontSize:12, color:'#ff5c5c' }}>{err}</div>}
        <button type="submit" disabled={busy}
          style={{ fontSize:14, fontWeight:800, padding:'10px 12px', borderRadius:10, border:'none', background:'var(--orange)', color:'#14092e', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Opening…' : 'Enter preview'}
        </button>
      </form>
    </div>
  );
}
