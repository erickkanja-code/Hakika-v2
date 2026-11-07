import { send, fail, method, baseUrl } from '../lib/http.js';
import { db, findByToken } from '../lib/db.js';
import { publicPayment } from '../lib/view.js';

export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  const { payment, role } = await findByToken(String(req.query.t || ''));
  if (!payment) return fail(res, 404, 'This payment link is not valid. Check that you copied the whole link.');

  const [{ data: events }, { data: proofs }] = await Promise.all([
    db.from('events').select('type, detail, created_at').eq('payment_id', payment.id).not('type', 'eq', 'email_failed').order('created_at', { ascending: true }),
    db.from('proofs').select('id, file_url, file_name, mime, note, submitted_at, decision, decision_reason, decided_at').eq('payment_id', payment.id).order('submitted_at', { ascending: false })
  ]);

  const withUrls = await Promise.all((proofs || []).map(async (p) => {
    const { data } = await db.storage.from('proofs').createSignedUrl(p.file_url, 3600);
    return { ...p, file_url: undefined, view_url: data?.signedUrl || null };
  }));

  const view = publicPayment(payment, role);
  if (role === 'sender') view.recipient_link = `${baseUrl(req)}/app/pay.html?t=${payment.recipient_token}`;
  send(res, 200, { payment: view, events: events || [], proofs: withUrls, serverTime: new Date().toISOString() });
}
