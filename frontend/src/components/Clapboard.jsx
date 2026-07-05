import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Running local-time timecode: HH.MM.SS.xx AM/PM in slate red on black
function TimecodeBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 50);
    return () => clearInterval(id);
  }, []);
  const h24 = now.getHours();
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h = String(h24 % 12 || 12).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  const cs = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
  return (
    <div style={{ background: '#000', padding: '14px 12px', textAlign: 'center' }}>
      <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 30, letterSpacing: '0.06em', color: '#ff2222', textShadow: '0 0 12px rgba(255,34,34,0.6)', fontVariantNumeric: 'tabular-nums' }}>
        {h}.{m}.{sec}.{cs} <span style={{ fontSize: 18 }}>{ampm}</span>
      </span>
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
export default function Clapboard({ title, date, location, fieldProducer, director, camera, onClose, editableTitle }) {
  const [take, setTake] = useState(1);
  const [titleVal, setTitleVal] = useState(title || '');

  return createPortal(
    <div className="modal-bg" onClick={onClose} style={{ zIndex: 300 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(440px, 94vw)', background: '#fdfdfb', borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)', border: '1px solid rgba(0,0,0,0.4)',
      }}>
        <TimecodeBar />

        <div style={{ padding: '14px 18px 18px' }}>
          <Row name="Prod">{fieldProducer || '—'}</Row>

          {/* Title | Take grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', borderBottom: '2px solid #111' }}>
            <div style={{ padding: '12px 2px 10px', borderRight: '2px solid #111' }}>
              <div style={{ ...label, marginBottom: 4 }}>Title</div>
              {editableTitle ? (
                <input value={titleVal} onChange={e => setTitleVal(e.target.value)} placeholder="Title…" autoFocus
                  style={{ ...value, fontSize: 18, width: '100%', background: 'transparent', border: 'none', borderBottom: '1px dashed #999', outline: 'none', padding: 0 }} />
              ) : (
                <div style={{ ...value, fontSize: 18 }}>{title || '—'}</div>
              )}
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
          {location && <Row name="Loc">{location}</Row>}

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
