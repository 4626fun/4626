import type React from 'react';
import DocSidebarDesktopContent from '@theme-original/DocSidebar/Desktop/Content';
import SidebarCollapseControls from '@site/src/components/SidebarCollapseControls';

/** Curated product docs — full sidebar, collapse controls at bottom. */
export default function DocSidebarDesktopContentWrapper(
  props: React.ComponentProps<typeof DocSidebarDesktopContent>,
): React.JSX.Element {
  return (
    <>
      <DocSidebarDesktopContent {...props} />
      <SidebarCollapseControls />
    </>
  );
}
