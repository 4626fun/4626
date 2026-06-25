import type React from 'react';
import DocSidebarDesktopContent from '@theme-original/DocSidebar/Desktop/Content';
import PersonaSwitcher from '@site/src/components/PersonaSwitcher';
import SidebarCollapseControls from '@site/src/components/SidebarCollapseControls';
import {usePersona} from '@site/src/hooks/usePersona';
import {useLocation} from '@docusaurus/router';
import {filterSidebarByPersona, shouldApplyPersonaSidebarFilter} from '@site/src/lib/personas';

export default function DocSidebarDesktopContentWrapper(
  props: React.ComponentProps<typeof DocSidebarDesktopContent>,
): React.JSX.Element {
  const [persona, setPersona] = usePersona();
  const {pathname} = useLocation();
  const sidebar = shouldApplyPersonaSidebarFilter(pathname)
    ? filterSidebarByPersona(props.sidebar, persona)
    : props.sidebar;

  return (
    <>
      <PersonaSwitcher value={persona} onChange={setPersona} />
      <SidebarCollapseControls />
      <DocSidebarDesktopContent {...props} sidebar={sidebar} />
    </>
  );
}
