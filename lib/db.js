import { createClient } from '@supabase/supabase-js';

export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export async function logEvent(paymentId, type, detail = null) {
  const { error } = await db.from('events').insert({ payment_id: paymentId, type, detail });
  if (error) console.error('event log failed', error.message);
}

// Simple per-visitor rate limit stored in Postgres. Returns true when the action is allowed.
export async function rateLimit(key, action, max, windowSeconds) {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await db
    .from('rate_hits')
    .select('id', { count: 'exact', head: true })
    .eq('client', key)
    .eq('action', action)
    .gte('created_at', since);
  if (error) { console.error('rate limit check failed', error.message); return true; }
  if ((count || 0) >= max) return false;
  await db.from('rate_hits').insert({ client: key, action });
  return true;
}

export async function findByToken(token) {
  if (!token || token.length < 40) return { payment: null, role: null };
  const { data: asSender } = await db.from('payments').select('*').eq('sender_token', token).maybeSingle();
  if (asSender) return { payment: asSender, role: 'sender' };
  const { data: asRecipient } = await db.from('payments').select('*').eq('recipient_token', token).maybeSingle();
  if (asRecipient) return { payment: asRecipient, role: 'recipient' };
  return { payment: null, role: null };
}

// Moves a payment to a new status only if it is still in one of the expected statuses.
// This stops a double click from sending two transactions.
export async function claimStatus(id, from, to) {
  const { data } = await db.from('payments').update({ status: to }).eq('id', id).in('status', [].concat(from)).select('id');
  return Array.isArray(data) && data.length === 1;
}
