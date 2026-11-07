import crypto from 'node:crypto';
import { send, fail, method, body, newToken, clientKey, baseUrl, clean, isEmail, isKenyanPhone } from '../lib/http.js';
import { db, logEvent, rateLimit } from '../lib/db.js';
import { keysFor, ensureFunded, lockFunds, xlmFromKes, stellarError, txUrl } from '../lib/stellar.js';
import { sendEmail } from '../lib/email.js';

const MIN_KES = 100;
const MAX_KES = 300000;

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const b = body(req);

  const sender_email = clean(b.sender_email, 160).toLowerCase();
  const recipient_name = clean(b.recipient_name, 80);
  const recipient_contact = clean(b.recipient_contact, 160);
  const purpose = clean(b.purpose, 140);
  const proof_required = clean(b.proof_required, 140);
  const amountKes = Math.round(Number(b.amount_kes));
  const deadline = new Date(b.deadline);

  if (!isEmail(sender_email)) return fail(res, 400, 'Enter a valid email address for yourself.');
  if (recipient_name.length < 2) return fail(res, 400, 'Enter the recipient’s name.');
  if (!isEmail(recipient_contact) && !isKenyanPhone(recipient_contact)) return fail(res, 400, 'Enter the recipient’s Kenyan phone number (07..., 01... or +254...) or email address.');
  if (!Number.isFinite(amountKes) || amountKes < MIN_KES || amountKes > MAX_KES) return fail(res, 400, `Enter an amount between KES ${MIN_KES.toLocaleString()} and KES ${MAX_KES.toLocaleString()}.`);
  if (purpose.length < 3) return fail(res, 400, 'Say what the money is for.');
  if (proof_required.length < 3) return fail(res, 400, 'Say what proof you need to see.');
  const ms = deadline.getTime() - Date.now();
  if (!Number.isFinite(ms) || ms < 4 * 60 * 1000) return fail(res, 400, 'Pick a deadline at least 5 minutes from now.');
  if (ms > 90 * 24 * 3600 * 1000) return fail(res, 400, 'Pick a deadline within 90 days.');

  if (!(await rateLimit(clientKey(req), 'create', 8, 3600))) return fail(res, 429, 'Too many payments from this device in the last hour. Try again later.');

  const id = crypto.randomUUID();
  const senderKeys = keysFor(id, 'sender');
  const recipientKeys = keysFor(id, 'recipient');
  const amount = xlmFromKes(amountKes);
  const sender_token = newToken();
  const recipient_token = newToken();

  const { error: insertError } = await db.from('payments').insert({
    id, sender_email, recipient_name, recipient_contact,
    amount, asset: 'XLM', amount_kes_display: amountKes,
    purpose, proof_required, deadline: deadline.toISOString(),
    status: 'pending',
    sender_public_key: senderKeys.publicKey(),
    recipient_public_key: recipientKeys.publicKey(),
    sender_token, recipient_token
  });
  if (insertError) return fail(res, 500, 'Could not save the payment. ' + insertError.message);
  await logEvent(id, 'created', `KES ${amountKes.toLocaleString()} for ${purpose}`);

  let lock;
  try {
    await Promise.all([ensureFunded(senderKeys.publicKey()), ensureFunded(recipientKeys.publicKey())]);
    lock = await lockFunds({ senderKeys, recipientPublicKey: recipientKeys.publicKey(), amount, deadline });
  } catch (e) {
    const msg = stellarError(e);
    await db.from('payments').update({ status: 'failed' }).eq('id', id);
    await logEvent(id, 'lock_failed', msg);
    return fail(res, 502, msg);
  }

  await db.from('payments').update({ status: 'locked', lock_tx_hash: lock.hash, claimable_balance_id: lock.balanceId }).eq('id', id);
  await logEvent(id, 'locked', lock.hash);

  const site = baseUrl(req);
  const senderLink = `${site}/app/pay.html?t=${sender_token}`;
  const recipientLink = `${site}/app/pay.html?t=${recipient_token}`;

  const senderMail = await sendEmail({
    to: sender_email,
    subject: `Your HakikaSend payment for ${recipient_name} is locked`,
    title: `KES ${amountKes.toLocaleString()} is locked for ${recipient_name}.`,
    text: `Purpose: ${purpose}. Proof needed: ${proof_required}. We will email you when proof arrives. Use this link to review and release.`,
    link: senderLink,
    label: 'Open your payment'
  });
  if (senderMail.error) await logEvent(id, 'email_failed', 'sender: ' + senderMail.error);

  let recipientMail = { skipped: 'phone number given' };
  if (isEmail(recipient_contact)) {
    recipientMail = await sendEmail({
      to: recipient_contact,
      subject: `Money is waiting for you on HakikaSend`,
      title: `KES ${amountKes.toLocaleString()} is set aside for you.`,
      text: `It is for: ${purpose}. To receive it, upload this proof: ${proof_required}.`,
      link: recipientLink,
      label: 'Upload proof'
    });
    if (recipientMail.error) await logEvent(id, 'email_failed', 'recipient: ' + recipientMail.error);
  }

  send(res, 200, {
    id,
    senderLink,
    recipientLink,
    recipientName: recipient_name,
    recipientIsPhone: !isEmail(recipient_contact),
    amount,
    amountKes,
    lockTxHash: lock.hash,
    lockTxUrl: txUrl(lock.hash),
    balanceId: lock.balanceId,
    emails: { sender: senderMail, recipient: recipientMail }
  });
}
