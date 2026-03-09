use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct RedemptionVault {
    /// owner of this vault
    pub owner: Pubkey,

    /// amount locked for redemption (lamports)
    pub locked_lamports: u64,

    pub is_locked: bool,
    /// bump for PDA
    pub bump: u8,
}
