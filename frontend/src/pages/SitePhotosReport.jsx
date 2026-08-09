import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import HomeButton from '../components/HomeButton.jsx';

const ACCENT = '#f2a878';

// The photo file endpoint needs the bearer token, so a plain <img src> can't
// load it — fetch to a blob URL (same pattern as Foodie Recs).
function Photo({ id, onClick }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let obj;
    fetch(`/api/dashboard/site-photo/${id}/file`, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(b => { if (b) { obj = URL.createObjectURL(b); setUrl(obj); } })
      .catch(() => {});
    return () => obj && URL.revokeObjectURL(obj);
  }, [id]);
  if (!url) return <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 10, background: 'rgba(255,255,255,0.05)' }} />;
  return <img src={url} alt="" onClick={onClick}
    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 10, display: 'block', cursor: 'zoom-in' }} />;
}

// Every on-site photo submitted from the hub — People report.
export default function SitePhotosReport() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(null); // row being viewed full-size
  useEffect(() => { api.sitePhotos().then(setRows).catch(e => setErr(e.message)); }, []);
  const fmtD = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const canDelete = r => user?.role === 'ADMIN' || (r.member_email || '').toLowerCase() === (user?.email || '').toLowerCase();
  async function remove(r) {
    if (!confirm(`Delete this photo from ${r.member_name || r.member_email}?`)) return;
    try { await api.deleteSitePhoto(r.id); setRows(rs => rs.filter(x => x.id !== r.id)); }
    catch (e) { alert(e.message); }
  }
  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700, letterSpacing: '0.04em' }}>Reports &amp; Resources</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Reports</Link>
          <HomeButton />
        </div>
      </div>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div className="page-title">On-Site Photos</div>
        <div className="page-sub">Every photo submitted from the hub — they rotate through the daily MediaMoment{rows ? ` · ${rows.length}` : ''}.</div>
        {err && <div className="empty">{err}</div>}
        {rows && rows.length === 0 && <div className="empty">No photos yet — submit one from the hub with "Submit a Photo!".</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginTop: 14 }}>
          {(rows || []).map(r => (
            <div key={r.id} className="glass" style={{ borderRadius: 14, padding: 12 }}>
              <Photo id={r.id} onClick={() => setZoom(r)} />
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 9 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.member_name || r.member_email}</div>
                <div style={{ fontSize: 9.5, color: 'var(--muted)', flexShrink: 0 }}>{fmtD(r.created_at)}</div>
              </div>
              {r.caption && <div style={{ fontSize: 11.5, color: 'var(--text)', marginTop: 3, lineHeight: 1.4 }}>“{r.caption}”</div>}
              {canDelete(r) && (
                <button onClick={() => remove(r)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 10, cursor: 'pointer', padding: 0, marginTop: 6, textDecoration: 'underline' }}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {zoom && (
        <div onClick={() => setZoom(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <FullPhoto id={zoom.id} />
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{zoom.member_name || zoom.member_email}</div>
            {zoom.caption && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>“{zoom.caption}”</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function FullPhoto({ id }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let obj;
    fetch(`/api/dashboard/site-photo/${id}/file`, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(b => { if (b) { obj = URL.createObjectURL(b); setUrl(obj); } })
      .catch(() => {});
    return () => obj && URL.revokeObjectURL(obj);
  }, [id]);
  if (!url) return <div style={{ width: 'min(80vw, 720px)', height: '50vh', borderRadius: 12, background: 'rgba(255,255,255,0.05)' }} />;
  return <img src={url} alt="" style={{ maxWidth: '92vw', maxHeight: '74vh', borderRadius: 12, objectFit: 'contain' }} />;
}
