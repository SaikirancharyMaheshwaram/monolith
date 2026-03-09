# Strivioz Monolith

Strivioz is a mobile-first Solana habit-dueling app. This repository is split into:

- `frontend/`: Expo + Expo Router mobile client, local app state, wallet integration, and Convex schema/client code.
- `backend/`: Solana smart contract workspace built with Anchor for duel creation, joining, settlement, cancellation, and vault redemption.

## Repository Layout

```text
.
├── backend/
│   ├── programs/d-arena/
│   ├── tests/
│   └── Anchor.toml
└── frontend/
    ├── app/
    ├── components/
    ├── convex/
    ├── lib/
    └── stores/
```

## Product Overview

Players create stake-backed duels, check in daily, and settle the outcome on-chain.

- Two players lock stake into a duel.
- Daily streak progress is tracked off-chain in Convex.
- Settlement is executed on Solana through the Anchor program.
- Redemption vault rules handle recovery flows for losing outcomes.

The current product surface includes:

- wallet connect and profile creation
- duel creation and joining
- invite links for friend duels
- daily check-ins
- on-chain settlement
- redemption vault views

## Tech Stack

### Frontend

- Expo 54
- React Native 0.81
- Expo Router
- Zustand
- Convex
- Solana Web3.js
- Solana Mobile Wallet Adapter

### Backend

- Rust
- Anchor
- Solana program test workflow with TypeScript + Mocha

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run start
```

Other frontend commands:

```bash
npm run android
npm run ios
npm run web
npm run lint
```

### Backend

```bash
cd backend
yarn install
anchor test
```

Common backend commands:

```bash
yarn lint
yarn lint:fix
anchor build
anchor test
```

## Notes

- The frontend Convex schema lives in `frontend/convex/schema.ts`.
- The Anchor program id is configured in `backend/programs/d-arena/src/lib.rs` and `backend/Anchor.toml`.
- Backend tests expect local key files such as `server.json` and `creator.json` in `backend/` before `anchor test` can run successfully.

## Read More

- Frontend setup and app structure: [`frontend/README.md`](/Users/sai/Documents/LifeOs/Projects/100xbootcamp/react%20native/monolith/frontend/README.md)
- Backend setup and contract workflow: [`backend/README.md`](/Users/sai/Documents/LifeOs/Projects/100xbootcamp/react%20native/monolith/backend/README.md)
