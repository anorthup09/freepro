import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Running local-time timecode: HH.MM.SS.xx AM/PM in slate red on black
function TimecodeBar({ big }) {
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
    <div style={{ background: '#000', padding: 'min(10px, 1.4vh) 52px min(10px, 1.4vh) 12px', textAlign: 'right', position: 'relative' }}>
      <img src="/unbridled-logo.png" alt="Unbridled Media"
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', height: big ? 'min(46px, 7vh)' : 'min(30px, 5vh)', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
      <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: big ? 'min(96px, 8vw, 12vh)' : 'min(56px, 7vw, 11vh)', letterSpacing: '0.06em', color: '#ff2222', textShadow: '0 0 12px rgba(255,34,34,0.6)', fontVariantNumeric: 'tabular-nums' }}>
        {h}.{m}.{sec}.{cs} <span style={{ fontSize: '0.55em' }}>{ampm}</span>
      </span>
    </div>
  );
}

const label = { fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 'min(24px, 2.6vw + 6px, 5vh)', letterSpacing: '0.04em', color: '#111', textTransform: 'uppercase', fontStyle: 'italic' };
const value = { fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 'min(28px, 3vw + 7px, 6vh)', color: '#111', minWidth: 0, overflowWrap: 'anywhere' };

function Row({ name, children, lbl, val }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: '2px solid #111', padding: 'min(8px, 1.1vh) 2px min(5px, 0.7vh)' }}>
      <span style={lbl || label}>{name}:</span>
      <span style={val || value}>{children}</span>
    </div>
  );
}

// Pop-out clapboard slate for filming events. Crew names come from the
// project's Field Producer / Director / Camera Operator assignments.
export default function Clapboard({ title, date, location, fieldProducer, director, camera, onClose, editableTitle }) {
  const [take, setTake] = useState(1);
  const [titleVal, setTitleVal] = useState(title || '');
  const takeDrag = useRef(null);
  const [landscape, setLandscape] = useState(() => typeof window !== 'undefined' && window.innerWidth > window.innerHeight);
  const WIPE_MS = 280;
  const [wiping, setWiping] = useState(false);

  // Synthesized clap: white-noise burst through a bandpass, no audio file needed
  function playClap() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const dur = 0.14;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1700; filt.Q.value = 0.7;
      const gain = ctx.createGain(); gain.gain.value = 2.2;
      src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      src.start();
      src.onended = () => ctx.close().catch(() => {});
    } catch { /* audio blocked — wipe still plays */ }
  }

  function slap() {
    if (wiping) return;
    setWiping(true);
    setTimeout(playClap, WIPE_MS); // sound lands as the panels meet
    setTimeout(() => setWiping(false), WIPE_MS + 420);
  }
  useEffect(() => {
    const onResize = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Landscape (phone/tablet on set) gets much larger type
  const lbl = landscape ? { ...label, fontSize: 'min(44px, 3.4vw, 6vh)' } : label;
  const val = landscape ? { ...value, fontSize: 'min(54px, 4.2vw, 7.5vh)' } : value;
  const titleSize = landscape ? 'min(64px, 5vw, 8.5vh)' : 'min(34px, 3.6vw + 8px, 7vh)';
  const takeSize = landscape ? 'min(80px, 6vw, 10vh)' : 'min(48px, 5vw + 12px, 8vh)';

  return createPortal(
    <div className="modal-bg" onClick={onClose} style={{ zIndex: 300 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100vw', height: '100dvh', overflowY: 'auto', overflowX: 'hidden', background: '#fdfdfb', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <TimecodeBar big={landscape} />
        <button onClick={onClose} aria-label="Close"
          style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>✕</button>

        <div style={{ padding: 'min(10px, 1.4vh) 18px min(12px, 1.6vh)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
          <Row name="Prod" lbl={lbl} val={val}>{fieldProducer || '—'}</Row>

          {/* Title | Take grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(150px, 24%)', borderBottom: '2px solid #111' }}>
            <div style={{ padding: 'min(10px, 1.4vh) 2px min(8px, 1.1vh)', borderRight: '2px solid #111' }}>
              <div style={{ ...lbl, marginBottom: 4 }}>Title</div>
              {editableTitle ? (
                <input value={titleVal} onChange={e => setTitleVal(e.target.value)} placeholder="Title…" autoFocus
                  style={{ ...val, fontSize: titleSize, width: '100%', background: 'transparent', border: 'none', borderBottom: '1px dashed #999', outline: 'none', padding: 0 }} />
              ) : (
                <div style={{ ...val, fontSize: titleSize }}>{title || '—'}</div>
              )}
            </div>
            <div style={{ padding: 'min(10px, 1.4vh) 8px min(8px, 1.1vh)', textAlign: 'center' }}>
              <div style={{ ...lbl, marginBottom: 4 }}>Take</div>
              <div
                onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); takeDrag.current = { x: e.clientX, base: take }; }}
                onPointerMove={e => { if (!takeDrag.current) return; setTake(Math.max(1, takeDrag.current.base + Math.round((e.clientX - takeDrag.current.x) / 48))); }}
                onPointerUp={() => { takeDrag.current = null; }}
                onPointerCancel={() => { takeDrag.current = null; }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, touchAction: 'none', cursor: 'ew-resize', userSelect: 'none' }}>
                <span style={{ color: '#999', fontSize: 'min(22px, 3.5vh)', lineHeight: 1 }}>‹</span>
                <span style={{ ...val, fontSize: takeSize, fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'center' }}>{take}</span>
                <span style={{ color: '#999', fontSize: 'min(22px, 3.5vh)', lineHeight: 1 }}>›</span>
              </div>
            </div>
          </div>

          {landscape ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #111' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: 'min(8px, 1.1vh) 2px min(5px, 0.7vh)', borderRight: '2px solid #111' }}>
                  <span style={lbl}>Director:</span><span style={val}>{director || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: 'min(8px, 1.1vh) 10px min(5px, 0.7vh)' }}>
                  <span style={lbl}>Camera:</span><span style={val}>{camera || '—'}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #111' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: 'min(8px, 1.1vh) 2px min(5px, 0.7vh)', borderRight: '2px solid #111' }}>
                  <span style={lbl}>Date:</span><span style={val}>{date || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: 'min(8px, 1.1vh) 10px min(5px, 0.7vh)' }}>
                  <span style={lbl}>Loc:</span><span style={val}>{location || '—'}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <Row name="Director" lbl={lbl} val={val}>{director || '—'}</Row>
              <Row name="Camera" lbl={lbl} val={val}>{camera || '—'}</Row>
              <Row name="Date" lbl={lbl} val={val}>{date || '—'}</Row>
              {location && <Row name="Loc" lbl={lbl} val={val}>{location}</Row>}
            </>
          )}

        </div>

        {/* Slapstick */}
        <button onClick={slap} aria-label="Slap the sticks"
          style={{ position: 'absolute', bottom: 14, right: 14, zIndex: 5, background: '#E8500A', color: '#fff', border: 'none', borderRadius: 100, padding: '10px 18px', fontSize: 'min(16px, 3vh)', fontWeight: 800, cursor: 'pointer', letterSpacing: '.06em', boxShadow: '0 4px 16px rgba(0,0,0,0.35)', fontFamily: "'DM Sans', sans-serif" }}>
          🎬 MARK
        </button>

        {/* Top/bottom wipe panels — meet in the middle on the clap */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '50.5%', background: '#E8500A', zIndex: 10, pointerEvents: 'none', transform: wiping ? 'translateY(0)' : 'translateY(-101%)', transition: `transform ${WIPE_MS}ms ${wiping ? 'cubic-bezier(0.5, 0, 0.9, 0.4)' : 'ease-in-out'}` }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '50.5%', background: '#E8500A', zIndex: 10, pointerEvents: 'none', transform: wiping ? 'translateY(0)' : 'translateY(101%)', transition: `transform ${WIPE_MS}ms ${wiping ? 'cubic-bezier(0.5, 0, 0.9, 0.4)' : 'ease-in-out'}` }} />
      </div>
    </div>,
    document.body
  );
}
