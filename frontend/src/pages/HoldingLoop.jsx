import React from 'react';
import { useNavigate } from 'react-router-dom';

// Holding page for trainings: the loading-page look on a 60-second loop.
// The edge shine sweeps clockwise, alternating fast and slow laps (six
// fast/slow pairs = 12 laps per minute), and the icon stays solid white.
// Clicking the tile returns to the hub.
const CSS = `
@property --hold-a{syntax:'<angle>';initial-value:0deg;inherits:false}
.hold-stage{position:fixed;inset:0;z-index:400;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden}
.hold-stage .aurora{position:absolute;inset:0;z-index:0;opacity:1 !important}
.hold-stage .aurora .b1{width:130vw;height:110vh;left:-8%;top:-42%}
.hold-stage .aurora .b2{width:110vw;height:120vh;left:-38%;top:-18%}
.hold-stage .aurora .b6{width:120vw;height:115vh;left:22%;top:28%;
  background:radial-gradient(closest-side, #d45e1a 0%, #8a2f14 55%, transparent 76%);
  animation:aurora-d3 36s ease-in-out infinite alternate-reverse}
.hold-stage::after{content:'';position:absolute;inset:0;background:rgba(0,0,0,0.5);z-index:0;pointer-events:none}
.hold-tile{position:relative;z-index:1;width:114px;height:114px;border-radius:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;
  background:linear-gradient(150deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03) 55%), color-mix(in srgb, var(--bg2) 22%, transparent);
  backdrop-filter:blur(30px) saturate(1.25);-webkit-backdrop-filter:blur(30px) saturate(1.25);
  border:1px solid rgba(255,255,255,0.14);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.30), inset 1px 0 0 rgba(255,255,255,0.10), inset 0 12px 30px -16px rgba(255,255,255,0.24), 0 26px 70px rgba(0,0,0,0.55)}
.hold-tile img{width:62%;display:block}
.hold-tile::before{content:'';position:absolute;inset:-1px;border-radius:inherit;padding:2px;pointer-events:none;
  background:conic-gradient(from calc(315deg + var(--hold-a)),
    rgba(255,255,255,0.95), rgba(255,214,180,0.55) 12%, rgba(255,255,255,0.06) 26%, transparent 42%, transparent 100%);
  -webkit-mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);mask-composite:exclude;
  animation:holdSweep 60s linear infinite}
/* Six fast (2.5s) / slow (7.5s) lap pairs per minute — 12 clockwise laps */
@keyframes holdSweep{
  0%{--hold-a:0deg}
  4.1667%{--hold-a:360deg}
  16.6667%{--hold-a:720deg}
  20.8333%{--hold-a:1080deg}
  33.3333%{--hold-a:1440deg}
  37.5%{--hold-a:1800deg}
  50%{--hold-a:2160deg}
  54.1667%{--hold-a:2520deg}
  66.6667%{--hold-a:2880deg}
  70.8333%{--hold-a:3240deg}
  83.3333%{--hold-a:3600deg}
  87.5%{--hold-a:3960deg}
  100%{--hold-a:4320deg}}
@media (prefers-reduced-motion: reduce){.hold-tile::before{animation:none}}
`;

export default function HoldingLoop() {
  const nav = useNavigate();
  return (
    <div className="hold-stage">
      <style>{CSS}</style>
      <div className="aurora" aria-hidden>
        <div className="blob b1" /><div className="blob b2" /><div className="blob b6" />
      </div>
      <div className="hold-tile" onClick={() => nav('/')} role="button" title="Back to the hub"
        aria-label="Return to the home page">
        <img src="/splash-icon.png" alt="" />
      </div>
    </div>
  );
}
