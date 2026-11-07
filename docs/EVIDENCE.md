# Evidence pack

Fill this in only with real links and hashes from your own runs.

| Deliverable | Evidence type | Evidence |
|---|---|---|
| 1. Sender creates a conditional payment that locks funds in a Stellar testnet escrow | Live URL + screenshots + tx hash | App: https://YOUR-DOMAIN/app/  Screenshots: create form, locked screen. Lock tx: |
| 2. Recipient uploads proof, sender is notified, reviews and releases, real testnet settlement | Live URL + screenshots + tx hash | Screenshots: recipient upload, sender review, released with simulated payout. Release tx: |
| 3. Full app on a public URL, verifiable on the Stellar testnet explorer | Live URL + explorer links | Lock: https://stellar.expert/explorer/testnet/tx/  Release: https://stellar.expert/explorer/testnet/tx/  Refund: https://stellar.expert/explorer/testnet/tx/ |

Supporting:
- Public GitHub repo:
- README states what is real and what is simulated: yes
- DEVLOG.md with dated entries: yes
- Walkthrough (written steps or short video):

## Walkthrough a reviewer can follow in two minutes
1. Open https://YOUR-DOMAIN/app/ and create a payment with your email, any recipient name, a Kenyan phone number, KES 1,000, any purpose and proof, deadline 7 days.
2. Click "View on explorer" on the locked screen. The claimable balance with two claimants is on stellar.expert.
3. Open the recipient link in a private window. Upload any photo.
4. Open the sender link. Approve. Click "View on explorer" next to Release.
5. For a refund, create another payment with the 10 minute deadline, wait, open the sender link and click "Take the money back".
