import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

export default function ResetPassword() {
  const { token } = useParams();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (password !== confirm) return setErr('Passwords do not match');
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => nav('/login'), 2500);
    } catch (er) { setErr(er.message); }
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, marginBottom:16 }}>
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:30, filter:'brightness(0) invert(1)', opacity:0.95 }} />
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.05em', textAlign:'center', color:'var(--text)', whiteSpace:'nowrap' }}>
              Project Finance · Production · Post · Team Management
            </div>
          </div>
        {done ? (
          <div style={{ textAlign:'center', fontSize:13, lineHeight:1.6, padding:'10px 0' }}>
            ✓ Password updated.<br />
            <span style={{ color:'var(--muted)', fontSize:12 }}>Taking you to sign in…</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize:13, fontWeight:700, textAlign:'center', margin:'6px 0 12px' }}>Choose a new password</div>
            {err && <div className="login-err">{err}</div>}
            <form onSubmit={submit}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="field">
                  <label>New Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoFocus />
                </div>
                <div className="field">
                  <label>Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />
                </div>
                <button className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Reset Password'}</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
