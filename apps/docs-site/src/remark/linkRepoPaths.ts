import type {Link, Root} from 'mdast';
import type {Plugin} from 'unified';
import {visit} from 'unist-util-visit';
import {githubBlobUrl, isRepoSourcePath, repoPathLinkProperties} from './evmLinks';

/**
 * Link inline-code repo paths to GitHub source (e.g. `frontend/api/.../file.ts`).
 */
const remarkLinkRepoPaths: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'inlineCode', (node, index, parent) => {
      if (!parent || typeof index !== 'number' || !isRepoSourcePath(node.value)) {
        return;
      }

      const link: Link = {
        type: 'link',
        url: githubBlobUrl(node.value),
        title: node.value,
        data: {
          hProperties: repoPathLinkProperties(),
        },
        children: [{type: 'text', value: node.value}],
      };

      parent.children.splice(index, 1, link);
    });
  };
};

export default remarkLinkRepoPaths;
