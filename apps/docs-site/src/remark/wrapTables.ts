import type {Plugin} from 'unified';
import type {Parent, Root} from 'mdast';
import {visit} from 'unist-util-visit';

/**
 * Wraps markdown tables in <div class="table-wrap"> for horizontal scroll on narrow viewports.
 */
const remarkWrapTables: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'table', (node, index, parent) => {
      if (!parent || typeof index !== 'number') {
        return;
      }

      const wrapper = {
        type: 'div',
        data: {
          hName: 'div',
          hProperties: {className: ['table-wrap']},
        },
        children: [node],
      };

      (parent as Parent).children.splice(index, 1, wrapper as never);
    });
  };
};

export default remarkWrapTables;
