use std::{fs, path::Path};

use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub version: u64,
    pub chain: String,
    pub chain_id: u64,
    pub vanity_suffix: String,
    pub base_mainnet_defaults: BaseMainnetDefaults,
    pub phase1_vanity_targets: Vec<Phase1VanityTarget>,
    pub derived_targets: Vec<DerivedTarget>,
    pub deferred_targets: Vec<DeferredTarget>,
    pub naming_taxonomy: Vec<NamingTaxonomyEntry>,
    pub rename_candidates: Vec<RenameCandidate>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseMainnetDefaults {
    pub create2_factory: String,
    pub registry: String,
    pub protocol_treasury: String,
    pub pool_manager: String,
    pub tax_hook: String,
    pub chainlink_eth_usd: String,
    pub vault_activation_batcher: String,
    pub lottery_manager: String,
    pub permit2: String,
    pub usdc: String,
    pub uniswap_v3_factory: String,
    pub uniswap_router: String,
    pub ajna_factory: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Phase1VanityTarget {
    pub contract_name: String,
    pub deployment_kind: String,
    pub artifact_path: String,
    pub deployment_json_path: String,
    pub salt_env: String,
    pub salt_tag_env: String,
    pub default_salt_tag_template: String,
    pub reference_salt_tag: String,
    pub suffix_required: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DerivedTarget {
    pub contract_name: String,
    pub deployment_kind: String,
    pub artifact_path: String,
    pub deployment_json_path: String,
    pub parent_contract_name: String,
    pub parent_create_nonce: u64,
    pub suffix_required: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeferredTarget {
    pub contract_name: String,
    pub deployment_kind: String,
    pub deployment_json_path: String,
    pub current_address: String,
    pub reason_deferred: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NamingTaxonomyEntry {
    pub name: String,
    pub meaning: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameCandidate {
    pub contract_name: String,
    pub current_path: String,
    pub recommended_name: String,
    pub status: String,
    pub reason: String,
}

pub fn load_catalog(_path: &Path) -> Result<Catalog> {
    let contents = fs::read_to_string(_path)?;
    Ok(serde_json::from_str(&contents)?)
}
