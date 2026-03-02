use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::system_program::Transfer;

use crate::{
    constants::ESCROW_SEED,
    error::DuelError,
    state::{Duel, DuelStatus},
};
#[derive(Accounts)]
pub struct JoinDuel<'info> {
    #[account(mut)]
    pub opponent: Signer<'info>,

    #[account(mut)]
    pub duel: Account<'info, Duel>,

    /// CHECK: escrow PDA
    #[account(
            mut,
            seeds = [ESCROW_SEED, duel.key().as_ref()],
            bump = duel.escrow_bump,
        )]
    pub escrow: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
impl<'info> JoinDuel<'info> {
    pub fn handler(&mut self) -> Result<()> {
        let duel = &mut self.duel;
        let clock = Clock::get()?;

        require!(duel.status == DuelStatus::Pending, DuelError::NotPending);
        require!(duel.opponent.is_none(), DuelError::AlreadyJoined);
        require!(
            self.opponent.key() != duel.creator,
            DuelError::CannotJoinOwnDuel
        );
        require!(
            clock.unix_timestamp < duel.end_ts,
            DuelError::DuelAlreadyExpired
        );

        let stake = duel.staked_amount;

        require!(stake > 0, DuelError::StakeTooSmall);

        // Transfer opponent stake to escrow
        system_program::transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.opponent.to_account_info(),
                    to: self.escrow.to_account_info(),
                },
            ),
            stake,
        )?;

        duel.opponent = Some(self.opponent.key());
        duel.status = DuelStatus::Active;

        msg!(
            "Duel {} joined | opponent: {} | stake: {}",
            duel.duel_id,
            self.opponent.key(),
            stake,
        );

        Ok(())
    }
}
