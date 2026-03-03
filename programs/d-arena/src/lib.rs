use anchor_lang::prelude::*;
mod constants;
mod error;
mod helper;
mod instructions;
mod state;
mod utils;
use crate::instructions::*;
use crate::state::UserResult;

declare_id!("Hh9ZPWeXuszeX27sUyxBNgL4bHQb6gKo98osWqAkFnZB");

#[program]
pub mod d_arena {

    use super::*;

    pub fn create_duel(
        ctx: Context<CreateDuel>,
        duel_nonce: u64,
        stake_amount: u64,
        start_time: i64,
        end_time: i64,
    ) -> Result<()> {
        ctx.accounts
            .handler(duel_nonce, stake_amount, start_time, end_time, &ctx.bumps)?;
        Ok(())
    }

    pub fn join_duel(ctx: Context<JoinDuel>) -> Result<()> {
        ctx.accounts.handler()?;
        Ok(())
    }

    pub fn cancel_duel(ctx: Context<CancelDuel>) -> Result<()> {
        ctx.accounts.handler()
    }

    pub fn settle_duel(ctx: Context<SettleDuel>, result: UserResult) -> Result<()> {
        ctx.accounts.handler(result, &ctx.bumps)
    }

    pub fn initialze_config(
        ctx: Context<InitializeConfig>,
        backend_pubkey: [u8; 32],
        treasury: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        ctx.accounts
            .handler(backend_pubkey, treasury, fee_bps, &ctx.bumps)
    }
}
