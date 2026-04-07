use std::{fs, path::PathBuf};

use anyhow::Result;
use clap::Parser;
use vanity_salt_grinder::{catalog, planner, repo_root};

#[derive(Debug, Parser)]
#[command(author, version, about = "Generate vanity CREATE2 salts and a verified shared-infra manifest")]
struct Cli {
    #[arg(long, default_value = "deployments/base/shared-global-vanity-targets.json")]
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

fn main() -> Result<()> {
    let cli = Cli::parse();
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
