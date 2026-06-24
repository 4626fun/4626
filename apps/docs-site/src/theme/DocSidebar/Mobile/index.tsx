import React from 'react';
import clsx from 'clsx';
import {
  NavbarSecondaryMenuFiller,
  ThemeClassNames,
} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import DocSidebarItems from '@theme/DocSidebarItems';
import type {Props} from '@theme/DocSidebar/Mobile';
import PersonaSwitcher from '@site/src/components/PersonaSwitcher';
import {usePersona} from '@site/src/hooks/usePersona';
import {filterSidebarByPersona} from '@site/src/lib/personas';

/**
 * The mobile sidebar is rendered into the navbar's slide-out secondary menu via
 * `NavbarSecondaryMenuFiller` (a portal-like filler), NOT inline where the
 * component is mounted. The previous override wrapped `@theme-original`'s filler
 * in a visible `<div>` alongside the PersonaSwitcher, so the switcher landed in
 * the `.theme-doc-sidebar-container` — which is `display: none` on mobile — and
 * never appeared in the drawer.
 *
 * This version injects the PersonaSwitcher (and persona filtering) *inside* the
 * filler content, so both the switcher and the filtered nav render correctly in
 * the mobile drawer.
 */
function DocSidebarMobileSecondaryMenu({sidebar, path}: Props): React.JSX.Element {
  const mobileSidebar = useNavbarMobileSidebar();
  const [persona, setPersona] = usePersona();
  const filteredSidebar = filterSidebarByPersona(sidebar, persona);

  return (
    <div className="doc-sidebar-mobile-shell">
      <PersonaSwitcher value={persona} onChange={setPersona} />
      <ul className={clsx(ThemeClassNames.docs.docSidebarMenu, 'menu__list')}>
        <DocSidebarItems
          items={filteredSidebar}
          activePath={path}
          onItemClick={(item) => {
            // Mobile sidebar should only be closed if the category has a link
            if (item.type === 'category' && item.href) {
              mobileSidebar.toggle();
            }
            if (item.type === 'link') {
              mobileSidebar.toggle();
            }
          }}
          level={1}
        />
      </ul>
    </div>
  );
}

function DocSidebarMobile(props: Props): React.JSX.Element {
  return (
    <NavbarSecondaryMenuFiller
      component={DocSidebarMobileSecondaryMenu}
      props={props}
    />
  );
}

export default React.memo(DocSidebarMobile);
