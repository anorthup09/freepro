import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { maybeMailNotice } from '../utils/mailNotice.js';

// Review-before-send pop-out for post-production contractor agreements
// (Contract Editor / Color / Audio). The contract is already generated;
// this previews the info@ email, lets everything be edited, and sends.
// Reuses the crew-contract email endpoints so signing works the same way.
const lbl = { fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' };

export default function ContractSendModal({ projectId, contract, total, onClose, onSent }) {
  const [f, setF] = useState(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/contract/${contract.id}`;

  useEffect(() => {
    api.contractEmailPrefill(projectId, contract.id)
      .then(p => setF({
        ...p,
        quotedTotal: p.quotedTotal || Number(total) || '',
        travelAllowance: '',     // post-production: no travel rows unless added
        perDiem: '',
        travelLocations: '',
        newVendor: false,
      }))
      .catch(e => { alert(e.message); onClose(); });
  }, [contract.id]);

  async function send() {
    if (!f || sending) return;
    setSending(true);
    try {
      const r = await api.emailContract(projectId, contract.id, {
        to: f.to, scope: f.scope, datesText: f.datesText, travelLocations: f.travelLocations,
        quotedTotal: f.quotedTotal, travelAllowance: f.travelAllowance, perDiem: f.perDiem,
        invoiceTo: f.invoiceTo, newVendor: f.newVendor,
      });
      onSent?.(r.to);
      onClose();
    } catch (e) {
      if (e.status === 501 || /not configured|not connected/i.test(e.message)) { maybeMailNotice('The contractor agreement email'); }
      else alert(e.message);
    }
    setSending(false);
  }

  const set = k => ev => setF(x => ({ ...x, [k]: ev.target.value }));
  const input = { width: '100%' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Send Contract — {contract.contractor_name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{contract.position_name} · {contract.project_code} — review everything below, then send from info@unbridledmedia.com</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {!f && <div className="empty">Loading…</div>}
        {f && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <div>
              <span style={lbl}>To</span>
              <input type="email" value={f.to} onChange={set('to')} style={input} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <span style={lbl}>Working Dates</span>
                <input value={f.datesText} onChange={set('datesText')} style={input} />
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <span style={lbl}>Quoted Total ($)</span>
                <input value={f.quotedTotal} onChange={set('quotedTotal')} style={input} />
              </div>
            </div>
            <div>
              <span style={lbl}>Scope of Work</span>
              <textarea value={f.scope || ''} style={{ minHeight: 80 }} onChange={set('scope')} />
            </div>
            <div>
              <span style={lbl}>Send your final invoice to</span>
              <input value={f.invoiceTo} onChange={set('invoiceTo')} style={input} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={f.newVendor} onChange={ev => setF(x => ({ ...x, newVendor: ev.target.checked }))} style={{ width: 'auto' }} />
              New vendor — mention that a vendor packet will follow
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <button className="btn btn-primary" disabled={sending || !f.to} onClick={send}>
                {sending ? 'Sending…' : 'Send Contract Email'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
              }}>{copied ? '✓ Link Copied' : 'Copy Signing Link'}</button>
              <a className="btn btn-ghost btn-sm" href={link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Preview ↗</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
