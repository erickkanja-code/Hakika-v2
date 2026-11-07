import { txUrl, accountUrl } from './stellar.js';

export const OPEN = ['locked', 'proof_submitted'];

export function isPastDeadline(p) {
  return Date.now() >= new Date(p.deadline).getTime();
}

// What each side is allowed to see.
export function publicPayment(p, role) {
  const expired = OPEN.includes(p.status) && isPastDeadline(p);
  return {
    id: p.id,
    role,
    status: expired ? 'expired' : p.status,
    recipient_name: p.recipient_name,
    recipient_contact: role === 'sender' ? p.recipient_contact : undefined,
    amount: p.amount,
    asset: p.asset,
    amount_kes_display: p.amount_kes_display,
    purpose: p.purpose,
    proof_required: p.proof_required,
    deadline: p.deadline,
    created_at: p.created_at,
    chain: {
      claimable_balance_id: p.claimable_balance_id,
      sender_account: p.sender_public_key,
      sender_account_url: accountUrl(p.sender_public_key),
      recipient_account: p.recipient_public_key,
      recipient_account_url: accountUrl(p.recipient_public_key),
      lock_tx_hash: p.lock_tx_hash,
      lock_tx_url: txUrl(p.lock_tx_hash),
      release_tx_hash: p.release_tx_hash,
      release_tx_url: txUrl(p.release_tx_hash),
      refund_tx_hash: p.refund_tx_hash,
      refund_tx_url: txUrl(p.refund_tx_hash)
    }
  };
}
