import {useCallback, useEffect, useState} from 'react';
import {useLocation} from '@docusaurus/router';
import {
  detectPersonaFromPath,
  type PersonaId,
} from '@site/src/lib/personas';

const STORAGE_KEY = '4626-docs-persona';

function readStoredPersona(): PersonaId | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (
    stored === 'all' ||
    stored === 'overview' ||
    stored === 'users' ||
    stored === 'creators' ||
    stored === 'developers' ||
    stored === 'integrators' ||
    stored === 'operators' ||
    stored === 'trust' ||
    stored === 'reference'
  ) {
    return stored;
  }
  return null;
}

export function usePersona(): [PersonaId, (next: PersonaId) => void] {
  const {pathname} = useLocation();
  const [persona, setPersonaState] = useState<PersonaId>(() => {
    return readStoredPersona() ?? detectPersonaFromPath(pathname) ?? 'all';
  });

  useEffect(() => {
    const stored = readStoredPersona();
    if (stored) {
      setPersonaState(stored);
      return;
    }
    const detected = detectPersonaFromPath(pathname);
    if (detected) {
      setPersonaState(detected);
    }
  }, [pathname]);

  const setPersona = useCallback((next: PersonaId) => {
    setPersonaState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return [persona, setPersona];
}
