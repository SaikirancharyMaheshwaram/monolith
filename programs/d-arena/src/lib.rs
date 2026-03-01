use anchor_lang::prelude::*;
mod constants;
mod error;
mod instructions;
mod state;
mod utils;
declare_id!("Hh9ZPWeXuszeX27sUyxBNgL4bHQb6gKo98osWqAkFnZB");

#[program]
pub mod d_arena {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
