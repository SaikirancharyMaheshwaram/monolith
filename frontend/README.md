# Strivioz Frontend

Strivioz is a mobile-first Solana habit-dueling app built with Expo, Expo Router, Convex, and Solana Web3. Players create stake-backed duels, check in daily, and resolve outcomes through escrow and redemption-vault rules.

This repository contains the Expo frontend and the colocated Convex backend functions used by the app.

## What The App Does

Strivioz turns habit accountability into an on-chain duel:

- Two players lock stake into a duel.
- Players check in daily during the duel window.
- The app tracks progress off-chain in Convex and finalizes payout on-chain.
- The payout model is deterministic:
  - If one player wins: `70%` goes to the winner, `25%` goes to the loser’s redemption vault, `5%` goes to the platform.
  - If both win: each player keeps their full amount.
  - If both lose: funds move to redemption vault logic and must be recovered by winning a future duel.

## Product Surface

### Core user flows

- Wallet connect and profile creation
- Public or friend duel creation
- Invite link sharing and contract-style invite review
- Daily duel check-ins
- On-chain duel settlement
- Redemption vault recovery and tracking

### Primary screens

- `app/(tabs)/index.tsx`
  - Home lobby, stats, primary CTAs, payout rules
- `app/(tabs)/duel.tsx`
  - Duel board, create duel sheet, join duel sheet, share/cancel actions
- `app/(tabs)/duel/[duelId].tsx`
  - Single duel detail, progress board, check-in, settlement
- `app/invite/duel/[duelId].tsx`
  - Invite contract review and join flow
- `app/(tabs)/profile.tsx`
  - Hunter profile, combat record, vault standing
- `app/(tabs)/vault.tsx`
  - Vault-specific redemption views

## Stack

### Client

- Expo 54
- React Native 0.81
- Expo Router
- React Native Reanimated
- Zustand
- Expo Image
- Solana Web3.js
- Solana Mobile Wallet Adapter protocol

### Backend

- Convex
- Convex queries and mutations colocated in `convex/`

### Platform integrations

- Solana Mobile Wallet Adapter session flow
- Expo Secure Store / Async Storage persistence
- Deep links via Expo scheme and web invite routes

## Architecture

### Frontend structure

- `app/`
  - File-based routes and screen composition
- `components/`
  - Reusable UI pieces such as avatars, buttons, modals, themed shells
- `lib/`
  - Wallet integration, utilities, token helpers, Convex client setup
- `stores/`
  - Zustand state for user, duel, arena, and wallet session state

### Backend structure

- `convex/users/`
  - User creation and wallet-linked profile lookups
- `convex/duels/`
  - Duel lifecycle: create, join, cancel, progress, prepare/finalize settlement
- `convex/submissions/`
  - Daily check-in persistence
- `convex/auth/`
  - Wallet auth and login message verification
- `convex/utils/`
  - Time, tier, duel state, and validation helpers

## Duel Lifecycle

### 1. Create

The player creates a duel from the duel board:

- Chooses stake
- Chooses start date and time
- Chooses end date and time
- Optionally sets title and description

Validation rules:

- Start time must be in the future
- End time must be after start time
- Duration must be greater than 7 days
- Duration must be less than 365 days

### 2. Join

Friend duels can be joined from:

- the duel board join sheet
- the invite contract route at `/invite/duel/[duelId]`

On successful join:

- the on-chain join transaction is sent
- Convex marks the duel as joined
- the user is redirected to the duel detail page

### 3. Check In

During the live duel window:

- each player can submit one completion per day
- submissions are recorded in Convex
- the duel detail screen renders player and rival progress

### 4. Settle

After the duel window closes:

- backend prepares a signed settlement payload
- the client sends the settle instruction on-chain
- backend finalizes duel state and records result metadata

## Wallet Model

Wallet behavior is implemented in `lib/use-wallet.ts`.

Responsibilities:

- connect and disconnect
- MWA authorization / reauthorization
- send SOL
- create duel on-chain
- join duel on-chain
- cancel duel on-chain
- initialize program config
- read settlement context
- settle duel
- redeem vault

Related state:

- `stores/use-wallet-store.ts`
  - network selection
  - public key persistence
  - wallet session auth token persistence

## Deep Links

### Invite links

Strivioz uses contract-style invite links:

- Web: `https://strivioz.vercel.app/invite/duel/{duelId}`
- App route: `app/invite/duel/[duelId].tsx`

Invite links should resolve to the contract review page first, not directly to the duel board.

## Project Layout

```text
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx
    duel.tsx
    duel/[duelId].tsx
    profile.tsx
    vault.tsx
  invite/duel/[duelId].tsx

components/
lib/
stores/
convex/
```

## Local Development

### Prerequisites

- Node.js
- npm
- Expo CLI tooling through `npx expo`
- Android Studio and/or Xcode if using device builds
- A configured Convex deployment
- Solana wallet app available on the target device

### Install

```bash
npm install
```

### Start the app

```bash
npm run start
```

### Platform targets

```bash
npm run android
npm run ios
npm run web
```

### Lint

```bash
npm run lint
```

## Environment And Runtime Configuration

This project expects environment values for Convex and settlement signing.

Common values used by the app and backend include:

- `CONVEX_DEPLOYMENT`
- `EXPO_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_CONVEX_SITE_URL`
- `JWT_SECRET`
- `BACKEND_SIGNER_SECRET_KEY`

`BACKEND_SIGNER_SECRET_KEY` is required for settlement signing and on-chain config coordination.

## On-Chain And Settlement Notes

- Duel creation and joining are performed on-chain through the arena program.
- Daily submissions are stored in Convex.
- Settlement uses a backend-signed payload and an on-chain settle instruction.
- Program config must exist on the target cluster before settlement can succeed.

## Design Direction

The app uses a premium, high-contrast visual style:

- dark backgrounds
- ember/orange as the primary accent
- green as the success/accomplishment accent
- animated particles, glows, and floating hero elements
- strong card hierarchy instead of flat list styling

## Current Operational Notes

- The project contains some existing lint warnings in older files unrelated to new work.
- Wallet compatibility can vary across providers; Solana Mobile Wallet Adapter session handling is centralized in `lib/use-wallet.ts`.
- Invite links and duel detail routes are actively used across both mobile and web entry points.

## Scripts

```json
{
  "start": "expo start",
  "reset-project": "node ./scripts/reset-project.js",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "lint": "expo lint"
}
```

## Ownership

This README is intended to describe the app as it exists in this repository today, not a generic Expo starter. Update it whenever duel rules, routes, wallet behavior, or settlement logic change.
