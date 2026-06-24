import type React from 'react';
import DocItemTOCDesktop from '@theme-original/DocItem/TOC/Desktop';
import DocPageActions from '@site/src/components/DocPageActions';

export default function DocItemTOCDesktopWrapper(
  props: React.ComponentProps<typeof DocItemTOCDesktop>,
): React.JSX.Element {
  return (
    <div className="doc-toc-rail">
      <DocItemTOCDesktop {...props} />
      <DocPageActions />
    </div>
  );
}
