# HakikaSend

Send money home to Kenya for a purpose. It is locked on Stellar until the recipient uploads proof and the sender releases it. If the deadline passes first, the sender takes it back.

This repository is the marketing site and the working app, deployed together on one domain.

## What is real and what is simulated

| Part | Status |
|---|---|
| Lock of funds in a Stellar claimable balance | **Real**, Stellar testnet, real transaction hash |
| Release to the recipient after the sender approves | **Real**, Stellar testnet |
| Return to the sender after the deadline | **Real**, Stellar testnet, enforced by the claimable balance predicate |
| Proof upload and private storage | **Real**, Supabase Storage (private bucket, signed URLs) |
| Email to the sender when proof arrives | **Real**, Resend |
| Launch updates signup | **Real**, stored in Supabase |
| Payout to M-Pesa | **Simulated**. A clearly labelled screen after release. No money reaches any phone |
| KES amounts | Illustrative display rate (env `DISPLAY_RATE_KES_PER_XLM`, default 40) |

Every app screen carries a TESTNET banner.

### Honest notes on the escrow design

- Each payment gets its own sender and recipient testnet wallet. Keys are derived on the server from `STELLAR_MASTER_SECRET` and are never stored or sent to the browser. Neither user handles keys. This is acceptable for a testnet demo, not for real money.
- The lock is a claimable balance with two claimants: the recipient with `before(deadline)` and the sender with `not(before(deadline))`.
- **The refund after the deadline is enforced on-chain.** The recipient cannot claim after the deadline, and the sender cannot claim before it.
- **The release is gated by the app.** Because the server holds the testnet keys, the app submits the recipient's claim only after the sender approves. A later version can move approval on-chain with multisig or a Soroban contract.
- There is no early cancel. Once locked, funds stay until release or the deadline.

## Structure

```
index.html, how-it-works.html, faq.html, early-access.html   marketing site (Kenya only)
assets/        site.css, mark.svg
app/           index.html (create payment), pay.html (sender and recipient view), app.css, app.js
api/           Vercel serverless functions
  payments.js    POST create payment and lock funds
  payment.js     GET payment by private link token
  proof.js       POST recipient uploads proof
  decision.js    POST sender approves (release) or rejects
  refund.js      POST sender takes funds back after the deadline
  signup.js      POST launch updates signup
lib/           shared server code (stellar.js, db.js, email.js, http.js, view.js)
scripts/       escrow-test.js, standalone testnet lock, release and refund
supabase/      schema.sql
docs/          EVIDENCE.md
```

Stack: plain HTML, CSS and JS (matches the existing site, no build step), Vercel Node functions, Supabase Postgres and Storage, `@stellar/stellar-sdk` 16.3.1 against `https://horizon-testnet.stellar.org`, Friendbot for test funds, Resend for email.

## Setup

See the step by step guide in the chat handoff, or in short:

1. `npm install`
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Set the environment variables from `.env.example` in Vercel.
4. Push to GitHub. Vercel deploys.
5. `npm run escrow-test` prints a real lock, release and refund on testnet.

## Security basics in place

- Uploads limited to JPG, PNG, WEBP and PDF, 3 MB, checked on the server. Private bucket, one-hour signed URLs.
- Rate limits on create, upload, decision, refund and signup.
- Private links use 256-bit random tokens.
- Every state change is written to the `events` table and shown as a timeline.
- Status changes use compare-and-set updates, so a double click cannot send two transactions.
- Row level security is on for every table. Only the server's service role key can read or write.
