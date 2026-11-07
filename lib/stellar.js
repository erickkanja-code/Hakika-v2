import * as StellarSdk from '@stellar/stellar-sdk';
import crypto from 'node:crypto';

const { Horizon, Keypair, TransactionBuilder, Operation, Asset, Claimant, Networks, BASE_FEE } = StellarSdk;

export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const FRIENDBOT_URL = 'https://friendbot.stellar.org';
export const EXPLORER = 'https://stellar.expert/explorer/testnet';
export const server = new Horizon.Server(HORIZON_URL);

export const txUrl = (hash) => (hash ? `${EXPLORER}/tx/${hash}` : null);
export const accountUrl = (pub) => (pub ? `${EXPLORER}/account/${pub}` : null);

// Every payment gets its own sender and recipient testnet wallet.
// Keys are derived from STELLAR_MASTER_SECRET, so no secret key is ever stored in the database.
export function keysFor(paymentId, role) {
  const master = process.env.STELLAR_MASTER_SECRET;
  if (!master || master.length < 32) throw new Error('STELLAR_MASTER_SECRET is missing or too short');
  const seed = crypto.createHmac('sha256', master).update(`hakikasend:${paymentId}:${role}`).digest();
  return Keypair.fromRawEd25519Seed(seed);
}

export function xlmFromKes(kes) {
  const rate = Number(process.env.DISPLAY_RATE_KES_PER_XLM || 40);
  return (kes / rate).toFixed(7);
}

export async function accountExists(publicKey) {
  try { await server.loadAccount(publicKey); return true; } catch { return false; }
}

// Funds a testnet account with Friendbot if it does not exist yet.
export async function ensureFunded(publicKey) {
  if (await accountExists(publicKey)) return;
  const r = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (r.ok) return;
  if (await accountExists(publicKey)) return;
  throw new Error('Friendbot could not fund a test wallet right now. Wait a minute and try again.');
}

async function submit(keypair, operation) {
  const account = await server.loadAccount(keypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 10),
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();
  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return { tx, hash: result.hash };
}

// Locks funds in a claimable balance with two claimants:
// the recipient can claim before the deadline, the sender can claim back from the deadline on.
export async function lockFunds({ senderKeys, recipientPublicKey, amount, deadline }) {
  const unix = String(Math.floor(new Date(deadline).getTime() / 1000));
  const beforeDeadline = Claimant.predicateBeforeAbsoluteTime(unix);
  const op = Operation.createClaimableBalance({
    asset: Asset.native(),
    amount,
    claimants: [
      new Claimant(recipientPublicKey, beforeDeadline),
      new Claimant(senderKeys.publicKey(), Claimant.predicateNot(beforeDeadline))
    ]
  });
  const { tx, hash } = await submit(senderKeys, op);
  return { hash, balanceId: tx.getClaimableBalanceId(0) };
}

export async function claimFunds({ keys, balanceId }) {
  const { hash } = await submit(keys, Operation.claimClaimableBalance({ balanceId }));
  return hash;
}

export function stellarError(e) {
  const codes = e?.response?.data?.extras?.result_codes;
  if (codes) {
    const ops = (codes.operations || []).join(', ');
    if (ops.includes('op_cannot_claim')) return 'The network says this balance cannot be claimed yet. If the deadline just passed, wait one minute and try again.';
    if (ops.includes('op_does_not_exist')) return 'This balance has already been claimed.';
    return `Stellar testnet rejected the transaction (${codes.transaction}${ops ? ': ' + ops : ''}).`;
  }
  return e?.message || 'Stellar testnet request failed';
}
