use ethers_core::types::{Address, H256};
use serde::Deserialize;

use crate::per_vault::{find_per_vault_version, PerVaultVersionSearchConfig};

static mut LAST_OUTPUT_PTR: *mut u8 = core::ptr::null_mut();
static mut LAST_OUTPUT_LEN: usize = 0;
static mut LAST_OUTPUT_CAP: usize = 0;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PerVaultVersionInput {
    create2_deployer: String,
    creator_token: String,
    owner: String,
    chain_id: u64,
    base_version: String,
    vault_prefix: Option<String>,
    share_suffix: Option<String>,
    start_attempt: Option<u64>,
    max_attempts: u64,
    vault_init_code_hash: Option<String>,
    share_oft_init_code_hash: Option<String>,
    share_symbol: Option<String>,
}

#[no_mangle]
pub extern "C" fn vanity_alloc(len: usize) -> *mut u8 {
    let mut bytes = Vec::with_capacity(len);
    let ptr = bytes.as_mut_ptr();
    core::mem::forget(bytes);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn vanity_dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() {
        return;
    }
    drop(Vec::from_raw_parts(ptr, 0, len));
}

#[no_mangle]
pub unsafe extern "C" fn per_vault_version_search(input_ptr: *const u8, input_len: usize) -> i32 {
    let input = core::slice::from_raw_parts(input_ptr, input_len);
    let result = run_per_vault_version_search(input);
    replace_last_output(result.into_bytes());
    1
}

#[no_mangle]
pub unsafe extern "C" fn vanity_output_ptr() -> *const u8 {
    LAST_OUTPUT_PTR
}

#[no_mangle]
pub unsafe extern "C" fn vanity_output_len() -> usize {
    LAST_OUTPUT_LEN
}

unsafe fn replace_last_output(mut next: Vec<u8>) {
    if !LAST_OUTPUT_PTR.is_null() {
        drop(Vec::from_raw_parts(
            LAST_OUTPUT_PTR,
            LAST_OUTPUT_LEN,
            LAST_OUTPUT_CAP,
        ));
    }
    LAST_OUTPUT_PTR = next.as_mut_ptr();
    LAST_OUTPUT_LEN = next.len();
    LAST_OUTPUT_CAP = next.capacity();
    core::mem::forget(next);
}

fn run_per_vault_version_search(input: &[u8]) -> String {
    match run_per_vault_version_search_inner(input) {
        Ok(json) => json,
        Err(message) => serde_json::json!({
            "ok": false,
            "error": message,
        })
        .to_string(),
    }
}

fn run_per_vault_version_search_inner(input: &[u8]) -> Result<String, String> {
    let request: PerVaultVersionInput =
        serde_json::from_slice(input).map_err(|err| format!("invalid input json: {err}"))?;
    let config = PerVaultVersionSearchConfig {
        create2_deployer: parse_address(&request.create2_deployer, "create2Deployer")?,
        creator_token: parse_address(&request.creator_token, "creatorToken")?,
        owner: parse_address(&request.owner, "owner")?,
        chain_id: request.chain_id,
        base_version: request.base_version,
        vault_prefix: request.vault_prefix,
        share_suffix: request.share_suffix,
        start_attempt: request.start_attempt.unwrap_or(0),
        max_attempts: request.max_attempts,
        vault_init_code_hash: parse_optional_h256(
            request.vault_init_code_hash.as_deref(),
            "vaultInitCodeHash",
        )?,
        share_oft_init_code_hash: parse_optional_h256(
            request.share_oft_init_code_hash.as_deref(),
            "shareOftInitCodeHash",
        )?,
        share_symbol: request.share_symbol,
    };
    let result = find_per_vault_version(&config).map_err(|err| err.to_string())?;
    serde_json::to_string(&serde_json::json!({
        "ok": true,
        "result": result,
    }))
    .map_err(|err| format!("failed to encode result: {err}"))
}

fn parse_address(value: &str, label: &str) -> Result<Address, String> {
    value
        .parse()
        .map_err(|_| format!("{label} must be a valid EVM address"))
}

fn parse_optional_h256(value: Option<&str>, label: &str) -> Result<Option<H256>, String> {
    let Some(value) = value else {
        return Ok(None);
    };
    value
        .parse()
        .map(Some)
        .map_err(|_| format!("{label} must be a valid bytes32 hex string"))
}
