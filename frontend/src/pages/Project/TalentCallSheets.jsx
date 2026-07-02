import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';

export default function TalentCallSheets() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [talent, setTalent] = useState([]);
  const [shares, setShares] = useState([]);
  const [project, setProject] = useState(null);
  const [copyToast, setCopyToast] = useState('');
  const [loading, setLoading] = useState(true);
  const pdfFrameRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.getProject(id),
      api.getTalent(id),
      api.getShares(id),
    ]).then(([proj, tal, sh]) => {
      setProject(proj);
      setTalent(tal);
      setShares(sh);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  function getShareToken(talentName) {
    const s = shares.find(s => s.view_type === 'talent' && s.talent_name === talentName);
    return s ? s.token : null;
  }

  async function ensureToken(talentName) {
    let token = getShareToken(talentName);
    if (!token) {
      const s = await api.createShare(id, { viewType: 'talent', talentName });
      setShares(prev => [...prev, s]);
      token = s.token;
    }
    return token;
  }

  async function copyLink(t) {
    const token = await ensureToken(t.name);
    const url = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url);
    setCopyToast(t.id);
    setTimeout(() => setCopyToast(''), 2000);
  }

  async function downloadPdf(t) {
    const token = await ensureToken(t.name);
    const pw = project?.share_password || '';
    const url = `${window.location.origin}/share/${token}${pw ? `?pw=${pw}` : ''}`;
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => { try { win.print(); } catch(e) {} };
    }
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(`/projects/${id}`)}
          style={{ fontSize: 12 }}
        >
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            {project?.code}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            Talent Call Sheets
          </div>
        </div>
      </div>

      {talent.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
          No talent added yet. Add talent on the Crew tab.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Name', 'Role', 'Email', 'Copy Link', 'Download PDF'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {talent.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text)' }}>{t.name}</td>
                <td style={{ padding: '12px 12px', color: 'var(--muted)' }}>{t.role || '—'}</td>
                <td style={{ padding: '12px 12px', color: 'var(--muted)' }}>{t.email || '—'}</td>
                <td style={{ padding: '12px 12px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => copyLink(t)}
                    style={{ fontSize: 11 }}
                  >
                    {copyToast === t.id ? '✓ Copied!' : '⎘ Copy Link'}
                  </button>
                </td>
                <td style={{ padding: '12px 12px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => downloadPdf(t)}
                    style={{ fontSize: 11 }}
                  >
                    ⬇ Download PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <iframe ref={pdfFrameRef} style={{ display: 'none' }} title="pdf" />
    </div>
  );
}
