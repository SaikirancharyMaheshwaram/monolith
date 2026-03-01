use anchor_lang::{prelude::*, system_program::Transfer};

use crate::{
    constants::{DUEL_SEED, ESCROW_SEED},
    error::DuelError,
    state::{Duel, DuelStatus},
};
use anchor_lang::system_program;

#[derive(Accounts)]
#[instruction(duel_nonce:u64)]
pub struct CreateDuel<'info> {
    /// Creator pays rent and funds stake
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer=creator,
        space=8+Duel::INIT_SPACE,
        seeds = [
            DUEL_SEED,
            creator.key().as_ref(),
            &duel_nonce.to_le_bytes(),
        ],
        bump
    )]
    pub duel: Account<'info, Duel>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, duel.key().as_ref()],
        bump
    )]
    pub escrow: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> CreateDuel<'info> {
    pub fn handler(
        &mut self,
        _duel_nonce: u64,
        stake_amount: u64,
        start_time: i64,
        end_time: i64,
        bumps: &CreateDuelBumps,
    ) -> Result<()> {
        require!(stake_amount > 0, DuelError::StakeTooSmall);

        let duel = &mut self.duel;
        let clock = Clock::get()?;

        require!(start_time < end_time, DuelError::InvalidTimeRange);
        require!(
            end_time > clock.unix_timestamp,
            DuelError::DuelAlreadyExpired
        );

        duel.set_inner(Duel {
            creator: self.creator.key(),
            opponent: None,
            staked_amount: stake_amount,
            status: DuelStatus::Pending,
            created_ts: clock.unix_timestamp,
            start_ts: start_time,
            end_ts: end_time,
            winner: None,
            settlement_nonce: 0,
            duel_bump: bumps.duel,
            escrow_bump: bumps.escrow,
        });

        // Transfer stake from creator to escrow PDA
        system_program::transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.creator.to_account_info(),
                    to: self.escrow.to_account_info(),
                },
            ),
            stake_amount,
        )?;
        Ok(())
    }
}
