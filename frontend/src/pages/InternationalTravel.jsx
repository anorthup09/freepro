import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import HomeButton from '../components/HomeButton.jsx';

// International Travel Requirements — reference page (content from the team's
// International Travel Requirements doc). Read-only resource.
const ACCENT = '#4a9eff';

const SECTIONS = [
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
      { text: 'Take out $50–$100 in cash and go to a bank to exchange for the local currency of the country you are traveling to.', sub: [
        'Having cash on hand on-site can be a lifesaver.',
      ] },
    ],
  },
  {
    title: 'Carnet Import / Export',
    items: [
      { text: 'Where to get your Carnet signed:', sub: [
        'The last point where you have access to your gear is where you need to get the Carnet signed. If you are at the international airport and for some reason cannot get it signed, as long as you get it signed when you land in the US, they will be able to accept it and dispute any charges that could come up.',
        'Present your Carnet and goods to U.S. Customs before checking in your baggage and boarding your flight, even if it connects at another U.S. city. U.S. Customs and Border Protection has recently ruled that Carnets should be stamped out of the U.S. (export or re-export) where the Carnet holder last had control of the goods and is not able to come into contact with them until they have arrived at the final foreign destination. For example, a U.S. company is going to show some samples listed on an ATA Carnet to a potential customer in the U.K. The Carnet holder has a flight from Dallas to New York, connecting to a New York–Heathrow flight. He would present his goods and Carnet at U.S. Customs at Dallas for export validation before checking in his luggage with the air carrier through to London.',
      ] },
    ],
  },
];

export default function InternationalTravel() {
  const { user } = useAuth();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <span style={{ fontSize: 12, color: '#e6c229', fontWeight: 700, letterSpacing: '0.04em' }}>Reports</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Reports</Link>
          <HomeButton />
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div className="page-title">International Travel Requirements</div>
        <div className="page-sub">Tips for international travel — budgeting, scheduling, and Carnet import/export.</div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SECTIONS.map(sec => (
            <div key={sec.title} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: `3px solid ${ACCENT}`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>{sec.title}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sec.items.map((it, i) => (
                  <li key={i}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: ACCENT, fontWeight: 800, flexShrink: 0, lineHeight: 1.55 }}>›</span>
                      <span style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55 }}>{it.text}</span>
                    </div>
                    {it.sub && (
                      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: '0 0 0 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {it.sub.map((s, j) => (
                          <li key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--muted)', flexShrink: 0, lineHeight: 1.55 }}>–</span>
                            <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>{s}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
