use anchor_lang::prelude::*;

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum DuelStatus {
    Pending = 0,
    Active = 1,
    Settled = 2,
    Cancelled = 3,
}

impl Default for DuelStatus {
    fn default() -> Self {
        DuelStatus::Pending
    }
}

#[account]
#[derive(Debug, InitSpace)]
pub struct Duel {
    /// participants
    pub creator: Pubkey,
    pub opponent: Option<Pubkey>,

    /// total amount staked
    pub staked_amount: u64,

    pub status: DuelStatus,
    pub created_ts: i64,
    pub start_ts: i64,
    pub end_ts: i64,

    /// settlement
    pub winner: Option<Pubkey>,
    pub settlement_nonce: u64, // anti-replay for backend signatures

    pub duel_bump: u8,
    pub escrow_bump: u8,
}
