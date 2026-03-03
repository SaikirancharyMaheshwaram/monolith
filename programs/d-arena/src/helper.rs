use anchor_lang::prelude::{
    sysvar::instructions::{load_current_index_checked, load_instruction_at_checked},
    *,
};

use crate::error::DuelError;
pub fn verify_ed25519_ix(
    instruction_sysvar: &AccountInfo,
    expected_pubkey: &[u8; 32],
    expected_message: &[u8],
) -> Result<()> {
    // Get current instruction index
    let current_ix =
        load_current_index_checked(instruction_sysvar).map_err(|_| DuelError::InvalidSignature)?;
    // Ed25519 ix must be immediately
    require!(current_ix > 0, DuelError::InvalidSignature);

    let ix = load_instruction_at_checked((current_ix as usize) - 1, instruction_sysvar)
        .map_err(|_| DuelError::InvalidSignature)?;

    // Must be ed25519 program
    let ed25519_id = Pubkey::new_from_array(solana_program::ed25519_program::ID.to_bytes());
    require!(ix.program_id == ed25519_id, DuelError::InvalidSignature);

    let data = &ix.data;
    require!(data.len() >= 112, DuelError::InvalidSignature);

    // Extract and verify pubkey
    let pubkey_bytes: [u8; 32] = data[80..112]
        .try_into()
        .map_err(|_| DuelError::InvalidSignature)?;

    require!(
        &pubkey_bytes == expected_pubkey,
        DuelError::InvalidSignature
    );

    //  Extract and verify message
    let msg_size = u16::from_le_bytes(
        data[12..14]
            .try_into()
            .map_err(|_| DuelError::InvalidSignature)?,
    ) as usize;

    // message starts at [112]
    require!(data.len() >= 112 + msg_size, DuelError::InvalidSignature);

    let ix_message = &data[112..112 + msg_size];
    require!(ix_message == expected_message, DuelError::InvalidSignature);

    Ok(())
}
