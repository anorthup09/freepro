// Email-automation notices while Outlook isn't connected yet.
// Call maybeMailNotice('<what would have been emailed>') after an action that
// triggers an email: if mail isn't configured it pops the under-construction
// notice (and returns true). Status is fetched once and cached per session.
import { api } from '../api.js';

let configured = null;
export async function mailReady() {
  if (configured === null) {
    try { configured = (await api.mailStatus()).configured === true; }
    catch { configured = false; }
  }
  return configured;
}

export async function maybeMailNotice(action) {
  if (await mailReady()) return false;
  window.dispatchEvent(new CustomEvent('mail-under-construction', { detail: { action } }));
  return true;
}
