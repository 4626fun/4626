const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const EVM_ADDRESS_IN_TEXT = /\b0x[a-fA-F0-9]{40}\b/g;

export const BASESCAN_ADDRESS_URL = 'https://basescan.org/address';

export function basescanAddressUrl(address: string): string {
  return `${BASESCAN_ADDRESS_URL}/${address}`;
}

export function shortenEvmAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function isEvmAddress(value: string): boolean {
  return EVM_ADDRESS.test(value);
}

export function evmLinkProperties(title: string) {
  return {
    className: ['evm-address-link'],
    target: '_blank',
    rel: 'noopener noreferrer',
    title,
  };
}

export function splitTextForEvmAddresses(text: string) {
  const parts: Array<
    {type: 'text'; value: string} | {type: 'link'; value: string; address: string}
  > = [];
  let lastIndex = 0;

  for (const match of text.matchAll(EVM_ADDRESS_IN_TEXT)) {
    const address = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({type: 'text', value: text.slice(lastIndex, index)});
    }
    parts.push({
      type: 'link',
      value: shortenEvmAddress(address),
      address,
    });
    lastIndex = index + address.length;
  }

  if (lastIndex < text.length) {
    parts.push({type: 'text', value: text.slice(lastIndex)});
  }

  return parts;
}

export const GITHUB_REPO_BLOB = 'https://github.com/wenakita/4626/blob/main';

export function githubBlobUrl(path: string): string {
  return `${GITHUB_REPO_BLOB}/${path.replace(/^\//, '')}`;
}

export function repoPathLinkProperties() {
  return {
    className: ['repo-path-link'],
    target: '_blank',
    rel: 'noopener noreferrer',
  };
}

const REPO_PATH =
  /^(frontend|contracts|kpr|programs|apps|docs|\.github)\/[^\s`]+(?:\.(?:tsx?|jsx?|sol|mjs|yml|yaml|md|json|ts|sh))$/;

export function isRepoSourcePath(value: string): boolean {
  return REPO_PATH.test(value);
}
