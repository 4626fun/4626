import React from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import {useNavbarSecondaryMenu} from '@docusaurus/theme-common/internal';
import Translate from '@docusaurus/Translate';
import {useMobileNavbarPanel} from '@site/src/lib/mobileNavbarPanel';

function SecondaryMenuBackButton(
  props: React.ComponentProps<'button'>,
): React.JSX.Element {
  return (
    <button {...props} type="button" className="clean-btn navbar-sidebar__back">
      <Translate
        id="theme.navbar.mobileSidebarSecondaryMenu.backButtonLabel"
        description="The label of the back button to return to main menu, inside the mobile navbar sidebar secondary menu (notably used to display the docs sidebar)">
        ← Back to main menu
      </Translate>
    </button>
  );
}

export default function NavbarMobileSidebarSecondaryMenu(): React.JSX.Element {
  const isPrimaryMenuEmpty = useThemeConfig().navbar.items.length === 0;
  const secondaryMenu = useNavbarSecondaryMenu();
  const {hideDocsPanel} = useMobileNavbarPanel();

  const handleBack = () => {
    hideDocsPanel();
    secondaryMenu.hide();
  };

  return (
    <>
      {!isPrimaryMenuEmpty && (
        <SecondaryMenuBackButton onClick={handleBack} />
      )}
      {secondaryMenu.content}
    </>
  );
}
