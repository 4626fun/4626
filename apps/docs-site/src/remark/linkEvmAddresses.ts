import type {Link, PhrasingContent, Root} from 'mdast';
import type {Plugin} from 'unified';
import {visit} from 'unist-util-visit';
import {
  basescanAddressUrl,
  evmLinkProperties,
  isEvmAddress,
  shortenEvmAddress,
  splitTextForEvmAddresses,
} from './evmLinks';

function makeAddressLink(address: string, label?: string): Link {
  return {
    type: 'link',
    url: basescanAddressUrl(address),
    title: address,
    data: {
      hProperties: evmLinkProperties(address),
    },
    children: [{type: 'text', value: label ?? shortenEvmAddress(address)}],
  };
}

function replaceTextNode(
  text: string,
  index: number,
  parent: {children: PhrasingContent[]},
): void {
  if (!/\b0x[a-fA-F0-9]{40}\b/.test(text)) {
    return;
  }

  const parts = splitTextForEvmAddresses(text);
  if (parts.length <= 1 && parts[0]?.type === 'text') {
    return;
  }

  const nodes: PhrasingContent[] = parts.map((part) => {
    if (part.type === 'link') {
      return makeAddressLink(part.address, part.value);
    }
    return {type: 'text', value: part.value};
  });

  parent.children.splice(index, 1, ...nodes);
}

/**
 * Turn EVM addresses into BaseScan links (plain text and inline code).
 */
const remarkLinkEvmAddresses: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'inlineCode', (node, index, parent) => {
      if (!parent || typeof index !== 'number' || !isEvmAddress(node.value)) {
        return;
      }

      parent.children.splice(index, 1, makeAddressLink(node.value, node.value));
    });

    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number') {
        return;
      }

      const parentType = (parent as {type?: string}).type;
      if (parentType === 'link' || parentType === 'code') {
        return;
      }

      replaceTextNode(node.value, index, parent as {children: PhrasingContent[]});
    });
  };
};

export default remarkLinkEvmAddresses;
