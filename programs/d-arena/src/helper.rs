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
    let current_ix =
        load_current_index_checked(instruction_sysvar).map_err(|_| DuelError::InvalidSignature)?;
    require!(current_ix > 0, DuelError::InvalidSignature);

    let ix = load_instruction_at_checked((current_ix as usize) - 1, instruction_sysvar)
        .map_err(|_| DuelError::InvalidSignature)?;

    let ed25519_id = Pubkey::new_from_array(solana_program::ed25519_program::ID.to_bytes());
    require!(ix.program_id == ed25519_id, DuelError::InvalidSignature);

    let data = &ix.data;
    require!(data.len() >= 16, DuelError::InvalidSignature);
    require!(data[0] == 1, DuelError::InvalidSignature); // one signature

    // Offsets in Ed25519 instruction header
    let pk_off = u16::from_le_bytes([data[6], data[7]]) as usize;
    let msg_off = u16::from_le_bytes([data[10], data[11]]) as usize;
    let msg_len = u16::from_le_bytes([data[12], data[13]]) as usize;

    require!(data.len() >= pk_off + 32, DuelError::InvalidSignature);
    require!(data.len() >= msg_off + msg_len, DuelError::InvalidSignature);

    let pk: [u8; 32] = data[pk_off..pk_off + 32]
        .try_into()
        .map_err(|_| DuelError::InvalidSignature)?;
    require!(&pk == expected_pubkey, DuelError::InvalidSignature);

    let msg = &data[msg_off..msg_off + msg_len];
    require!(msg == expected_message, DuelError::InvalidSignature);

    Ok(())
}
