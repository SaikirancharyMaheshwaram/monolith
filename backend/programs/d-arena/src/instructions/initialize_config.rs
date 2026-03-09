use crate::{constants::CONFIG_SEED, error::DuelError, program::DArena, state::Config};
use anchor_lang::prelude::*;
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,

    // Ensures only the program deployer can initialize config
    #[account(
            constraint = this_program.programdata_address()? == Some(program_data.key())
                @ DuelError::ProgramDataMismatch
        )]
    pub this_program: Program<'info, DArena>,

    #[account(
            constraint = program_data.upgrade_authority_address == Some(admin.key())
                @ DuelError::UpgradeAuthorityMismatch
        )]
    pub program_data: Account<'info, ProgramData>,
}

impl<'info> InitializeConfig<'info> {
    pub fn handler(
        &mut self,
        backend_pubkey: [u8; 32],
        treasury: Pubkey,
        fee_bps: u16,
        bumps: &InitializeConfigBumps,
    ) -> Result<()> {
        let config = &mut self.config;

        config.set_inner(Config {
            admin: self.admin.key(),
            server_authority: Pubkey::new_from_array(backend_pubkey),
            treasury,
            backend_pubkey,
            fee_bps,
            bump: bumps.config,
        });
        msg!(
            "Config initialized | admin: {} | treasury: {} | fee_bps: {}",
            config.admin,
            config.treasury,
            config.fee_bps,
        );

        Ok(())
    }
}
