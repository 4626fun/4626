use std::{
    collections::BTreeMap,
    fs,
    path::Path,
};

use anyhow::{anyhow, Result};
use ethers_core::{
    abi::{encode, Token},
    types::{Address, Bytes, H256},
    utils::keccak256,
};
use serde::{Deserialize, Serialize};

use crate::{
    catalog::{Catalog, DerivedTarget, Phase1VanityTarget},
    ethereum::{predict_create2_address, predict_create_address},
    search::{find_salt_for_suffix, SearchResult},
};

#[derive(Debug, Clone)]
pub struct DerivedAddress {
    pub contract_name: String,
    pub predicted_address: Address,
    pub parent_create_nonce: u64,
}

#[derive(Debug, Clone)]
pub struct BuildConfig {
    pub epoch_tag: String,
    pub suffix: String,
    pub max_attempts: u64,
    pub use_reference_salts: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VanityManifest {
    pub version: u64,
    pub chain: String,
    pub chain_id: u64,
    pub vanity_suffix: String,
    pub epoch_tag: String,
    pub catalog_path: String,
    pub create2_factory: Address,
    pub inputs: ManifestInputs,
    pub phase1: BTreeMap<String, ManifestPhase1Entry>,
    pub derived: BTreeMap<String, ManifestDerivedEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestInputs {
    pub registry: Address,
    pub protocol_treasury: Address,
    pub pool_manager: Address,
    pub tax_hook: Address,
    pub chainlink_eth_usd: Address,
    pub vault_activation_batcher: Address,
    pub lottery_manager: Address,
    pub permit2: Address,
    pub usdc: Address,
    pub uniswap_v3_factory: Address,
    pub uniswap_router: Address,
    pub ajna_factory: Address,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPhase1Entry {
    pub contract_name: String,
    pub deployment_kind: String,
    pub artifact_path: String,
    pub salt_env: String,
    pub salt_tag_env: String,
    pub default_salt_tag_template: String,
    pub reference_salt_tag: String,
    pub seed_tag: String,
    pub raw_salt: H256,
    pub seed_hash: H256,
    pub search_attempts: u64,
    pub suffix_required: bool,
    pub constructor_args_hex: String,
    pub constructor_args_hash: H256,
    pub init_code_hash: H256,
    pub predicted_address: Address,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestDerivedEntry {
    pub contract_name: String,
    pub deployment_kind: String,
    pub artifact_path: String,
    pub parent_contract_name: String,
    pub parent_create_nonce: u64,
    pub suffix_required: bool,
    pub predicted_address: Address,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
struct ArtifactFile {
    bytecode: ArtifactBytecode,
}

#[derive(Debug, Deserialize)]
struct ArtifactBytecode {
    object: String,
}

pub fn derive_constructor_children(parent_address: Address, targets: &[DerivedTarget]) -> Result<Vec<DerivedAddress>> {
    Ok(targets
        .iter()
        .map(|target| DerivedAddress {
            contract_name: target.contract_name.clone(),
            predicted_address: predict_create_address(parent_address, target.parent_create_nonce),
            parent_create_nonce: target.parent_create_nonce,
        })
        .collect())
}

pub fn build_manifest(
    repo_root: &Path,
    catalog_path: &Path,
    catalog: &Catalog,
    config: &BuildConfig,
) -> Result<VanityManifest> {
    let create2_factory = parse_address(&catalog.base_mainnet_defaults.create2_factory)?;
    let inputs = ManifestInputs {
        registry: parse_address(&catalog.base_mainnet_defaults.registry)?,
        protocol_treasury: parse_address(&catalog.base_mainnet_defaults.protocol_treasury)?,
        pool_manager: parse_address(&catalog.base_mainnet_defaults.pool_manager)?,
        tax_hook: parse_address(&catalog.base_mainnet_defaults.tax_hook)?,
        chainlink_eth_usd: parse_address(&catalog.base_mainnet_defaults.chainlink_eth_usd)?,
        vault_activation_batcher: parse_address(&catalog.base_mainnet_defaults.vault_activation_batcher)?,
        lottery_manager: parse_address(&catalog.base_mainnet_defaults.lottery_manager)?,
        permit2: parse_address(&catalog.base_mainnet_defaults.permit2)?,
        usdc: parse_address(&catalog.base_mainnet_defaults.usdc)?,
        uniswap_v3_factory: parse_address(&catalog.base_mainnet_defaults.uniswap_v3_factory)?,
        uniswap_router: parse_address(&catalog.base_mainnet_defaults.uniswap_router)?,
        ajna_factory: parse_address(&catalog.base_mainnet_defaults.ajna_factory)?,
    };

    let mut phase1 = BTreeMap::new();

    let store_target = &catalog.phase1_vanity_targets[0];
    let store = build_entry(
        repo_root,
        create2_factory,
        store_target,
        config,
        Bytes::from_static(&[]),
    )?;
    let store_address = store.predicted_address;
    phase1.insert(store.contract_name.clone(), store);

    let deployer_target = &catalog.phase1_vanity_targets[1];
    let deployer_args = encode(&[Token::Address(store_address)]);
    let deployer = build_entry(
        repo_root,
        create2_factory,
        deployer_target,
        config,
        Bytes::from(deployer_args),
    )?;
    let deployer_address = deployer.predicted_address;
    phase1.insert(deployer.contract_name.clone(), deployer);

    let core_target = &catalog.phase1_vanity_targets[2];
    let core = build_entry(repo_root, create2_factory, core_target, config, Bytes::from_static(&[]))?;
    let core_address = core.predicted_address;
    phase1.insert(core.contract_name.clone(), core);

    let strategies_target = &catalog.phase1_vanity_targets[3];
    let strategies = build_entry(
        repo_root,
        create2_factory,
        strategies_target,
        config,
        Bytes::from_static(&[]),
    )?;
    let strategies_address = strategies.predicted_address;
    phase1.insert(strategies.contract_name.clone(), strategies);

    let admin_target = &catalog.phase1_vanity_targets[4];
    let admin = build_entry(repo_root, create2_factory, admin_target, config, Bytes::from_static(&[]))?;
    let admin_address = admin.predicted_address;
    phase1.insert(admin.contract_name.clone(), admin);

    let batcher_target = &catalog.phase1_vanity_targets[5];
    let batcher_args = encode(&[
        Token::Address(inputs.registry),
        Token::Address(store_address),
        Token::Address(deployer_address),
        Token::Address(inputs.protocol_treasury),
        Token::Address(inputs.pool_manager),
        Token::Address(inputs.tax_hook),
        Token::Address(inputs.chainlink_eth_usd),
        Token::Address(inputs.vault_activation_batcher),
        Token::Address(inputs.lottery_manager),
        Token::Address(inputs.permit2),
        Token::Address(inputs.usdc),
        Token::Address(inputs.uniswap_v3_factory),
        Token::Address(inputs.uniswap_router),
        Token::Address(inputs.ajna_factory),
        Token::Address(core_address),
        Token::Address(strategies_address),
        Token::Address(admin_address),
    ]);
    let batcher = build_entry(
        repo_root,
        create2_factory,
        batcher_target,
        config,
        Bytes::from(batcher_args),
    )?;
    let batcher_address = batcher.predicted_address;
    phase1.insert(batcher.contract_name.clone(), batcher);

    let derived = derive_constructor_children(batcher_address, &catalog.derived_targets)?
        .into_iter()
        .map(|item| {
            let target = catalog
                .derived_targets
                .iter()
                .find(|target| target.contract_name == item.contract_name)
                .expect("derived target should exist");

            (
                item.contract_name.clone(),
                ManifestDerivedEntry {
                    contract_name: item.contract_name,
                    deployment_kind: target.deployment_kind.clone(),
                    artifact_path: target.artifact_path.clone(),
                    parent_contract_name: target.parent_contract_name.clone(),
                    parent_create_nonce: target.parent_create_nonce,
                    suffix_required: target.suffix_required,
                    predicted_address: item.predicted_address,
                    reason: target.reason.clone(),
                },
            )
        })
        .collect();

    Ok(VanityManifest {
        version: 1,
        chain: catalog.chain.clone(),
        chain_id: catalog.chain_id,
        vanity_suffix: config.suffix.clone(),
        epoch_tag: config.epoch_tag.clone(),
        catalog_path: relative_path(repo_root, catalog_path),
        create2_factory,
        inputs,
        phase1,
        derived,
    })
}

pub fn render_env_exports(manifest_path: &Path, manifest: &VanityManifest) -> String {
    let mut lines = vec![format!(
        "export INFRA_VANITY_MANIFEST_PATH=\"{}\"",
        manifest_path.display()
    )];

    for entry in manifest.phase1.values() {
        lines.push(format!("export {}={:#x}", entry.salt_env, entry.raw_salt));
    }

    lines.join("\n")
}

fn build_entry(
    repo_root: &Path,
    create2_factory: Address,
    target: &Phase1VanityTarget,
    config: &BuildConfig,
    constructor_args: Bytes,
) -> Result<ManifestPhase1Entry> {
    let creation_code = load_creation_code(repo_root, &target.artifact_path)?;
    let init_code = concat_bytes(&creation_code, constructor_args.as_ref());
    let init_code_hash = H256::from(keccak256(&init_code));
    let constructor_args_hash = H256::from(keccak256(constructor_args.as_ref()));
    let seed_tag = if config.use_reference_salts {
        target.reference_salt_tag.clone()
    } else {
        target
            .default_salt_tag_template
            .replace("{epoch}", &config.epoch_tag)
    };
    let seed_hash = H256::from(keccak256(seed_tag.as_bytes()));
    let search = if config.use_reference_salts {
        SearchResult {
            raw_salt: seed_hash,
            predicted_address: predict_create2_address(create2_factory, seed_hash, init_code_hash),
            attempts: 0,
        }
    } else {
        find_salt_for_suffix(
            create2_factory,
            init_code_hash,
            seed_hash,
            &config.suffix,
            config.max_attempts,
        )?
    };

    Ok(ManifestPhase1Entry {
        contract_name: target.contract_name.clone(),
        deployment_kind: target.deployment_kind.clone(),
        artifact_path: target.artifact_path.clone(),
        salt_env: target.salt_env.clone(),
        salt_tag_env: target.salt_tag_env.clone(),
        default_salt_tag_template: target.default_salt_tag_template.clone(),
        reference_salt_tag: target.reference_salt_tag.clone(),
        seed_tag,
        raw_salt: search.raw_salt,
        seed_hash,
        search_attempts: search.attempts,
        suffix_required: target.suffix_required,
        constructor_args_hex: format!("0x{}", hex::encode(constructor_args.as_ref())),
        constructor_args_hash,
        init_code_hash,
        predicted_address: search.predicted_address,
    })
}

fn load_creation_code(repo_root: &Path, artifact_path: &str) -> Result<Vec<u8>> {
    let path = repo_root.join(artifact_path);
    let artifact: ArtifactFile = serde_json::from_str(&fs::read_to_string(&path)?)?;
    let object = artifact.bytecode.object.strip_prefix("0x").unwrap_or(&artifact.bytecode.object);
    Ok(hex::decode(object)?)
}

fn concat_bytes(left: &[u8], right: &[u8]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(left.len() + right.len());
    bytes.extend_from_slice(left);
    bytes.extend_from_slice(right);
    bytes
}

fn parse_address(value: &str) -> Result<Address> {
    value
        .parse()
        .map_err(|_| anyhow!("invalid address in catalog: {value}"))
}

fn relative_path(repo_root: &Path, path: &Path) -> String {
    path.strip_prefix(repo_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}
