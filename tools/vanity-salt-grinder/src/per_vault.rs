use anyhow::{anyhow, Result};
use ethers_core::{
    types::{Address, H256, U256},
    utils::keccak256,
};
use serde::Serialize;

use crate::ethereum::predict_create2_address;

#[derive(Debug, Clone)]
pub struct PerVaultVersionSearchConfig {
    pub create2_deployer: Address,
    pub creator_token: Address,
    pub owner: Address,
    pub chain_id: u64,
    pub base_version: String,
    pub vault_prefix: Option<String>,
    pub share_suffix: Option<String>,
    pub start_attempt: u64,
    pub max_attempts: u64,
    pub vault_init_code_hash: Option<H256>,
    pub share_oft_init_code_hash: Option<H256>,
    pub share_symbol: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerVaultVersionSearchResult {
    pub version: String,
    pub attempt: u64,
    pub attempts: u64,
    pub vault_address: Option<Address>,
    pub share_oft_address: Option<Address>,
    pub vault_salt: Option<H256>,
    pub share_oft_salt: Option<H256>,
}

pub fn find_per_vault_version(
    config: &PerVaultVersionSearchConfig,
) -> Result<PerVaultVersionSearchResult> {
    let vault_prefix = normalize_hex_pattern(config.vault_prefix.as_deref())?;
    let share_suffix = normalize_hex_pattern(config.share_suffix.as_deref())?;
    if vault_prefix.is_none() && share_suffix.is_none() {
        return Err(anyhow!(
            "at least one of vault_prefix or share_suffix is required"
        ));
    }
    if vault_prefix.is_some() && config.vault_init_code_hash.is_none() {
        return Err(anyhow!(
            "vault_init_code_hash is required when vault_prefix is set"
        ));
    }
    if share_suffix.is_some() {
        if config.share_oft_init_code_hash.is_none() {
            return Err(anyhow!(
                "share_oft_init_code_hash is required when share_suffix is set"
            ));
        }
        if config
            .share_symbol
            .as_deref()
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            return Err(anyhow!("share_symbol is required when share_suffix is set"));
        }
    }

    let max_attempts = config.max_attempts.max(1);
    let end_attempt = config.start_attempt.saturating_add(max_attempts);
    for attempt in config.start_attempt..end_attempt {
        let candidate_version = candidate_version(&config.base_version, attempt);
        let base_salt = derive_base_salt(
            config.creator_token,
            config.owner,
            config.chain_id,
            &candidate_version,
        );

        let mut vault_address = None;
        let mut vault_salt = None;
        if let Some(prefix) = vault_prefix.as_deref() {
            let salt = salt_for(base_salt, "vault");
            let address = predict_create2_address(
                config.create2_deployer,
                salt,
                config.vault_init_code_hash.expect("validated above"),
            );
            if !address_matches_prefix(address, prefix) {
                continue;
            }
            vault_address = Some(address);
            vault_salt = Some(salt);
        }

        let mut share_oft_address = None;
        let mut share_oft_salt = None;
        if let Some(suffix) = share_suffix.as_deref() {
            let salt = derive_share_oft_salt(
                config.owner,
                config.share_symbol.as_deref().expect("validated above"),
                &candidate_version,
            );
            let address = predict_create2_address(
                config.create2_deployer,
                salt,
                config.share_oft_init_code_hash.expect("validated above"),
            );
            if !address_matches_suffix(address, suffix) {
                continue;
            }
            share_oft_address = Some(address);
            share_oft_salt = Some(salt);
        }

        return Ok(PerVaultVersionSearchResult {
            version: candidate_version,
            attempt,
            attempts: attempt - config.start_attempt + 1,
            vault_address,
            share_oft_address,
            vault_salt,
            share_oft_salt,
        });
    }

    Err(anyhow!(
        "failed to find per-vault vanity version within {max_attempts} attempts"
    ))
}

pub fn derive_base_salt(
    creator_token: Address,
    owner: Address,
    chain_id: u64,
    version: &str,
) -> H256 {
    let mut bytes = Vec::with_capacity(20 + 20 + 32 + "4626:deploy:".len() + version.len());
    bytes.extend_from_slice(creator_token.as_bytes());
    bytes.extend_from_slice(owner.as_bytes());
    let mut chain_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_bytes);
    bytes.extend_from_slice(&chain_bytes);
    bytes.extend_from_slice(format!("4626:deploy:{version}").as_bytes());
    H256::from(keccak256(bytes))
}

pub fn salt_for(base_salt: H256, label: &str) -> H256 {
    let mut bytes = Vec::with_capacity(32 + label.len());
    bytes.extend_from_slice(base_salt.as_bytes());
    bytes.extend_from_slice(label.as_bytes());
    H256::from(keccak256(bytes))
}

pub fn derive_share_oft_salt(owner: Address, share_symbol: &str, version: &str) -> H256 {
    let share_symbol_lower = share_symbol.to_ascii_lowercase();
    let mut base_bytes = Vec::with_capacity(20 + share_symbol_lower.len());
    base_bytes.extend_from_slice(owner.as_bytes());
    base_bytes.extend_from_slice(share_symbol_lower.as_bytes());
    let base = H256::from(keccak256(base_bytes));
    salt_for(base, &format!("CreatorShareOFT:{version}"))
}

fn normalize_hex_pattern(value: Option<&str>) -> Result<Option<String>> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let cleaned = trimmed.strip_prefix("0x").unwrap_or(trimmed);
    if cleaned.is_empty() || cleaned.len() > 40 {
        return Err(anyhow!("hex pattern must be 1-40 hex characters"));
    }
    if !cleaned.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(anyhow!("hex pattern contains non-hex characters"));
    }
    Ok(Some(cleaned.to_ascii_lowercase()))
}

fn candidate_version(base_version: &str, attempt: u64) -> String {
    if attempt == 0 {
        return base_version.to_owned();
    }
    format!("{base_version}-v{}", to_base36(attempt))
}

fn to_base36(mut value: u64) -> String {
    const DIGITS: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if value == 0 {
        return "0".to_owned();
    }
    let mut out = Vec::new();
    while value > 0 {
        out.push(DIGITS[(value % 36) as usize]);
        value /= 36;
    }
    out.reverse();
    String::from_utf8(out).expect("base36 digits are valid utf8")
}

fn address_matches_prefix(address: Address, prefix: &str) -> bool {
    address
        .to_string()
        .trim_start_matches("0x")
        .to_ascii_lowercase()
        .starts_with(prefix)
}

fn address_matches_suffix(address: Address, suffix: &str) -> bool {
    address.to_string().to_ascii_lowercase().ends_with(suffix)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_candidate_versions_like_deploy_ui() {
        assert_eq!(candidate_version("v1.8.1", 0), "v1.8.1");
        assert_eq!(candidate_version("v1.8.1", 1), "v1.8.1-v1");
        assert_eq!(candidate_version("v1.8.1", 35), "v1.8.1-vz");
        assert_eq!(candidate_version("v1.8.1", 36), "v1.8.1-v10");
    }

    #[test]
    fn finds_vault_prefix_version() {
        let config = PerVaultVersionSearchConfig {
            create2_deployer: "0x4e59b44847b379578588920cA78FbF26c0B4956C"
                .parse()
                .expect("valid deployer"),
            creator_token: "0x1111111111111111111111111111111111111111"
                .parse()
                .expect("valid creator token"),
            owner: "0x2222222222222222222222222222222222222222"
                .parse()
                .expect("valid owner"),
            chain_id: 8453,
            base_version: "vtest".to_owned(),
            vault_prefix: Some("0".to_owned()),
            share_suffix: None,
            start_attempt: 0,
            max_attempts: 128,
            vault_init_code_hash: Some(H256::from(keccak256(b"vault-init-code"))),
            share_oft_init_code_hash: None,
            share_symbol: None,
        };

        let result = find_per_vault_version(&config).expect("prefix should be found quickly");
        assert!(result
            .vault_address
            .expect("vault address")
            .to_string()
            .trim_start_matches("0x")
            .to_ascii_lowercase()
            .starts_with('0'));
    }
}
