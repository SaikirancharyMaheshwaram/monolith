use crate::{
    constants::ESCROW_SEED,
    error::DuelError,
    state::{Duel, DuelStatus},
};
use anchor_lang::{prelude::*, system_program::Transfer};

#[derive(Accounts)]
pub struct CancelDuel<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        constraint = duel.creator == creator.key() @ DuelError::NotOwner,
    )]
    pub duel: Account<'info, Duel>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, duel.key().as_ref()],
        bump = duel.escrow_bump,
    )]
    /// CHECK: escrow PDA validated by seeds + bump
    pub escrow: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> CancelDuel<'info> {
    pub fn handler(&mut self) -> Result<()> {
        let duel = &mut self.duel;
        let clock = Clock::get()?;

        require!(duel.status == DuelStatus::Pending, DuelError::NotPending);

        require!(
            clock.unix_timestamp >= duel.start_ts,
            DuelError::CancelTooEarly
        );
        let refund = duel.staked_amount;
        require!(refund > 0, DuelError::VaultEmpty);

        let duel_key = duel.key();
        let signer_seeds: &[&[&[u8]]] = &[&[ESCROW_SEED, duel_key.as_ref(), &[duel.escrow_bump]]];

        let refund_cpi = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            Transfer {
                from: self.escrow.to_account_info(),
                to: self.creator.to_account_info(),
            },
            signer_seeds,
        );
        anchor_lang::system_program::transfer(refund_cpi, refund)?;

        duel.status = DuelStatus::Cancelled;

        Ok(())
    }
}
