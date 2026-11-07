# DEVLOG

Honest running log. Only record what actually happened, with real dates and real hashes.

## 2026-11-07
- Code written for the full SOW scope with AI assistance: sender create and lock flow, recipient proof upload, sender review with approve and reject, release, refund after the deadline, simulated M-Pesa payout screen, launch updates signup, Kenya-only marketing site connected to the app.
- Escrow design: Stellar claimable balance, recipient `before(deadline)`, sender `not(before(deadline))`. SDK calls checked against `@stellar/stellar-sdk` 16.3.1.
- Not yet deployed. Not yet run against testnet.

## 2026-11-07
- Ran `npm run escrow-test` against Stellar testnet. All three paths worked.
- Sender test wallet: https://stellar.expert/explorer/testnet/account/GDKI2DQMNRLELQZNSJLPZ6Y5QGYVBW25II22FKPCBFU2Z54HWZ6YUD3W
- Recipient test wallet: https://stellar.expert/explorer/testnet/account/GCUSVJR5QJ7GEO43AVSKDGUDQYX2UL3YFQAQSM4YZKOOYOT6KB6KXUNO
- Lock (release test): https://stellar.expert/explorer/testnet/tx/1085823189df2b75a47fe8cf83fd91ba1c4f67ae5a218b677116dfcb616cf564
- Release by recipient before deadline: https://stellar.expert/explorer/testnet/tx/f81b7e75356580e1b5c29524cd1df558a770db0f6f52273bd44be828c7ca8361
- Lock (refund test, 60 second deadline): https://stellar.expert/explorer/testnet/tx/40524cfdc578004625b9b7f328db00a9832835516ace54ccb2cc861916639890
- Early refund attempt by sender before deadline: refused by the network (op_cannot_claim), as designed.
- Refund by sender after deadline: https://stellar.expert/explorer/testnet/tx/43e037ec1fa297ef9c0fca3fb8ead66841976e369670e96420f500a562c7e42c

## YYYY-MM-DD
- Deployed to the public URL:
- First end-to-end payment in the app. Lock hash:  Release hash:
- First refund in the app. Refund hash:
- Issues found and fixed:
