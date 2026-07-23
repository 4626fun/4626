use anchor_lang::prelude::*;

pub const LOTTERY_ENTRY_MESSAGE_LEN: usize = 32 * 7;
pub const LOTTERY_ENTRY_MESSAGE_TYPE: u16 = 3;

/// Validate the fixed ABI payload accepted by LotteryManager4626.
pub fn validate_lottery_entry_message(message: &[u8]) -> Result<()> {
    require!(message.len() == LOTTERY_ENTRY_MESSAGE_LEN, ErrorCode::ConstraintRaw);
    require!(message[0..30].iter().all(|byte| *byte == 0), ErrorCode::ConstraintRaw);
    require!(u16::from_be_bytes([message[30], message[31]]) == LOTTERY_ENTRY_MESSAGE_TYPE, ErrorCode::ConstraintRaw);
    for address_word in [32usize, 64usize] {
        require!(message[address_word..address_word + 12].iter().all(|byte| *byte == 0), ErrorCode::ConstraintRaw);
        require!(message[address_word + 12..address_word + 32].iter().any(|byte| *byte != 0), ErrorCode::ConstraintRaw);
    }
    require!(message[96..128].iter().any(|byte| *byte != 0), ErrorCode::ConstraintRaw);
    // Solana gets Base odds only; a forged coverage balance must never cross.
    require!(message[160..192].iter().all(|byte| *byte == 0), ErrorCode::ConstraintRaw);
    require!(message[192..224].iter().any(|byte| *byte != 0), ErrorCode::ConstraintRaw);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_message() -> Vec<u8> {
        let mut message = vec![0u8; LOTTERY_ENTRY_MESSAGE_LEN];
        message[31] = LOTTERY_ENTRY_MESSAGE_TYPE as u8;
        message[63] = 1; // buyer
        message[95] = 2; // token
        message[127] = 3; // amount
        message[223] = 4; // source event id
        message
    }

    #[test]
    fn accepts_only_canonical_lottery_entry_payload() {
        assert!(validate_lottery_entry_message(&valid_message()).is_ok());
        let mut coverage = valid_message();
        coverage[191] = 1;
        assert!(validate_lottery_entry_message(&coverage).is_err());
        let mut wrong_type = valid_message();
        wrong_type[31] = 2;
        assert!(validate_lottery_entry_message(&wrong_type).is_err());
        assert!(validate_lottery_entry_message(&valid_message()[..223]).is_err());
    }
}
