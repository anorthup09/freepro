import React, { useEffect, useRef } from 'react';

// Gradient "shine" border that tilts with device orientation (where the
// browser exposes it without a permission prompt) and drifts with scroll
// as a fallback, echoing Apple's specular edge effect.
const TONES = {
  silver: 'linear-gradient(var(--shine-angle), rgba(255,255,255,0.55), rgba(255,255,255,0.12) 35%, rgba(255,255,255,0.12) 65%, rgba(255,255,255,0.5))',
  orange: 'linear-gradient(var(--shine-angle), #F7B58C, #E8500A 25%, #7A2A05 50%, #E8500A 75%, #F7B58C)',
};

export default function ShineBorder({ children, radius = 10, width = 2, tone = 'silver', style = {} }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = null;
    const setAngle = (deg) => {
      if (raf) return;
      raf = requestAnimationFrame(() => { el.style.setProperty('--shine-angle', `${deg}deg`); raf = null; });
    };
    const onOrient = (e) => {
      if (e.gamma == null && e.beta == null) return;
      setAngle(115 + (e.gamma || 0) * 2 + (e.beta || 0));
    };
    const onScroll = () => setAngle(115 + (window.scrollY / 5) % 360);
    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} style={{
      '--shine-angle': '115deg',
      padding: width,
      borderRadius: radius,
      background: TONES[tone] || TONES.silver,
      ...style,
    }}>
      {children}
    </div>
  );
}
