use std::{fs, path::PathBuf};

use anyhow::Result;
use clap::{Parser, Subcommand};
use ethers_core::types::{Address, H256};
use vanity_salt_grinder::{catalog, per_vault, planner, repo_root};

#[derive(Debug, Parser)]
#[command(
    author,
    version,
    about = "Generate vanity CREATE2 salts and a verified shared-infra manifest"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
    #[arg(
        long,
        default_value = "deployments/base/shared-global-vanity-targets.json"
    )]
    catalog: PathBuf,
    #[arg(long, default_value = "v1.8.1")]
    epoch_tag: String,
    #[arg(long, default_value = "4626")]
    suffix: String,
    #[arg(long, default_value_t = 5_000_000)]
    max_attempts: u64,
    #[arg(long, default_value = "deployments/base/v1.8.1-vanity-manifest.json")]
    out: PathBuf,
    #[arg(long)]
    print_env: bool,
    #[arg(long)]
    use_reference_salts: bool,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Search deployment-version suffixes for per-vault CREATE2 vanity targets.
    PerVaultVersion {
        #[arg(long)]
        create2_deployer: Address,
        #[arg(long)]
        creator_token: Address,
        #[arg(long)]
        owner: Address,
        #[arg(long, default_value_t = 8453)]
        chain_id: u64,
        #[arg(long)]
        base_version: String,
        #[arg(long)]
        vault_prefix: Option<String>,
        #[arg(long)]
        share_suffix: Option<String>,
        #[arg(long, default_value_t = 250_000)]
        max_attempts: u64,
        #[arg(long)]
        vault_init_code_hash: Option<H256>,
        #[arg(long)]
        share_oft_init_code_hash: Option<H256>,
        #[arg(long)]
        share_symbol: Option<String>,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    if let Some(command) = cli.command {
        return run_command(command);
    }

    let repo = repo_root();
    let catalog_path = repo.join(&cli.catalog);
    let manifest_path = repo.join(&cli.out);

    let catalog = catalog::load_catalog(&catalog_path)?;
    let manifest = planner::build_manifest(
        &repo,
        &catalog_path,
        &catalog,
        &planner::BuildConfig {
            epoch_tag: cli.epoch_tag,
            suffix: cli.suffix,
            max_attempts: cli.max_attempts,
            use_reference_salts: cli.use_reference_salts,
        },
    )?;

    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&manifest_path, serde_json::to_string_pretty(&manifest)?)?;

    println!("wrote {}", manifest_path.display());
    if cli.print_env {
        println!("{}", planner::render_env_exports(&manifest_path, &manifest));
    }

    Ok(())
}

fn run_command(command: Command) -> Result<()> {
    match command {
        Command::PerVaultVersion {
            create2_deployer,
            creator_token,
            owner,
            chain_id,
            base_version,
            vault_prefix,
            share_suffix,
            max_attempts,
            vault_init_code_hash,
            share_oft_init_code_hash,
            share_symbol,
        } => {
            let result =
                per_vault::find_per_vault_version(&per_vault::PerVaultVersionSearchConfig {
                    create2_deployer,
                    creator_token,
                    owner,
                    chain_id,
                    base_version,
                    vault_prefix,
                    share_suffix,
                    max_attempts,
                    vault_init_code_hash,
                    share_oft_init_code_hash,
                    share_symbol,
                })?;
            println!("{}", serde_json::to_string_pretty(&result)?);
            Ok(())
        }
    }
}
