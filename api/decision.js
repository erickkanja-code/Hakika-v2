import { send, fail, method, body, clientKey, baseUrl, clean, isEmail } from '../lib/http.js';
import { db, findByToken, logEvent, rateLimit, claimStatus } from '../lib/db.js';
import { keysFor, claimFunds, stellarError, txUrl } from '../lib/stellar.js';
import { isPastDeadline } from '../lib/view.js';
import { sendEmail } from '../lib/email.js';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const b = body(req);
  const { payment, role } = await findByToken(String(b.t || ''));
  if (!payment) return fail(res, 404, 'This payment link is not valid.');
  if (role !== 'sender') return fail(res, 403, 'Only the sender can approve or reject proof.');
  if (payment.status !== 'proof_submitted') return fail(res, 409, 'There is no proof waiting for review.');
  if (!(await rateLimit(clientKey(req), 'decision', 20, 3600))) return fail(res, 429, 'Too many attempts. Try again later.');

  const { data: proof } = await db.from('proofs').select('*').eq('payment_id', payment.id).is('decision', null).order('submitted_at', { ascending: false }).limit(1).maybeSingle();
  if (!proof) return fail(res, 409, 'There is no proof waiting for review.');

  const recipientLink = `${baseUrl(req)}/app/pay.html?t=${payment.recipient_token}`;
  const recipientEmail = isEmail(payment.recipient_contact) ? payment.recipient_contact : null;

  if (b.action === 'reject') {
    const reason = clean(b.reason, 300);
    if (reason.length < 3) return fail(res, 400, 'Tell the recipient why, so they can fix it.');
    if (!(await claimStatus(payment.id, 'proof_submitted', 'locked'))) return fail(res, 409, 'This payment changed. Refresh the page.');
    await db.from('proofs').update({ decision: 'rejected', decision_reason: reason, decided_at: new Date().toISOString() }).eq('id', proof.id);
    await logEvent(payment.id, 'proof_rejected', reason);
    if (recipientEmail) {
      await sendEmail({ to: recipientEmail, subject: 'Your proof needs another look', title: 'The sender asked for different proof.', text: `Reason: ${reason}. You can upload new proof before the deadline.`, link: recipientLink, label: 'Upload again' });
    }
    return send(res, 200, { ok: true, status: 'locked' });
  }

  if (b.action !== 'approve') return fail(res, 400, 'Choose approve or reject.');
  if (isPastDeadline(payment)) return fail(res, 409, 'The deadline has passed, so the money can only be returned to you now.');
  if (!(await claimStatus(payment.id, 'proof_submitted', 'releasing'))) return fail(res, 409, 'This payment is already being released.');

  let hash;
  try {
    hash = await claimFunds({ keys: keysFor(payment.id, 'recipient'), balanceId: payment.claimable_balance_id });
  } catch (e) {
    const msg = stellarError(e);
    await db.from('payments').update({ status: 'proof_submitted' }).eq('id', payment.id);
    await logEvent(payment.id, 'release_failed', msg);
    return fail(res, 502, msg);
  }

  await db.from('payments').update({ status: 'released', release_tx_hash: hash }).eq('id', payment.id);
  await db.from('proofs').update({ decision: 'approved', decided_at: new Date().toISOString() }).eq('id', proof.id);
  await logEvent(payment.id, 'released', hash);
  if (recipientEmail) {
    await sendEmail({ to: recipientEmail, subject: 'Your money has been released', title: `KES ${Number(payment.amount_kes_display).toLocaleString()} was released to you.`, text: 'The sender approved your proof.', link: recipientLink, label: 'See details' });
  }
  send(res, 200, { ok: true, status: 'released', releaseTxHash: hash, releaseTxUrl: txUrl(hash) });
}
