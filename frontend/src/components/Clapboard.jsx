import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const STRIPES = ['#111', '#1a9850', '#e8d417', '#2b7de0', '#e03131', '#e9e9e9', '#8a8a8a', '#4a4a4a', '#241f1f'];

function StripeBar({ flipped }) {
  return (
    <div style={{ display: 'flex', height: 34, overflow: 'hidden', background: '#111' }}>
      {STRIPES.map((c, i) => (
        <div key={i} style={{
          flex: 1,
          background: c,
          transform: flipped ? 'skewX(30deg)' : 'skewX(-30deg)',
          marginLeft: i === 0 ? -14 : 2,
          marginRight: i === STRIPES.length - 1 ? -14 : 0,
        }} />
      ))}
    </div>
  );
}

const label = { fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.04em', color: '#111', textTransform: 'uppercase', fontStyle: 'italic' };
const value = { fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: '#111', minWidth: 0, overflowWrap: 'anywhere' };

function Row({ name, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: '2px solid #111', padding: '10px 2px 6px' }}>
      <span style={label}>{name}:</span>
      <span style={value}>{children}</span>
    </div>
  );
}

// Pop-out clapboard slate for filming events. Crew names come from the
// project's Field Producer / Director / Camera Operator assignments.
export default function Clapboard({ title, date, fieldProducer, director, camera, onClose }) {
  const [take, setTake] = useState(1);

  return createPortal(
    <div className="modal-bg" onClick={onClose} style={{ zIndex: 300 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(440px, 94vw)', background: '#fdfdfb', borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)', border: '1px solid rgba(0,0,0,0.4)',
      }}>
        {/* Hinged sticks */}
        <div style={{ transform: 'rotate(-3deg) translateY(-4px)', transformOrigin: 'left bottom', margin: '10px 6px 0' , borderRadius: 6, overflow: 'hidden', boxShadow: '0 3px 8px rgba(0,0,0,0.35)' }}>
          <StripeBar />
        </div>
        <div style={{ margin: '2px 6px 0', borderRadius: 6, overflow: 'hidden' }}>
          <StripeBar flipped />
        </div>

        <div style={{ padding: '14px 18px 18px' }}>
          <Row name="Prod">{fieldProducer || '—'}</Row>

          {/* Title | Take grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', borderBottom: '2px solid #111' }}>
            <div style={{ padding: '12px 2px 10px', borderRight: '2px solid #111' }}>
              <div style={{ ...label, marginBottom: 4 }}>Title</div>
              <div style={{ ...value, fontSize: 18 }}>{title || '—'}</div>
            </div>
            <div style={{ padding: '12px 8px 10px', textAlign: 'center' }}>
              <div style={{ ...label, marginBottom: 4 }}>Take</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <button onClick={() => setTake(t => Math.max(1, t - 1))}
                  style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>‹</button>
                <span style={{ ...value, fontSize: 26, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'center' }}>{take}</span>
                <button onClick={() => setTake(t => t + 1)}
                  style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>›</button>
              </div>
            </div>
          </div>

          <Row name="Director">{director || '—'}</Row>
          <Row name="Camera">{camera || '—'}</Row>
          <Row name="Date">{date || '—'}</Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={onClose}
              style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
