## Archived Snapshot Dependency Note

This directory is an audit source snapshot, not an actively built or shipped module in this repository.

The previous root Go module manifests (`go.mod` / `go.sum`) were removed to prevent GitHub dependency scanning from treating this archived snapshot as a runtime dependency surface for `4626`.

Context:
- Alerts were opened for `github.com/jackc/pgproto3/v2` and `github.com/pion/dtls/v2` under this snapshot path.
- `github.com/pion/dtls/v2` does not currently publish a consumable patched `v2` module release for the reported advisory path.
- Keeping this snapshot as a live module would continue to surface non-runtime alerts on the default branch.

If this snapshot must be built again in the future, regenerate module manifests from the upstream source at that time and resolve dependencies against then-current patched releases.
