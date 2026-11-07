import crypto from 'node:crypto';

export function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(body));
}

export function fail(res, status, message) {
  send(res, status, { error: message });
}

export function method(req, res, allowed) {
  if (req.method !== allowed) {
    res.setHeader('Allow', allowed);
    fail(res, 405, 'Method not allowed');
    return false;
  }
  return true;
}

export function body(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function clientKey(req) {
  const raw = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  return crypto.createHash('sha256').update(raw + (process.env.STELLAR_MASTER_SECRET || '')).digest('hex').slice(0, 32);
}

export function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  return `https://${req.headers.host}`;
}

export const clean = (v, max) => String(v ?? '').trim().slice(0, max);
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
export const isKenyanPhone = (v) => /^(\+?254|0)(7|1)\d{8}$/.test(v.replace(/[\s-]/g, ''));
