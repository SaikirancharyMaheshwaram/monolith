use crate::error::DuelError;
use anchor_lang::{prelude::*, system_program::Transfer};

pub const DUEL_SEED: &[u8] = b"duel";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CONFIG_SEED: &[u8] = b"config";
pub const MAX_DUEL_DURATION: i64 = 365 * 24 * 60 * 60;
pub const MIN_DUEL_DURATION: i64 = 7 * 24 * 60 * 60; // 7 days — minimum streak
pub const WINNER_BPS: u64 = 7_000;
pub const LOSER_BPS: u64 = 2_500;
pub const TREASURY_BPS: u64 = 500;
pub const REFUND_BPS: u64 = 5_000;

pub fn bps(amount: u64, basis_points: u64) -> Result<u64> {
    amount
        .checked_mul(basis_points)
        .ok_or(DuelError::Overflow)?
        .checked_div(10_000)
        .ok_or(DuelError::Overflow.into())
}
