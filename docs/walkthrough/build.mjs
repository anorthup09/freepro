// The What's New PDF is now the condensed tile index + screenshot appendix.
// This wrapper keeps the standing command (node docs/walkthrough/build.mjs)
// working: it runs the condensed builder with whats-new.pdf as the output.
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
process.argv[2] = process.argv[2] || path.join(dir, 'whats-new.pdf');
await import('./build-condensed.mjs');
