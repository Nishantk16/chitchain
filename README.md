# ChitChain

> The world's first trustless group savings protocol built on Stellar/Soroban.

![ChitChain Landing] -- <img width="1877" height="903" alt="image" src="https://github.com/user-attachments/assets/997cac4c-d059-4415-b998-326b9710e0ff" />


## Project Description

ChitChain is a decentralized savings application built on Stellar testnet. It eliminates fraud and middlemen from traditional chit funds (ROSCA) by putting everything on-chain via Soroban smart contracts.

**Level 1 features:**
- Connect/disconnect Freighter wallet
- Display XLM balance in real-time
- Send XLM transactions on Stellar testnet
- Transaction hash with Stellar Explorer link
- Success/failure feedback

## Live Demo

🌐 **[https://chit-chain.vercel.app](https://chit-chain.vercel.app)**

## Tech Stack

- Next.js 15 + TypeScript
- Tailwind CSS
- Stellar SDK
- Freighter API (wallet)
- Vercel (deployment)

## Setup Instructions

### Prerequisites
- Node.js 20+
- [Freighter wallet](https://freighter.app) browser extension

### Run Locally

```bash
git clone https://github.com/Nishantk16/chitchain
cd chitchain/frontend
npm install --ignore-scripts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Screenshots

### Landing Page
![Landing](screenshots/landing.png)

### Wallet Connected + Balance
![Wallet Connected](screenshots/wallet-connected.png)

### Transaction Confirmed
![Transaction](screenshots/transaction.png)

### Transaction Result
![Transaction Result](screenshots/tx-result.png)

## Transaction Hash (Testnet)

`69cbabb8291e006e01fac062016b2bd7a19f048fd3cda6ec6729a2ebcf10b654`

[View on Stellar Explorer](https://stellar.expert/explorer/testnet/tx/69cbabb8291e006e01fac062016b2bd7a19f048fd3cda6ec6729a2ebcf10b654)

## GitHub Repository

[https://github.com/Nishantk16/chitchain](https://github.com/Nishantk16/chitchain)
