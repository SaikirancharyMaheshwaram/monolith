use crate::{constants::VAULT_SEED, error::DuelError, state::RedemptionVault};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RedeemVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut,
            seeds = [VAULT_SEED, owner.key().as_ref()],
            bump = vault.bump,
            constraint = vault.owner == owner.key() @ DuelError::NotOwner,)]
    pub vault: Account<'info, RedemptionVault>,

    pub system_program: Program<'info, System>,
}

impl<'info> RedeemVault<'info> {
    pub fn handler(&mut self) -> Result<()> {
        let vault = &mut self.vault;
        let vault_info = vault.to_account_info();
        let signer_info = self.owner.to_account_info();

        // Must have funds
        require!(vault.locked_lamports > 0, DuelError::NothingToRedeem);

        // Must have WON a duel first to unlock
        // is_locked = true  -> still needs to win
        // is_locked = false -> won a duel, can redeem
        require!(!vault.is_locked, DuelError::VaultStillLocked);

        let amount = vault.locked_lamports;
        let mut vault_lamports = vault_info.try_borrow_mut_lamports()?;
        let mut owner_lamports = signer_info.try_borrow_mut_lamports()?;

        **vault_lamports = vault_lamports
            .checked_sub(amount)
            .ok_or(DuelError::InsufficientFunds)?;

        **owner_lamports = owner_lamports
            .checked_add(amount)
            .ok_or(DuelError::Overflow)?;

        vault.locked_lamports = 0;
        vault.is_locked = false;

        msg!(
            "Vault redeemed | owner: {} | amount: {} lamports",
            self.owner.key(),
            amount
        );
        Ok(())
    }
}
