import React from 'react';
import clsx from 'clsx';
import {
  NavbarSecondaryMenuFiller,
  ThemeClassNames,
} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import DocSidebarItems from '@theme/DocSidebarItems';
import SidebarCollapseControls from '@site/src/components/SidebarCollapseControls';
import type {Props} from '@theme/DocSidebar/Mobile';

function DocSidebarMobileSecondaryMenu({sidebar, path}: Props): React.JSX.Element {
  const mobileSidebar = useNavbarMobileSidebar();

  return (
    <div className="doc-sidebar-mobile-shell">
      <ul className={clsx(ThemeClassNames.docs.docSidebarMenu, 'menu__list')}>
        <DocSidebarItems
          items={sidebar}
          activePath={path}
          onItemClick={(item) => {
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
      <SidebarCollapseControls />
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
