use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Config {
    pub admin: Pubkey,            // who can update config
    pub server_authority: Pubkey, // backend public key (verifier)
    pub treasury: Pubkey,         // where fees go
    pub backend_pubkey: [u8; 32],
    pub fee_bps: u16, // protocol fee in basis points
    pub bump: u8,
}
