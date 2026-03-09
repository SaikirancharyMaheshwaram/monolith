# Strivioz Backend

This package contains the Solana backend for Strivioz. It is an Anchor workspace centered on the `d-arena` program, which manages duel escrow, settlement, cancellation, and redemption vault flows.

## Stack

- Rust `1.89.0`
- Anchor
- Solana Web3.js
- TypeScript test suite with Mocha and Chai

## Workspace Layout

```text
backend/
├── Anchor.toml
├── Cargo.toml
├── migrations/
├── programs/
│   └── d-arena/
│       └── src/
│           ├── instructions/
│           ├── state/
│           └── lib.rs
└── tests/
```

## Program Surface

The `d-arena` program currently exposes these instructions:

- `initialze_config`
- `create_duel`
- `join_duel`
- `cancel_duel`
- `settle_duel`
- `redeem_vault`

Relevant state modules:

- `state/config.rs`
- `state/duel.rs`
- `state/vault.rs`

## Local Setup

### Prerequisites

- Rust toolchain `1.89.0`
- Solana CLI
- Anchor CLI
- Yarn
- A local Solana wallet configured at `~/.config/solana/id.json`

### Install

```bash
yarn install
```

### Build

```bash
anchor build
```

### Test

```bash
anchor test
```

Anchor uses the script defined in `Anchor.toml`:

```text
yarn run ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

## Test Requirements

The current tests read local keypair files from the backend root:

- `server.json`
- `creator.json`

Without those files, the test suite will fail before execution.

Tests also assume:

- the configured wallet can pay for transactions on devnet
- the provider wallet matches the upgrade authority when initializing config

## Configuration

`Anchor.toml` is currently set to:

- cluster: `devnet`
- wallet: `~/.config/solana/id.json`
- program name: `d_arena`

The devnet program id is:

```text
EJUzdHnJDy9QEVpWCYcbFoZzXbQWanzKLYJdAYkrqJNM
```

## Useful Commands

```bash
yarn lint
yarn lint:fix
anchor build
anchor test
```

## Implementation Notes

- PDA helpers for config, duel, escrow, and vault accounts are exercised in `tests/helper/helper.ts`.
- The test suite covers config initialization, duel creation, join/cancel flows, settlement, and vault redemption scenarios.
- `migrations/deploy.ts` is present but currently minimal.
