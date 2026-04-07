pub mod catalog;
pub mod ethereum;
pub mod planner;
pub mod search;

use std::path::{Path, PathBuf};

pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(2)
        .expect("crate should live under <repo>/tools/vanity-salt-grinder")
        .to_path_buf()
}

#[cfg(test)]
mod tests {
    use ethers_core::types::{Address, H256};
    use ethers_core::utils::keccak256;

    use crate::{catalog, planner, repo_root, search};

    #[test]
    fn loads_repo_catalog_and_phase1_targets() {
        let catalog_path = repo_root().join("deployments/base/shared-global-vanity-targets.json");
        let catalog = catalog::load_catalog(&catalog_path).expect("catalog should load");

        assert_eq!(catalog.chain, "base");
        assert_eq!(catalog.phase1_vanity_targets.len(), 6);
        assert_eq!(catalog.phase1_vanity_targets[0].contract_name, "UniversalBytecodeStoreV2");
        assert_eq!(catalog.deferred_targets.len(), 5);
        assert_eq!(catalog.rename_candidates.len(), 1);
    }

    #[test]
    fn derives_current_batcher_children_from_catalog_nonces() {
        let catalog_path = repo_root().join("deployments/base/shared-global-vanity-targets.json");
        let catalog = catalog::load_catalog(&catalog_path).expect("catalog should load");
        let batcher: Address = "0x14435cc4A8D307b4d3979148E5AB71Af1ed19088"
            .parse()
            .expect("valid batcher address");

        let derived = planner::derive_constructor_children(batcher, &catalog.derived_targets)
            .expect("derived helper addresses should resolve");

        assert_eq!(derived.len(), 2);
        assert_eq!(
            derived[0].predicted_address,
            "0x74F204C95F959B7f4f4e927B6c56CF1026f4789F"
                .parse::<Address>()
                .expect("valid phase3 helper address")
        );
        assert_eq!(
            derived[1].predicted_address,
            "0xc6AF971f8fD0F1F98C73199D9b2B391Eaa848C9b"
                .parse::<Address>()
                .expect("valid uniV4 helper address")
        );
    }

    #[test]
    fn finds_create2_salt_for_requested_suffix() {
        let deployer: Address = "0x4e59b44847b379578588920cA78FbF26c0B4956C"
            .parse()
            .expect("valid create2 factory");
        let init_code_hash = H256::from(keccak256(b"demo-init-code"));
        let seed = H256::from(keccak256(b"demo-seed"));

        let result =
            search::find_salt_for_suffix(deployer, init_code_hash, seed, "26", 100_000).expect("suffix should be found");

        assert!(result.predicted_address.to_string().to_lowercase().ends_with("26"));
    }

    #[test]
    fn builds_fresh_v181_manifest_with_vanity_suffixes() {
        let catalog_path = repo_root().join("deployments/base/shared-global-vanity-targets.json");
        let catalog = catalog::load_catalog(&catalog_path).expect("catalog should load");

        let manifest = planner::build_manifest(
            &repo_root(),
            &catalog_path,
            &catalog,
            &planner::BuildConfig {
                epoch_tag: "v1.8.1".to_owned(),
                suffix: "4626".to_owned(),
                max_attempts: 2_000_000,
                use_reference_salts: false,
            },
        )
        .expect("fresh vanity plan should build");

        assert_eq!(manifest.epoch_tag, "v1.8.1");

        for entry in manifest.phase1.values() {
            assert!(
                entry.predicted_address.to_string().to_ascii_lowercase().ends_with("4626"),
                "{} should end with 4626",
                entry.contract_name
            );
            assert!(entry.search_attempts > 0, "{} should be actively ground", entry.contract_name);
        }

        let batcher = manifest.phase1["DeploymentBatcher"].predicted_address;
        let derived = planner::derive_constructor_children(batcher, &catalog.derived_targets)
            .expect("derived helpers should resolve from fresh batcher");

        assert_eq!(
            manifest.derived["DeploymentBatcherPhase3Helper"].predicted_address,
            derived[0].predicted_address
        );
        assert_eq!(
            manifest.derived["DeploymentBatcherUniV4Helper"].predicted_address,
            derived[1].predicted_address
        );
    }
}
