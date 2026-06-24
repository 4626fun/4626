import type React from 'react';
import DocSidebarMobile from '@theme-original/DocSidebar/Mobile';
import PersonaSwitcher from '@site/src/components/PersonaSwitcher';
import {usePersona} from '@site/src/hooks/usePersona';
import {filterSidebarByPersona} from '@site/src/lib/personas';

export default function DocSidebarMobileWrapper(
  props: React.ComponentProps<typeof DocSidebarMobile>,
): React.JSX.Element {
  const [persona, setPersona] = usePersona();
  const sidebar = filterSidebarByPersona(props.sidebar, persona);

  return (
    <div className="doc-sidebar-mobile-shell">
      <PersonaSwitcher value={persona} onChange={setPersona} />
      <DocSidebarMobile {...props} sidebar={sidebar} />
    </div>
  );
}
