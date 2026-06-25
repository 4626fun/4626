import React from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import NavbarItem from '@theme/NavbarItem';
import {useMobileNavbarPanel} from '@site/src/lib/mobileNavbarPanel';

function useNavbarItems() {
  return useThemeConfig().navbar.items;
}

export default function NavbarMobilePrimaryMenu(): React.JSX.Element {
  const mobileSidebar = useNavbarMobileSidebar();
  const {showDocsPanel} = useMobileNavbarPanel();
  const items = useNavbarItems();

  return (
    <ul className="menu__list">
      <li className="menu__list-item">
        <button
          type="button"
          className="menu__link mobile-navbar-docs-entry"
          onClick={showDocsPanel}>
          Documentation
        </button>
      </li>
      {items.map((item, i) => (
        <NavbarItem
          mobile
          {...item}
          onClick={() => mobileSidebar.toggle()}
          key={i}
        />
      ))}
    </ul>
  );
}
