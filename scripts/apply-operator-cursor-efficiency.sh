#!/usr/bin/env bash
# Apply operator efficiency settings for 4626 Cursor workflow.
# Safe to re-run. Restores from backups if present.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GLOBAL_MCP="$HOME/.cursor/mcp.json"
BACKUP="$HOME/.cursor/mcp.json.backup-$(date +%Y%m%d)"

echo "== 4626 operator Cursor efficiency =="
echo

# Global MCP (optional — affects all projects)
if [[ -f "$GLOBAL_MCP" ]] && [[ ! -f "$BACKUP" ]]; then
  cp "$GLOBAL_MCP" "$BACKUP"
  echo "Backed up global MCP → $BACKUP"
fi

cat > "$GLOBAL_MCP" << 'EOF'
{
  "mcpServers": {
    "railway": {
      "args": ["mcp"],
      "command": "railway"
    },
    "supabase": {
      "headers": {},
      "url": "https://mcp.supabase.com/mcp?project_ref=qajpnuvqlcfseghnldkl"
    }
  }
}
EOF
echo "Global MCP pruned to railway + supabase"

# Project plugin toggles already in .cursor/settings.json
echo "Project plugins: see $ROOT/.cursor/settings.json (tierzero off, etc.)"

# Project MCP cleared — optional servers in mcp.optional.json
echo "Project MCP: empty (optional in .cursor/mcp.optional.json)"

echo
echo "MANUAL STEP REQUIRED — User Rules (Cursor UI):"
echo "  1. Open Cursor Settings → Rules → User Rules"
echo "  2. Replace with contents of: $ROOT/.cursor/USER_RULES_REPLACEMENT.md"
echo "  3. Reload window (Developer: Reload Window)"
echo
echo "Curated skills: $ROOT/.cursor/skills/CURATED_SKILLS.md"

# Global skill prune (Codex/Agents/Cursor user dirs)
bash "$ROOT/scripts/prune-cursor-skills.sh"

echo "Done."
