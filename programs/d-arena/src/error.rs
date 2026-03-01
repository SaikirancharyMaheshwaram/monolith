use anchor_lang::error_code;

#[error_code]
pub enum DuelError {
    #[msg("Duel is not in Pending state")]
    NotPending,
    #[msg("Duel already has an opponent")]
    AlreadyJoined,
    #[msg("Duel is not Active")]
    NotActive,
    #[msg("Winner is not a participant")]
    InvalidWinner,
    #[msg("Signature verification failed")]
    InvalidSignature,
    #[msg("Not the vault owner")]
    NotOwner,
    #[msg("Vault is empty")]
    VaultEmpty,
    #[msg("Vault owner does not match loser")]
    VaultOwnerMismatch,
    #[msg("Arithmetic overflow")]
    Overflow,
}
