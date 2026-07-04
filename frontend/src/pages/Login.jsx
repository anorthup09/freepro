import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Login() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setNotice(''); setLoading(true);
    try {
      if (mode === 'register') {
        const { token, user } = await api.register(name, email, password);
        localStorage.setItem('fp_token', token);
        setUser(user);
        nav('/');
      } else {
        const { token, user } = await api.login(email, password);
        localStorage.setItem('fp_token', token);
        setUser(user);
        nav('/');
      }
    } catch (e) {
      setErr(Array.isArray(e.message) ? 'Please check your details and try again' : e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">Free<em>Pro</em></div>
        <div style={{ textAlign:'center', fontSize:9, color:'var(--muted)', letterSpacing:'0.06em', marginTop:-6, marginBottom:8 }}>Powered by Unbridled Media</div>
        {err && <div className="login-err">{err}</div>}
        {notice && <div style={{ background:'var(--green-bg)', border:'1px solid var(--green-border)', color:'var(--green-text)', borderRadius:6, padding:'8px 12px', fontSize:12, marginBottom:10 }}>{notice}</div>}
        <form onSubmit={submit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'register' && (
              <div className="field">
                <label>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus={mode === 'login'} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            <button className="btn btn-primary" style={{ marginTop: 4 }} disabled={loading}>
              {loading ? (mode === 'register' ? 'Creating account…' : 'Signing in…') : (mode === 'register' ? 'Create account' : 'Sign in')}
            </button>
          </div>
        </form>
        <div style={{ textAlign:'center', marginTop:14 }}>
          <button type="button" onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setErr(''); setNotice(''); }}
            style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer', textDecoration:'underline' }}>
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </button>
        </div>
        {mode === 'register' && (
          <div style={{ textAlign:'center', fontSize:11, color:'var(--muted)', marginTop:10, lineHeight:1.5 }}>
            New accounts have no access until an admin approves them.
          </div>
        )}
      </div>
    </div>
  );
}
