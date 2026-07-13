import React, { useEffect, useRef, useState } from 'react';

// Shared liquid-glass bottom dock: icon+label items with a sliding highlight
// bubble, collapsing labels to icons once the page scrolls (phones only).
// items: [{ key, label, icon, color }] — color tints the active item.
export default function GlassDock({ items, active, onSelect, align = 'center' }) {
  const btnRefs = useRef({});
  const [bubble, setBubble] = useState(null);
  const [shrunk, setShrunk] = useState(false);
  useEffect(() => {
    const measure = () => {
      const el = btnRefs.current[active];
      if (el) setBubble({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    };
    measure();
    const t = setTimeout(measure, 300);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [active, shrunk, items.length]);
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { setShrunk(window.innerWidth <= 700 && window.scrollY > 60); raf = null; });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="glass-dock no-print" style={{
      position:'fixed', bottom:'calc(env(safe-area-inset-bottom, 0px) + 14px)',
      ...(align === 'right' ? { right:14 } : { left:'50%', transform:'translateX(-50%)' }),
      zIndex:110, display:'flex', alignItems:'center', gap:2,
      padding: shrunk ? '6px 10px' : '8px 12px',
      background:'rgba(24,22,19,0.81)', backdropFilter:'blur(18px) saturate(1.5)', WebkitBackdropFilter:'blur(18px) saturate(1.5)',
      border:'1px solid rgba(255,255,255,0.12)', borderRadius:32,
      boxShadow:'0 10px 34px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
      transition:'padding .25s ease',
    }}>
      {bubble && (
        <div aria-hidden style={{
          position:'absolute', left:bubble.left, top:bubble.top, width:bubble.width, height:bubble.height,
          background:'rgba(255,255,255,0.10)', borderRadius:22, pointerEvents:'none',
          transition:'left .3s cubic-bezier(.34,1.3,.5,1), width .3s cubic-bezier(.34,1.3,.5,1), top .3s ease, height .3s ease',
        }} />
      )}
      {items.map(it => {
        const on = active === it.key;
        return (
          <button key={it.key} ref={el => { btnRefs.current[it.key] = el; }}
            onClick={() => { onSelect(it.key); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            aria-label={it.label}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:3, position:'relative',
              background:'transparent', border:'none', cursor:'pointer',
              color: on ? (it.color || 'var(--orange)') : 'rgba(255,255,255,0.55)',
              borderRadius:22, padding: shrunk ? '8px 12px' : '7px 12px 6px',
              transition:'color .25s ease',
            }}>
            {it.icon}
            <span style={{
              fontSize:9, fontWeight:800, letterSpacing:'0.02em', whiteSpace:'nowrap',
              maxHeight: shrunk ? 0 : 12, opacity: shrunk ? 0 : 1, overflow:'hidden',
              transition:'max-height .25s ease, opacity .2s ease',
            }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
