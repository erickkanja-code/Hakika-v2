import { Resend } from 'resend';

const wrap = (title, body, link, label) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0D0D0D">
  <p style="font-size:20px;font-weight:bold;margin:0 0 16px">HakikaSend</p>
  <p style="font-size:16px;font-weight:bold;margin:0 0 12px">${title}</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">${body}</p>
  <p><a href="${link}" style="background:#F0A500;color:#0D0D0D;padding:12px 22px;border-radius:100px;text-decoration:none;font-weight:bold">${label}</a></p>
  <p style="font-size:12px;color:#888580;line-height:1.6;margin-top:28px">This link is private to you. Do not forward it.<br>Stellar testnet. Test funds only, no real money moves.</p>
</div>`;

export async function sendEmail({ to, subject, title, text, link, label }) {
  if (!process.env.RESEND_API_KEY) return { skipped: 'RESEND_API_KEY not set' };
  if (!to) return { skipped: 'no address' };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'HakikaSend <onboarding@resend.dev>',
      to,
      subject,
      html: wrap(title, text, link, label)
    });
    if (error) return { error: error.message || 'email failed' };
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}
