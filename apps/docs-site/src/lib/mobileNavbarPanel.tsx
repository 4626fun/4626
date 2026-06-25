import {createContext, useContext} from 'react';

export type MobileNavbarPanelApi = {
  showDocsPanel: () => void;
  hideDocsPanel: () => void;
};

export const MobileNavbarPanelContext =
  createContext<MobileNavbarPanelApi | null>(null);

export function useMobileNavbarPanel(): MobileNavbarPanelApi {
  const value = useContext(MobileNavbarPanelContext);
  if (!value) {
    throw new Error(
      'useMobileNavbarPanel must be used within the mobile navbar sidebar layout',
    );
  }
  return value;
}
