import useIsBrowser from '@docusaurus/useIsBrowser';

const MAX_PASSES = 6;

function getSidebarMenu(): Element | null {
  return document.querySelector('.theme-doc-sidebar-menu');
}

function clickMatchingCarets(sidebar: Element, collapsed: boolean): number {
  const selector = collapsed
    ? '.menu__caret[aria-expanded="true"]'
    : '.menu__list-item--collapsed .menu__caret';
  const buttons = sidebar.querySelectorAll<HTMLButtonElement>(selector);
  buttons.forEach((button) => button.click());
  return buttons.length;
}

export function setAllSidebarCategories(collapsed: boolean): void {
  const sidebar = getSidebarMenu();
  if (!sidebar) {
    return;
  }

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const clicked = clickMatchingCarets(sidebar, collapsed);
    if (clicked === 0) {
      break;
    }
  }
}

export default function SidebarCollapseControls(): React.JSX.Element | null {
  const isBrowser = useIsBrowser();

  if (!isBrowser) {
    return null;
  }

  return (
    <div className="sidebar-collapse-controls" aria-label="Sidebar tree controls">
      <button
        type="button"
        className="sidebar-collapse-controls__button"
        onClick={() => setAllSidebarCategories(true)}>
        Collapse all
      </button>
      <button
        type="button"
        className="sidebar-collapse-controls__button"
        onClick={() => setAllSidebarCategories(false)}>
        Expand all
      </button>
    </div>
  );
}
