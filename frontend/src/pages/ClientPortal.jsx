import React from 'react';
import { useParams } from 'react-router-dom';

// Public, client-facing landing. Intentionally blank for now — just the
// Unbridled Media logo and the client's name, with no navigation (clients
// have no access to the rest of the platform). Project content lands here later.
export default function ClientPortal() {
  const { client } = useParams();
  const name = decodeURIComponent(client || '');
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'22px 26px', borderBottom:'1px solid var(--border)' }}>
        <img src="/unbridled-logo.png" alt="Unbridled Media"
          style={{ height:26, filter:'brightness(0) invert(1)', opacity:0.95, display:'block' }} />
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:34, letterSpacing:'-0.5px', color:'var(--text)', textAlign:'center' }}>
          {name}
        </div>
      </div>
    </div>
  );
}
