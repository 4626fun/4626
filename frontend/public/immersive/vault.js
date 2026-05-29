// 4626.fun — obsidian vault hero entry (procedural default, GLB optional, legacy fallback)

import { initObsidianVault } from './vault/obsidianScene.js';

const host = document.getElementById('vault-canvas');
if (host) {
  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get('vault');
  const dataMode = host.dataset.vaultSrc;

  let mode = 'procedural';
  if (urlMode === 'legacy' || dataMode === 'legacy') {
    import('./vault.legacy.js');
  } else {
    if (urlMode === 'glb' || dataMode === 'glb') mode = 'glb';
    const glbUrl = host.dataset.vaultGlb || undefined;
    initObsidianVault(host, { mode, glbUrl }).catch((err) => {
      console.error('[obsidian-vault] init failed:', err);
    });
  }
}
