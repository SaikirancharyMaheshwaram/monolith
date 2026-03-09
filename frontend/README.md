# Strivioz Frontend

Strivioz is a mobile-first Solana habit-dueling app built with Expo, Expo Router, Convex, and Solana Web3.js. Players create stake-backed duels, check in daily, and resolve outcomes through escrow and redemption-vault rules.

This package contains the Expo client, local app state, wallet integration, and the Convex schema used by the app.

## What The App Does

Strivioz turns habit accountability into an on-chain duel:

- Two players lock stake into a duel.
- Players check in daily during the duel window.
- Progress is tracked off-chain and settlement happens on-chain.
- Losing outcomes can feed a redemption-vault recovery loop.

## Product Surface

### Core user flows

- wallet connect and profile creation
- public or friend duel creation
- invite link sharing and contract-style invite review
- daily duel check-ins
- on-chain duel settlement
- redemption vault tracking

### Primary screens

- `app/(tabs)/index.tsx`: home lobby, stats, and primary CTAs
- `app/(tabs)/duel.tsx`: duel board, create flow, join flow, share and cancel actions
- `app/(tabs)/duel/[duelId].tsx`: duel detail, progress board, check-in, and settlement
- `app/invite/duel/[duelId].tsx`: invite review and join flow
- `app/(tabs)/profile.tsx`: player profile and record
- `app/(tabs)/vault.tsx`: redemption vault views
- `app/modal.tsx`: modal route support

## Stack

- Expo 54
- React 19
- React Native 0.81
- Expo Router
- React Native Reanimated
- Zustand
- Convex
- Solana Web3.js
- Solana Mobile Wallet Adapter
- Expo Secure Store and Async Storage

## Project Structure

```text
frontend/
├── app/
│   ├── (tabs)/
│   ├── invite/duel/
│   ├── _layout.tsx
│   └── modal.tsx
├── assets/
├── components/
├── constants/
├── convex/
├── hooks/
├── lib/
├── scripts/
└── stores/
```

### Key folders

- `app/`: file-based routes and screen composition
- `components/`: reusable UI components and themed shells
- `lib/`: wallet logic, Convex client setup, storage helpers, and duel utilities
- `stores/`: Zustand stores for user, duel, arena, and wallet state
- `convex/`: Convex schema plus generated types

## Convex Data Model

The current schema in `convex/schema.ts` defines:

- `users`
- `duels`
- `submissions`
- `settlements`
- `authChallenges`
- `sessions`

This frontend repo currently includes the schema and generated Convex files. If you add queries or mutations later, keep them aligned with this schema.

## Wallet Integration

Wallet behavior is implemented in `lib/use-wallet.ts`.

It currently handles:

- connect and disconnect flows
- mobile wallet authorization and reauthorization
- SOL transfer helpers
- create, join, and cancel duel transactions
- config initialization
- settlement reads and settlement submission
- vault redemption

Persistent wallet state lives in `stores/use-wallet-store.ts`.

## Deep Links

The Expo app uses the `strivioz` scheme from `app.json`.

Invite flows are routed through:

- app route: `app/invite/duel/[duelId].tsx`
- example web path: `/invite/duel/{duelId}`

## Local Development

### Prerequisites

- Node.js
- npm
- Expo tooling through `npx expo`
- Android Studio and/or Xcode for native builds
- a configured Convex deployment if you are wiring the app to live backend data
- a Solana wallet app on the target device for wallet-adapter flows

### Install

```bash
npm install
```

### Start

```bash
npm run start
```

### Run targets

```bash
npm run android
npm run ios
npm run web
```

### Lint

```bash
npm run lint
```

## App Configuration

Important app-level configuration lives in `app.json`:

- app name: `Strivioz`
- custom scheme: `strivioz`
- iOS bundle id: `com.strivioz.app`
- Android package: `com.strivioz.app`
- Expo Router enabled
- React Compiler enabled

## Notes

- `npm run reset-project` runs the Expo starter reset script in `scripts/reset-project.js`.
- `convex/_generated/` contains generated files and should stay in sync with your Convex setup.
- The frontend depends on the Anchor program defined in the backend workspace for on-chain duel operations.
