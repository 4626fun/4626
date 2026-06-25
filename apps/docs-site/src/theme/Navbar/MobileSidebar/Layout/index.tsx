import React, {version, useEffect, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import {
  useNavbarMobileSidebar,
  useNavbarSecondaryMenu,
} from '@docusaurus/theme-common/internal';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {
  MobileNavbarPanelContext,
  type MobileNavbarPanelApi,
} from '@site/src/lib/mobileNavbarPanel';

function inertProps(inert: boolean): {inert?: boolean | ''} {
  const isBeforeReact19 = parseInt(version.split('.')[0], 10) < 19;
  if (isBeforeReact19) {
    return {inert: inert ? '' : undefined};
  }
  return {inert};
}

function NavbarMobileSidebarPanel({
  children,
  inert,
}: {
  children: React.ReactNode;
  inert: boolean;
}): React.JSX.Element {
  return (
    <div
      className={clsx(
        ThemeClassNames.layout.navbar.mobileSidebar.panel,
        'navbar-sidebar__item menu',
      )}
      {...inertProps(inert)}>
      {children}
    </div>
  );
}

type Props = {
  header: React.ReactNode;
  primaryMenu: React.ReactNode;
  secondaryMenu: React.ReactNode;
};

/** Mobile drawer: primary site nav first; docs tree via "Documentation". */
export default function NavbarMobileSidebarLayout({
  header,
  primaryMenu,
  secondaryMenu,
}: Props): React.JSX.Element {
  const mobileSidebar = useNavbarMobileSidebar();
  const {hide: hideSecondaryMenu} = useNavbarSecondaryMenu();
  const [docsPanelOpen, setDocsPanelOpen] = useState(false);
  const wasSidebarShown = useRef(mobileSidebar.shown);

  useEffect(() => {
    const justOpened = mobileSidebar.shown && !wasSidebarShown.current;
    wasSidebarShown.current = mobileSidebar.shown;

    if (!mobileSidebar.shown) {
      setDocsPanelOpen(false);
      hideSecondaryMenu();
      return;
    }

    if (justOpened) {
      hideSecondaryMenu();
      setDocsPanelOpen(false);
    }
  }, [mobileSidebar.shown, hideSecondaryMenu]);

  const panelApi = useMemo<MobileNavbarPanelApi>(
    () => ({
      showDocsPanel: () => setDocsPanelOpen(true),
      hideDocsPanel: () => setDocsPanelOpen(false),
    }),
    [],
  );

  return (
    <MobileNavbarPanelContext.Provider value={panelApi}>
      <div
        className={clsx(
          ThemeClassNames.layout.navbar.mobileSidebar.container,
          'navbar-sidebar',
        )}>
        {header}
        <div
          className={clsx('navbar-sidebar__items', {
            'navbar-sidebar__items--show-secondary': docsPanelOpen,
          })}>
          <NavbarMobileSidebarPanel inert={docsPanelOpen}>
            {primaryMenu}
          </NavbarMobileSidebarPanel>
          <NavbarMobileSidebarPanel inert={!docsPanelOpen}>
            {secondaryMenu}
          </NavbarMobileSidebarPanel>
        </div>
      </div>
    </MobileNavbarPanelContext.Provider>
  );
}
