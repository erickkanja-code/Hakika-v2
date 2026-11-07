import { send, fail, method, body, clientKey, clean, isEmail } from '../lib/http.js';
import { db, rateLimit } from '../lib/db.js';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const b = body(req);
  const row = {
    first_name: clean(b.first_name, 60),
    last_name: clean(b.last_name, 60),
    email: clean(b.email, 160).toLowerCase(),
    based_in: clean(b.based_in, 60) || null,
    family_area: clean(b.family_area, 80) || null,
    frequency: clean(b.frequency, 40),
    purpose: clean(b.purpose, 40),
    story: clean(b.story, 2000) || null
  };
  if (!row.first_name || !row.last_name) return fail(res, 400, 'Enter your first and last name.');
  if (!isEmail(row.email)) return fail(res, 400, 'Enter a valid email address.');
  if (!row.frequency || !row.purpose) return fail(res, 400, 'Answer how often you send and what for.');
  if (!(await rateLimit(clientKey(req), 'signup', 5, 3600))) return fail(res, 429, 'Too many signups from this device. Try again later.');

  const { error } = await db.from('signups').upsert(row, { onConflict: 'email' });
  if (error) return fail(res, 500, 'Could not save your details. ' + error.message);
  send(res, 200, { ok: true });
}
