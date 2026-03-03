use anchor_lang::{prelude::*, system_program::Transfer};

use crate::{
    constants::{
        bps, CONFIG_SEED, ESCROW_SEED, LOSER_BPS, REFUND_BPS, TREASURY_BPS, VAULT_SEED, WINNER_BPS,
    },
    error::DuelError,
    helper::verify_ed25519_ix,
    state::{Config, Duel, DuelStatus, RedemptionVault, UserResult},
};
#[derive(Accounts)]
pub struct SettleDuel<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub duel: Account<'info, Duel>,

    #[account(
            seeds = [CONFIG_SEED],
            bump = config.bump,
        )]
    pub config: Account<'info, Config>,

    /// CHECK: escrow PDA
    #[account(mut)]
    pub escrow: SystemAccount<'info>,

    #[account(mut)]
    pub creator_account: SystemAccount<'info>,

    #[account(mut)]
    pub opponent_account: SystemAccount<'info>,

    #[account(
            init_if_needed,
            payer = user,
            space = 8 + RedemptionVault::INIT_SPACE,
            seeds = [VAULT_SEED, duel.creator.as_ref()],
            bump,
        )]
    pub creator_vault: Account<'info, RedemptionVault>,

    #[account(
            init_if_needed,
            payer = user,
            space = 8 + RedemptionVault::INIT_SPACE,
            seeds = [VAULT_SEED, duel.opponent.expect("failed to read opponent").as_ref()],
            bump,
        )]
    pub opponent_vault: Account<'info, RedemptionVault>,

    #[account(
           mut,
           constraint = treasury.key() == config.treasury @ DuelError::InvalidTreasury
       )]
    pub treasury: SystemAccount<'info>,

    /// CHECK: instructions sysvar for introspection
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> SettleDuel<'info> {
    pub fn handler(&mut self, result: UserResult, bumps: &SettleDuelBumps) -> Result<()> {
        let duel = &mut self.duel;

        require!(duel.status == DuelStatus::Active, DuelError::NotActive);

        let creator = duel.creator;
        let opponent = duel.opponent.ok_or(DuelError::NotActive)?;
        let user = self.user.key();

        // Caller must be a participant
        require!(
            user == creator || user == opponent,
            DuelError::InvalidWinner
        );

        // Validate passed accounts match on-chain state
        require!(
            self.creator_account.key() == creator,
            DuelError::InvalidWinner
        );
        require!(
            self.opponent_account.key() == opponent,
            DuelError::InvalidWinner
        );

        //  Build message from ON-CHAIN data
        let mut message = Vec::with_capacity(49);
        message.extend_from_slice(&duel.duel_id.to_le_bytes());
        message.extend_from_slice(user.as_ref());
        message.push(result as u8);
        message.extend_from_slice(&duel.settlement_nonce.to_le_bytes());

        // Verify Ed25519 instruction
        verify_ed25519_ix(
            &self.instructions_sysvar,
            &self.config.backend_pubkey,
            &message,
        )?;

        //  Increment nonce — prevent replay
        duel.settlement_nonce = duel
            .settlement_nonce
            .checked_add(1)
            .ok_or(DuelError::Overflow)?;

        let total = duel
            .staked_amount
            .checked_mul(2)
            .ok_or(DuelError::Overflow)?;

        let duel_key = duel.key();
        let signer_seeds: &[&[&[u8]]] = &[&[ESCROW_SEED, duel_key.as_ref(), &[duel.escrow_bump]]];

        // Distribute based on result
        match result {
            UserResult::Winner | UserResult::Loser => {
                let (winner, loser) = match result {
                    UserResult::Winner => (user, if user == creator { opponent } else { creator }),
                    _ => (if user == creator { opponent } else { creator }, user),
                };
                let winner_amount = bps(total, WINNER_BPS)?;
                let loser_amount = bps(total, LOSER_BPS)?;
                let treasury_amount = bps(total, TREASURY_BPS)?;

                // 70% -> winner wallet directly
                let winner_acc = if winner == creator {
                    self.creator_account.to_account_info()
                } else {
                    self.opponent_account.to_account_info()
                };

                transfer_lamports(
                    self.system_program.to_account_info().clone(),
                    self.escrow.to_account_info().clone(),
                    winner_acc.clone(),
                    winner_amount,
                    signer_seeds,
                )?;

                // 5% -> treasury
                transfer_lamports(
                    self.system_program.to_account_info().clone(),
                    self.escrow.to_account_info().clone(),
                    self.treasury.to_account_info().clone(),
                    treasury_amount,
                    signer_seeds,
                )?;

                // 25% -> loser redemption vault (locked)
                let (loser_vault, vault_bump) = if loser == creator {
                    (&mut self.creator_vault, bumps.creator_vault)
                } else {
                    (&mut self.opponent_vault, bumps.opponent_vault)
                };
                transfer_lamports(
                    self.system_program.to_account_info().clone(),
                    self.escrow.to_account_info().clone(),
                    loser_vault.to_account_info().clone(),
                    loser_amount,
                    signer_seeds,
                )?;
                loser_vault.owner = loser;
                loser_vault.locked_lamports = loser_vault
                    .locked_lamports
                    .checked_add(loser_amount)
                    .ok_or(DuelError::Overflow)?;
                loser_vault.is_locked = true;
                loser_vault.bump = vault_bump;

                duel.winner = Some(winner);
                msg!(
                    "Winner: {} + {} | Loser: {} vault: {} | Treasury: {}",
                    winner,
                    winner_amount,
                    loser,
                    loser_amount,
                    treasury_amount,
                );
            }
            // Draw -> both equal above threshold
            // Both get 100% of their stake back directly
            // No fee — both performed well
            UserResult::Draw => {
                let each = bps(total, REFUND_BPS)?;

                transfer_lamports(
                    self.system_program.to_account_info().clone(),
                    self.escrow.to_account_info().clone(),
                    self.creator_account.to_account_info(),
                    each,
                    signer_seeds,
                )?;
                transfer_lamports(
                    self.system_program.to_account_info().clone(),
                    self.escrow.to_account_info().clone(),
                    self.opponent_account.to_account_info(),
                    each,
                    signer_seeds,
                )?;
                msg!("Draw | each refunded: {} lamports", each);
            }

            // BothLost — both equal below threshold
            // Money locked in each player's vault — not burned
            UserResult::BothLost => {
                let each = bps(total, REFUND_BPS)?;

                // Creator stake -> creator vault
                transfer_lamports(
                    self.system_program.to_account_info().clone(),
                    self.escrow.to_account_info().clone(),
                    self.creator_vault.to_account_info(),
                    each,
                    signer_seeds,
                )?;
                self.creator_vault.owner = creator;
                self.creator_vault.locked_lamports = self
                    .creator_vault
                    .locked_lamports
                    .checked_add(each)
                    .ok_or(DuelError::Overflow)?;
                self.creator_vault.is_locked = true;
                self.creator_vault.bump = bumps.creator_vault;

                // Opponent stake -> opponent vault

                transfer_lamports(
                    self.system_program.to_account_info().clone(),
                    self.escrow.to_account_info().clone(),
                    self.opponent_vault.to_account_info(),
                    each,
                    signer_seeds,
                )?;
                self.opponent_vault.owner = opponent;
                self.opponent_vault.locked_lamports = self
                    .opponent_vault
                    .locked_lamports
                    .checked_add(each)
                    .ok_or(DuelError::Overflow)?;
                self.opponent_vault.is_locked = true;
                self.opponent_vault.bump = bumps.opponent_vault;

                msg!("BothLost | each vault: {} lamports locked", each);
            }
        }
        // Finalize
        duel.status = DuelStatus::Settled;

        msg!(
            "Duel {} settled | result: {:?} | total: {}",
            duel.duel_id,
            result,
            total
        );

        Ok(())
    }
}

pub fn transfer_lamports<'info>(
    account: AccountInfo<'info>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(account, Transfer { from, to }, signer_seeds),
        amount,
    )?;
    Ok(())
}
