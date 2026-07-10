// Minimal service worker: network-first passthrough. Exists so the platform is
// installable as a PWA; it deliberately does no caching — every load is live,
// matching the push-to-deploy workflow.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
