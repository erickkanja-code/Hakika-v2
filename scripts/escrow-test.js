// Standalone Stellar testnet escrow test. No database, no website needed.
// Run:  npm run escrow-test
// It creates fresh testnet wallets, then proves the three on-chain paths:
//   1. LOCK    a claimable balance (recipient before deadline, sender after deadline)
//   2. RELEASE the recipient claims it before the deadline
//   3. REFUND  a second balance is claimed back by the sender after its deadline
// Every hash printed here is a real testnet transaction you can open on stellar.expert.

import { Keypair } from '@stellar/stellar-sdk';
import { ensureFunded, lockFunds, claimFunds, txUrl, accountUrl, stellarError } from '../lib/stellar.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const sender = Keypair.random();
  const recipient = Keypair.random();
  console.log('\nFunding two new testnet wallets with Friendbot...');
  await Promise.all([ensureFunded(sender.publicKey()), ensureFunded(recipient.publicKey())]);
  console.log('Sender    ', accountUrl(sender.publicKey()));
  console.log('Recipient ', accountUrl(recipient.publicKey()));

  console.log('\n1. LOCK (release test), deadline in 10 minutes');
  const a = await lockFunds({ senderKeys: sender, recipientPublicKey: recipient.publicKey(), amount: '25.0000000', deadline: new Date(Date.now() + 10 * 60 * 1000) });
  console.log('   lock hash   ', a.hash, '\n  ', txUrl(a.hash));

  console.log('\n2. RELEASE, recipient claims before the deadline');
  const releaseHash = await claimFunds({ keys: recipient, balanceId: a.balanceId });
  console.log('   release hash', releaseHash, '\n  ', txUrl(releaseHash));

  console.log('\n3. LOCK (refund test), deadline in 60 seconds');
  const b = await lockFunds({ senderKeys: sender, recipientPublicKey: recipient.publicKey(), amount: '10.0000000', deadline: new Date(Date.now() + 60 * 1000) });
  console.log('   lock hash   ', b.hash, '\n  ', txUrl(b.hash));

  console.log('   Checking the sender cannot take it back early...');
  try { await claimFunds({ keys: sender, balanceId: b.balanceId }); console.log('   UNEXPECTED: early refund worked'); }
  catch (e) { console.log('   Correct, refused by the network:', stellarError(e)); }

  console.log('   Waiting 75 seconds for the deadline to pass on the ledger...');
  await wait(75 * 1000);
  const refundHash = await claimFunds({ keys: sender, balanceId: b.balanceId });
  console.log('   refund hash ', refundHash, '\n  ', txUrl(refundHash));

  console.log('\nDone. Copy these links into DEVLOG.md and docs/EVIDENCE.md.\n');
}

main().catch((e) => { console.error('\nFailed:', stellarError(e)); process.exit(1); });
