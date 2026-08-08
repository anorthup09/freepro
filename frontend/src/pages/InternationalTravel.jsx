import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';

// International Travel Requirements — editable resource (producers/admin can edit).
// Content persists via /api/resources/docs/international-travel; the array below
// is the default until the first save.
const ACCENT = '#4a9eff';
const DOC_KEY = 'international-travel';

const DEFAULT_SECTIONS = [
  {
    title: 'Necessities',
    items: [
      { text: 'Allocate Carnet costs in the budget (around $500 for each).' },
      { text: 'Leave room in the budget for additional drives and baggage fees!' },
      { text: 'When booking flights, allow enough time during layovers for carnet signs, getting through customs, and re-checking bags. Two hours is the minimum. If you have any questions about this, see Joey Goldman.' },
      { text: 'Allow at least one extra day on each tail end of the program.', sub: [
        'This allows for handling any on-site emergencies before we depart.',
        'This allows time to get acquainted with the area, adjust to time-zone changes, and pick up gear.',
      ] },
      { text: 'If we are renting gear internationally, some rental houses are not open on weekends.', sub: [
        'So if we are traveling in on a weekend and need gear by Monday, we need to be in the country by Friday to have an opportunity to pick up the gear.',
      ] },
      { text: 'Check on visas to enter the country we are shooting in.' },
    ],
  },
  {
    title: 'Recommendations',
    items: [
      { text: 'Only get rental cars in countries that drive on the same side of the road as us, to avoid incidents.' },
      { text: 'Take out $50-$100 in cash and go to a bank to exchange for the local currency of the country you are traveling to.', sub: [
        'Having cash on hand on-site can be a lifesaver.',
      ] },
    ],
  },
  {
    title: 'Carnet Import / Export',
    items: [
      { text: 'Where to get your Carnet signed:', sub: [
        'The last point where you have access to your gear is where you need to get the Carnet signed. If you are at the international airport and for some reason cannot get it signed, as long as you get it signed when you land in the US, they will be able to accept it and dispute any charges that could come up.',
        'Present your Carnet and goods to U.S. Customs before checking in your baggage and boarding your flight, even if it connects at another U.S. city. U.S. Customs and Border Protection has recently ruled that Carnets should be stamped out of the U.S. (export or re-export) where the Carnet holder last had control of the goods and is not able to come into contact with them until they have arrived at the final foreign destination. For example, a U.S. company is going to show some samples listed on an ATA Carnet to a potential customer in the U.K. The Carnet holder has a flight from Dallas to New York, connecting to a New York-Heathrow flight. He would present his goods and Carnet at U.S. Customs at Dallas for export validation before checking in his luggage with the air carrier through to London.',
      ] },
    ],
  },
];

// Normalize any stored shape into [{title, items:[{text, sub:[]}]}].
const normalize = secs => (Array.isArray(secs) ? secs : []).map(s => ({
  title: s.title || '',
  items: (s.items || []).map(it => ({ text: it.text || '', sub: Array.isArray(it.sub) ? it.sub.slice() : [] })),
}));

export default function InternationalTravel() {
  const { user } = useAuth();
  const canEdit = ['ADMIN', 'PRODUCER'].includes(user?.role);
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.resourceDoc(DOC_KEY).then(d => {
      if (d?.data?.sections?.length) setSections(normalize(d.data.sections));
    }).catch(() => {});
  }, []);

  function startEdit() { setDraft(normalize(sections)); setEditing(true); }
  function cancel() { setDraft(null); setEditing(false); }
  async function save() {
    setSaving(true);
    const clean = normalize(draft)
      .map(s => ({ title: s.title.trim(), items: s.items.filter(it => it.text.trim()).map(it => ({ text: it.text.trim(), sub: it.sub.map(x => x.trim()).filter(Boolean) })) }))
      .filter(s => s.title || s.items.length);
    try {
      await api.saveResourceDoc(DOC_KEY, { sections: clean });
      setSections(clean); setEditing(false); setDraft(null);
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  // Draft mutators
  const up = fn => setDraft(d => { const n = normalize(d); fn(n); return n; });
  const setSecTitle = (si, v) => up(n => { n[si].title = v; });
  const setItemText = (si, ii, v) => up(n => { n[si].items[ii].text = v; });
  const setSubText = (si, ii, ki, v) => up(n => { n[si].items[ii].sub[ki] = v; });
  const addItem = si => up(n => { n[si].items.push({ text: '', sub: [] }); });
  const delItem = (si, ii) => up(n => { n[si].items.splice(ii, 1); });
  const addSub = (si, ii) => up(n => { n[si].items[ii].sub.push(''); });
  const delSub = (si, ii, ki) => up(n => { n[si].items[ii].sub.splice(ki, 1); });
  const addSection = () => up(n => { n.push({ title: 'New Section', items: [] }); });
  const delSection = si => up(n => { n.splice(si, 1); });

  const inp = { fontSize: 13, padding: '6px 9px', borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', width: '100%' };
  const smallBtn = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 10, padding: '3px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' };
  const view = editing ? draft : sections;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <span style={{ fontSize: 12, color: '#e6c229', fontWeight: 700, letterSpacing: '0.04em' }}>Reports & Resources</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Reports</Link>
          <HomeButton />
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div className="page-title">International Travel Requirements</div>
            <div className="page-sub">Tips for international travel — budgeting, scheduling, and Carnet import/export.</div>
          </div>
          {canEdit && !editing && <button onClick={startEdit} className="btn btn-ghost btn-sm">Edit</button>}
          {editing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancel} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {view.map((sec, si) => (
            <div key={si} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: `3px solid ${ACCENT}`, borderRadius: 12, padding: '16px 20px' }}>
              {editing ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <input value={sec.title} onChange={e => setSecTitle(si, e.target.value)} style={{ ...inp, fontWeight: 800 }} placeholder="Section title" />
                  <button onClick={() => delSection(si)} style={{ ...smallBtn, color: '#e05252', borderColor: '#e05252', whiteSpace: 'nowrap' }}>Delete</button>
                </div>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>{sec.title}</div>
              )}

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sec.items.map((it, ii) => (
                  <li key={ii}>
                    {editing ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: ACCENT, fontWeight: 800, lineHeight: 1.9 }}>›</span>
                        <textarea value={it.text} onChange={e => setItemText(si, ii, e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', lineHeight: 1.45 }} placeholder="Point" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button onClick={() => addSub(si, ii)} style={smallBtn} title="Add a sub-point">+ Sub</button>
                          <button onClick={() => delItem(si, ii)} style={{ ...smallBtn, color: '#e05252', borderColor: '#e05252' }}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: ACCENT, fontWeight: 800, flexShrink: 0, lineHeight: 1.55 }}>›</span>
                        <span style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55 }}>{it.text}</span>
                      </div>
                    )}
                    {(it.sub && it.sub.length > 0) && (
                      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: '0 0 0 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {it.sub.map((s, ki) => (
                          <li key={ki} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--muted)', flexShrink: 0, lineHeight: editing ? 1.9 : 1.55 }}>–</span>
                            {editing ? (
                              <>
                                <textarea value={s} onChange={e => setSubText(si, ii, ki, e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', fontSize: 12.5, lineHeight: 1.45 }} placeholder="Sub-point" />
                                <button onClick={() => delSub(si, ii, ki)} style={{ ...smallBtn, color: '#e05252', borderColor: '#e05252' }}>✕</button>
                              </>
                            ) : (
                              <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>{s}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>

              {editing && <button onClick={() => addItem(si)} style={{ ...smallBtn, marginTop: 12 }}>+ Point</button>}
            </div>
          ))}
          {editing && <button onClick={addSection} style={{ ...smallBtn, alignSelf: 'flex-start', padding: '6px 14px' }}>+ Section</button>}
        </div>
      </div>
    </div>
  );
}
