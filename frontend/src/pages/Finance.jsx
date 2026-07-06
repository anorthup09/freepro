import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function Finance() {
  const { user, setUser } = useAuth();
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" className="logo" style={{ fontSize:18, textDecoration:'none' }}>Unbridled <em>Media</em></Link>
          <span style={{ fontSize:11, color:'#5ABF80', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Project Finance</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'70vh', padding:16 }}>
        <div style={{ maxWidth:520, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'rgba(90,191,128,0.12)', color:'#5ABF80', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, margin:'0 auto 18px' }}>$</div>
          <div style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>Project Finance is on the way</div>
          <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.7 }}>
            Budget creation &amp; versioning, vendor cost control, and final reconciliation —
            with client-ready budget pages that match your brand. Contractor rates and travel
            costs from FreePro will flow in automatically.
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:22 }}>
            <Link to="/projects" className="btn btn-primary btn-sm" style={{ textDecoration:'none' }}>Go to FreePro</Link>
            <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Back to Hub</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
