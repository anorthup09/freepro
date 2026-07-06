import React, { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function MfaSetup() {
  const { user, setUser } = useAuth();
  const [setup, setSetup] = useState(null); // { qr, secret, recovery }
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedCodes, setSavedCodes] = useState(false);

  async function begin() {
    setBusy(true); setErr('');
    try { setSetup(await api.mfaSetup()); } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.mfaEnable(code);
      setUser(u => ({ ...u, mfa_enabled: true }));
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-box" style={{ maxWidth: 440 }}>
        <div className="login-logo">Free<em>Pro</em></div>
        <div style={{ textAlign:'center', fontSize:13, fontWeight:700, margin:'12px 0 4px' }}>Secure your account</div>
        <div style={{ fontSize:12, color:'var(--muted)', textAlign:'center', lineHeight:1.6, marginBottom:14 }}>
          {user?.name?.split(' ')[0]}, two-factor authentication is required for every
          Unbridled Media platform account. It takes about a minute with the
          <b> Microsoft Authenticator</b> app you already have (Google Authenticator and 1Password work too).
        </div>
        {err && <div className="login-err">{err}</div>}

        {!setup ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button className="btn btn-primary" disabled={busy} onClick={begin}>{busy ? 'One sec…' : 'Set up two-factor'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:12, lineHeight:1.6, marginBottom:10 }}>
              <b>1.</b> Open Microsoft Authenticator → <b>+</b> → <b>Other account</b><br />
              <b>2.</b> Scan this QR code:
            </div>
            <div style={{ textAlign:'center', margin:'10px 0' }}>
              <img src={setup.qr} alt="Scan with your authenticator app" style={{ borderRadius:10, width:190 }} />
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:6 }}>Can't scan? Enter this key manually:<br />
                <code style={{ fontSize:11, userSelect:'all' }}>{setup.secret}</code>
              </div>
            </div>

            <div style={{ background:'rgba(230,194,41,0.07)', border:'1px solid rgba(230,194,41,0.35)', borderRadius:8, padding:'10px 12px', margin:'12px 0' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#e6c229', marginBottom:6 }}>Recovery codes — save these somewhere safe</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 14px', fontFamily:'monospace', fontSize:12, userSelect:'all' }}>
                {setup.recovery.map(c => <span key={c}>{c}</span>)}
              </div>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:6 }}>Each works once if you ever lose your phone.</div>
              <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:11, marginTop:8, cursor:'pointer' }}>
                <input type="checkbox" checked={savedCodes} onChange={e => setSavedCodes(e.target.checked)} style={{ width:'auto' }} />
                I've saved my recovery codes
              </label>
            </div>

            <form onSubmit={confirm} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontSize:12 }}><b>3.</b> Enter the 6-digit code the app shows:</div>
              <input autoFocus inputMode="numeric" autoComplete="one-time-code" placeholder="123 456"
                value={code} onChange={e => setCode(e.target.value)}
                style={{ textAlign:'center', fontSize:20, letterSpacing:'0.2em' }} />
              <button className="btn btn-primary" disabled={busy || !savedCodes || !code.trim()}>
                {busy ? 'Verifying…' : 'Turn on two-factor'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
