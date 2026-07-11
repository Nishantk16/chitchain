# ChitChain

> The world's first trustless group savings protocol (ROSCA) built on Stellar/Soroban.

## 🟡 Level 2 — Yellow Belt (Rise In)

This submission adds multi-wallet integration, real smart contract deployment, and live contract calls with full transaction status tracking on top of the White Belt (Level 1) foundation.

**What's new in Level 2:**
- ✅ Multi-wallet support via **StellarWalletsKit** (Freighter, xBull, Albedo, LOBSTR)
- ✅ Two Soroban smart contracts (`chit_chain` + `registry`) deployed to **Stellar Testnet**
- ✅ Real contract calls from the frontend — reading circle state (`get_circle_state`) and writing to the chain (`join_circle`)
- ✅ End-to-end transaction status tracking: building → simulating → signing → submitting → confirming → success/failed
- ✅ 3 distinct, user-facing error types: **wallet not found**, **user rejected**, and **contract call failed** (e.g. already a member, circle full, insufficient balance)

### 📸 Screenshots

**Wallet options (multi-wallet modal)**

![Multi-wallet options](docs/screenshots/multi-wallet-options.png)

**Landing page**

![Landing page](docs/screenshots/landing-page.png)

**Signing a real contract call (Freighter)**

![Freighter signing](docs/screenshots/freighter-signing.png)

**Contract call confirmed on-chain**

![Join circle success](docs/screenshots/join-circle-success.png)

**Circle state updated after the call (read back from the contract)**

![Circle state updated](docs/screenshots/circle-state-updated.png)

### 📜 Deployed Contracts (Testnet)

| Contract | Address |
|---|---|
| `chit_chain` | [`CCDX7VIOZOHJDDKN4QO2OE2IIF4GZOPATPMDHHEEHGVMPH6XXYNIZF54`](https://stellar.expert/explorer/testnet/contract/CCDX7VIOZOHJDDKN4QO2OE2IIF4GZOPATPMDHHEEHGVMPH6XXYNIZF54) |
| `registry` | [`CBMM3P7CPZYEUMPLSU6474I7SUHMA3M7P5OW3C7TKSDGYEAA6CJO2IM3`](https://stellar.expert/explorer/testnet/contract/CBMM3P7CPZYEUMPLSU6474I7SUHMA3M7P5OW3C7TKSDGYEAA6CJO2IM3) |

### 🔗 Verifiable Transaction Hashes

| Call | Hash |
|---|---|
| `join_circle` (via CLI) | [`bac97dc878363936e4e3ec704dfc260f602bd2774adcf056dd0a1d84f7abcca6`](https://stellar.expert/explorer/testnet/tx/bac97dc878363936e4e3ec704dfc260f602bd2774adcf056dd0a1d84f7abcca6) |
| `join_circle` (via frontend, Freighter) | [`4337839aff066e8d9da117b30cdcc6965a919fcd6a8e6ee3936b068a968fbe87`](https://stellar.expert/explorer/testnet/tx/4337839aff066e8d9da117b30cdcc6965a919fcd6a8e6ee3936b068a968fbe87) |

## Project Description

ChitChain is a decentralized group-savings (chit fund / ROSCA) application built on Stellar. It eliminates fraud and middlemen from traditional chit funds by putting circle membership, deposits, winner selection, and payouts entirely on-chain via two Soroban smart contracts:

- **`chit_chain`** — manages a single savings circle's lifecycle: joining, depositing, selecting a round winner, and executing payouts.
- **`registry`** — a lightweight on-chain directory that tracks every circle created and its current status, so circles can be discovered and monitored independently of the frontend.

## Live Demo

🌐 **[https://chit-chain.vercel.app](https://chit-chain.vercel.app)**

## Tech Stack

- Next.js 16 + TypeScript + Tailwind CSS
- `@stellar/stellar-sdk` (Soroban RPC, contract read/write)
- `@creit.tech/stellar-wallets-kit` (multi-wallet: Freighter, xBull, Albedo, LOBSTR)
- Soroban smart contracts in Rust (`soroban-sdk` 21.7.6)
- Vercel (frontend deployment) + Stellar Testnet (contracts)

## Setup Instructions

### Prerequisites
- Node.js 20+
- Rust 1.82+ and the `wasm32v1-none` target (`rustup target add wasm32v1-none`)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) 22+
- A Stellar wallet browser extension (Freighter, xBull, Albedo, or LOBSTR)

### Run the frontend locally

```bash
git clone https://github.com/Nishantk16/chitchain
cd chitchain/frontend
npm install --ignore-scripts
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_CHIT_CHAIN_CONTRACT=CCDX7VIOZOHJDDKN4QO2OE2IIF4GZOPATPMDHHEEHGVMPH6XXYNIZF54
NEXT_PUBLIC_REGISTRY_CONTRACT=CBMM3P7CPZYEUMPLSU6474I7SUHMA3M7P5OW3C7TKSDGYEAA6CJO2IM3
NEXT_PUBLIC_XLM_TOKEN_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
```

```bash
npm run dev
```

### Build & deploy the contracts yourself

```bash
cd contracts   # workspace root: chit_chain + registry
rustup target add wasm32v1-none
cargo build --target wasm32v1-none --release

stellar contract deploy \
  --wasm target/wasm32v1-none/release/registry.wasm \
  --source <your-identity> --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/chit_chain.wasm \
  --source <your-identity> --network testnet
```

> **Note on the WASM target:** Recent Rust toolchains (1.82+) emit post-MVP WASM features (`reference-types`) by default, which the current Soroban host does not yet support. Building for `wasm32v1-none` (instead of `wasm32-unknown-unknown`) produces MVP-compatible WASM and resolves the `HostError: Error(WasmVm, InvalidAction)` simulation failure you'd otherwise see on deploy.

## Level 1 Recap (White Belt)

- Connect/disconnect Freighter wallet
- Display XLM balance in real-time
- Send XLM transactions on Stellar testnet
- Transaction hash with Stellar Explorer link
- Success/failure feedback

---
_Deployed via Vercel + GitHub integration (Level 2)._
