import crypto from 'node:crypto';
import { send, fail, method, body, clientKey, baseUrl, clean } from '../lib/http.js';
import { db, findByToken, logEvent, rateLimit } from '../lib/db.js';
import { isPastDeadline } from '../lib/view.js';
import { sendEmail } from '../lib/email.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const MAX_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const b = body(req);
  const { payment, role } = await findByToken(String(b.t || ''));
  if (!payment) return fail(res, 404, 'This payment link is not valid.');
  if (role !== 'recipient') return fail(res, 403, 'Only the recipient can upload proof.');
  if (payment.status !== 'locked') return fail(res, 409, payment.status === 'proof_submitted' ? 'Proof is already waiting for review.' : 'This payment is no longer open for proof.');
  if (isPastDeadline(payment)) return fail(res, 409, 'The deadline has passed, so proof can no longer be uploaded.');

  const ext = TYPES[b.mime];
  if (!ext) return fail(res, 400, 'Upload a photo (JPG, PNG, WEBP) or a PDF.');
  const bytes = Buffer.from(String(b.data || ''), 'base64');
  if (bytes.length < 200) return fail(res, 400, 'The file looks empty. Choose it again.');
  if (bytes.length > MAX_BYTES) return fail(res, 400, 'The file is larger than 3 MB. Take a smaller photo or compress the PDF.');
  const pdfOk = ext !== 'pdf' || bytes.subarray(0, 4).toString() === '%PDF';
  if (!pdfOk) return fail(res, 400, 'That file is not a valid PDF.');

  if (!(await rateLimit(clientKey(req), 'upload', 12, 3600))) return fail(res, 429, 'Too many uploads in the last hour. Try again later.');

  const proofId = crypto.randomUUID();
  const path = `${payment.id}/${proofId}.${ext}`;
  const { error: upErr } = await db.storage.from('proofs').upload(path, bytes, { contentType: b.mime, upsert: false });
  if (upErr) return fail(res, 500, 'Upload failed. ' + upErr.message);

  const note = clean(b.note, 500);
  await db.from('proofs').insert({ id: proofId, payment_id: payment.id, file_url: path, file_name: clean(b.fileName, 120), mime: b.mime, note });
  const moved = await db.from('payments').update({ status: 'proof_submitted' }).eq('id', payment.id).eq('status', 'locked').select('id');
  if (!moved.data?.length) return fail(res, 409, 'This payment changed while you were uploading. Refresh the page.');
  await logEvent(payment.id, 'proof_submitted', note || null);

  const mail = await sendEmail({
    to: payment.sender_email,
    subject: `${payment.recipient_name} uploaded proof. Review it now`,
    title: `${payment.recipient_name} uploaded proof for ${payment.purpose}.`,
    text: `Have a look and decide. If it is right, release the KES ${Number(payment.amount_kes_display).toLocaleString()}. If not, reject it with a reason and they can upload again before the deadline.`,
    link: `${baseUrl(req)}/app/pay.html?t=${payment.sender_token}`,
    label: 'Review proof'
  });
  if (mail.error) await logEvent(payment.id, 'email_failed', 'sender review: ' + mail.error);

  send(res, 200, { ok: true });
}
