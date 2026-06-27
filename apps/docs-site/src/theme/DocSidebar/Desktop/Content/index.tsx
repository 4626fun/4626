import type React from 'react';
import DocSidebarDesktopContent from '@theme-original/DocSidebar/Desktop/Content';
import SidebarCollapseControls from '@site/src/components/SidebarCollapseControls';

/** Curated product docs use a single sidebar IA — no persona filter. */
export default function DocSidebarDesktopContentWrapper(
  props: React.ComponentProps<typeof DocSidebarDesktopContent>,
): React.JSX.Element {
  return (
    <>
      <SidebarCollapseControls />
      <DocSidebarDesktopContent {...props} />
    </>
  );
}
