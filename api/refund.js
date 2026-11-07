import { send, fail, method, body, clientKey } from '../lib/http.js';
import { db, findByToken, logEvent, rateLimit, claimStatus } from '../lib/db.js';
import { keysFor, claimFunds, stellarError, txUrl } from '../lib/stellar.js';
import { isPastDeadline, OPEN } from '../lib/view.js';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const b = body(req);
  const { payment, role } = await findByToken(String(b.t || ''));
  if (!payment) return fail(res, 404, 'This payment link is not valid.');
  if (role !== 'sender') return fail(res, 403, 'Only the sender can take the money back.');
  if (!OPEN.includes(payment.status)) return fail(res, 409, 'This payment is not open, so there is nothing to return.');
  if (!isPastDeadline(payment)) return fail(res, 409, 'The money can only come back after the deadline.');
  if (!(await rateLimit(clientKey(req), 'refund', 20, 3600))) return fail(res, 429, 'Too many attempts. Try again later.');
  if (!(await claimStatus(payment.id, OPEN, 'refunding'))) return fail(res, 409, 'This payment is already being returned.');

  let hash;
  try {
    hash = await claimFunds({ keys: keysFor(payment.id, 'sender'), balanceId: payment.claimable_balance_id });
  } catch (e) {
    const msg = stellarError(e);
    await db.from('payments').update({ status: payment.status }).eq('id', payment.id);
    await logEvent(payment.id, 'refund_failed', msg);
    return fail(res, 502, msg);
  }

  await db.from('payments').update({ status: 'refunded', refund_tx_hash: hash }).eq('id', payment.id);
  await logEvent(payment.id, 'refunded', hash);
  send(res, 200, { ok: true, status: 'refunded', refundTxHash: hash, refundTxUrl: txUrl(hash) });
}
