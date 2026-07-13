// Gold confetti + tiny dollar signs raining from the top of the screen.
// Framework-free: appends a fixed overlay to <body>, animates with the Web
// Animations API, and cleans itself up when the show is over.
export function moneyConfetti(duration = 8000) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  const GOLD = ['#f7b52d', '#e6c229', '#ffd700', '#f2a33c', '#fff3b0', '#d4af37'];
  const secs = duration / 1000;
  const N = 150;
  for (let i = 0; i < N; i++) {
    const money = Math.random() < 0.2;
    const el = document.createElement('div');
    const size = money ? 13 + Math.random() * 9 : 6 + Math.random() * 8;
    const fall = 3.5 + Math.random() * 3.5;                       // fall time (s)
    const delay = Math.random() * Math.max(0.1, secs - fall - 0.3); // stagger within the window
    const sway = Math.random() * 120 - 60;
    const spin = Math.random() * 720 - 360;
    el.style.cssText = `position:absolute;top:-32px;left:${Math.random() * 100}%;will-change:transform,opacity;opacity:0;`;
    if (money) {
      el.textContent = '💲';
      el.style.fontSize = size + 'px';
    } else {
      el.style.width = size + 'px';
      el.style.height = size * (0.4 + Math.random() * 0.35) + 'px';
      el.style.background = GOLD[i % GOLD.length];
      el.style.borderRadius = Math.random() < 0.3 ? '50%' : '2px';
      el.style.boxShadow = '0 0 6px rgba(247,181,45,0.45)';
    }
    el.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 0 },
      { opacity: 1, offset: 0.05 },
      { transform: `translate(${sway}px, 50vh) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${-sway * 0.6}px, 108vh) rotate(${spin}deg)`, opacity: 0.85 },
    ], { duration: fall * 1000, delay: delay * 1000, easing: 'cubic-bezier(.25,.4,.6,1)', fill: 'forwards' });
    wrap.appendChild(el);
  }
  document.body.appendChild(wrap);
  setTimeout(() => {
    wrap.style.transition = 'opacity .6s';
    wrap.style.opacity = '0';
    setTimeout(() => wrap.remove(), 700);
  }, duration);
}
