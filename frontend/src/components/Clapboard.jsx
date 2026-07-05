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
    <div style={{ background: '#000', padding: 'min(10px, 1.4vh) 44px min(10px, 1.4vh) 12px', textAlign: 'center', position: 'relative' }}>
      <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 'min(56px, 7vw, 11vh)', letterSpacing: '0.06em', color: '#ff2222', textShadow: '0 0 12px rgba(255,34,34,0.6)', fontVariantNumeric: 'tabular-nums' }}>
        {h}.{m}.{sec}.{cs} <span style={{ fontSize: '0.55em' }}>{ampm}</span>
      </span>
    </div>
  );
}

const label = { fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 'min(24px, 2.6vw + 6px, 5vh)', letterSpacing: '0.04em', color: '#111', textTransform: 'uppercase', fontStyle: 'italic' };
const value = { fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 'min(28px, 3vw + 7px, 6vh)', color: '#111', minWidth: 0, overflowWrap: 'anywhere' };

function Row({ name, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: '2px solid #111', padding: 'min(8px, 1.1vh) 2px min(5px, 0.7vh)' }}>
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
  const [landscape, setLandscape] = useState(() => typeof window !== 'undefined' && window.innerWidth > window.innerHeight);
  useEffect(() => {
    const onResize = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return createPortal(
    <div className="modal-bg" onClick={onClose} style={{ zIndex: 300 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100vw', height: '100dvh', overflowY: 'auto', background: '#fdfdfb', position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>
        <TimecodeBar />
        <button onClick={onClose} aria-label="Close"
          style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>✕</button>

        <div style={{ padding: 'min(10px, 1.4vh) 18px min(12px, 1.6vh)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
          <Row name="Prod">{fieldProducer || '—'}</Row>

          {/* Title | Take grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(150px, 24%)', borderBottom: '2px solid #111' }}>
            <div style={{ padding: 'min(10px, 1.4vh) 2px min(8px, 1.1vh)', borderRight: '2px solid #111' }}>
              <div style={{ ...label, marginBottom: 4 }}>Title</div>
              {editableTitle ? (
                <input value={titleVal} onChange={e => setTitleVal(e.target.value)} placeholder="Title…" autoFocus
                  style={{ ...value, fontSize: 'min(34px, 3.6vw + 8px, 7vh)', width: '100%', background: 'transparent', border: 'none', borderBottom: '1px dashed #999', outline: 'none', padding: 0 }} />
              ) : (
                <div style={{ ...value, fontSize: 'min(34px, 3.6vw + 8px, 7vh)' }}>{title || '—'}</div>
              )}
            </div>
            <div style={{ padding: 'min(10px, 1.4vh) 8px min(8px, 1.1vh)', textAlign: 'center' }}>
              <div style={{ ...label, marginBottom: 4 }}>Take</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <button onClick={() => setTake(t => Math.max(1, t - 1))}
                  style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, width: 'min(40px, 7vh)', height: 'min(40px, 7vh)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>‹</button>
                <span style={{ ...value, fontSize: 'min(48px, 5vw + 12px, 8vh)', fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'center' }}>{take}</span>
                <button onClick={() => setTake(t => t + 1)}
                  style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, width: 'min(40px, 7vh)', height: 'min(40px, 7vh)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>›</button>
              </div>
            </div>
          </div>

          {landscape ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #111' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: 'min(8px, 1.1vh) 2px min(5px, 0.7vh)', borderRight: '2px solid #111' }}>
                  <span style={label}>Director:</span><span style={value}>{director || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: 'min(8px, 1.1vh) 10px min(5px, 0.7vh)' }}>
                  <span style={label}>Camera:</span><span style={value}>{camera || '—'}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #111' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: 'min(8px, 1.1vh) 2px min(5px, 0.7vh)', borderRight: '2px solid #111' }}>
                  <span style={label}>Date:</span><span style={value}>{date || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: 'min(8px, 1.1vh) 10px min(5px, 0.7vh)' }}>
                  <span style={label}>Loc:</span><span style={value}>{location || '—'}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <Row name="Director">{director || '—'}</Row>
              <Row name="Camera">{camera || '—'}</Row>
              <Row name="Date">{date || '—'}</Row>
              {location && <Row name="Loc">{location}</Row>}
            </>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
