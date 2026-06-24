import type React from 'react';
import DocSidebarDesktopContent from '@theme-original/DocSidebar/Desktop/Content';
import PersonaSwitcher from '@site/src/components/PersonaSwitcher';
import {usePersona} from '@site/src/hooks/usePersona';
import {filterSidebarByPersona} from '@site/src/lib/personas';

export default function DocSidebarDesktopContentWrapper(
  props: React.ComponentProps<typeof DocSidebarDesktopContent>,
): React.JSX.Element {
  const [persona, setPersona] = usePersona();
  const sidebar = filterSidebarByPersona(props.sidebar, persona);

  return (
    <>
      <PersonaSwitcher value={persona} onChange={setPersona} />
      <DocSidebarDesktopContent {...props} sidebar={sidebar} />
    </>
  );
}
