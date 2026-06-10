use anyhow::Result;
use ethers_core::types::{Address, H256, U256};

use crate::ethereum::predict_create2_address;

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub raw_salt: H256,
    pub predicted_address: Address,
    pub attempts: u64,
}

pub fn find_salt_for_suffix(
    deployer: Address,
    init_code_hash: H256,
    seed: H256,
    suffix: &str,
    max_attempts: u64,
) -> Result<SearchResult> {
    let suffix = suffix.to_ascii_lowercase();

    for attempt in 0..max_attempts {
        let mut bytes = [0u8; 40];
        bytes[..32].copy_from_slice(seed.as_bytes());
        bytes[32..].copy_from_slice(&attempt.to_be_bytes());

        let raw_salt = H256::from(ethers_core::utils::keccak256(bytes));
        let predicted_address = predict_create2_address(deployer, raw_salt, init_code_hash);

        if predicted_address.to_string().to_ascii_lowercase().ends_with(&suffix) {
            return Ok(SearchResult {
                raw_salt,
                predicted_address,
                attempts: attempt + 1,
            });
        }
    }

    anyhow::bail!("failed to find suffix {suffix} within {max_attempts} attempts")
}

/// Linear CREATE2 salt scan used by DeployVault ShareOFT vanity:
/// `salt = (start_at + attempt) mod 2^256` (mirrors viem `toHex((startAt + i) & MAX_UINT256)`).
pub fn find_salt_for_suffix_linear(
    deployer: Address,
    init_code_hash: H256,
    start_at: H256,
    suffix: &str,
    max_attempts: u64,
) -> Result<SearchResult> {
    let suffix = suffix.to_ascii_lowercase();
    let mut cursor = U256::from_big_endian(start_at.as_bytes());

    for attempt in 0..max_attempts {
        let mut salt_bytes = [0u8; 32];
        cursor.to_big_endian(&mut salt_bytes);
        let raw_salt = H256::from(salt_bytes);
        let predicted_address = predict_create2_address(deployer, raw_salt, init_code_hash);

        if predicted_address
            .to_string()
            .to_ascii_lowercase()
            .ends_with(&suffix)
        {
            return Ok(SearchResult {
                raw_salt,
                predicted_address,
                attempts: attempt + 1,
            });
        }

        cursor = cursor.overflowing_add(U256::one()).0;
    }

    anyhow::bail!("failed to find suffix {suffix} within {max_attempts} attempts")
}
