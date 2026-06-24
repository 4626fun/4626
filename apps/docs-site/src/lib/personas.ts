import type {PropSidebarItem} from '@docusaurus/plugin-content-docs';

export type PersonaId =
  | 'all'
  | 'overview'
  | 'users'
  | 'creators'
  | 'developers'
  | 'integrators'
  | 'operators'
  | 'trust'
  | 'reference';

export type PersonaOption = {
  id: PersonaId;
  label: string;
  shortLabel: string;
};

export const PERSONA_OPTIONS: PersonaOption[] = [
  {id: 'all', label: 'All docs', shortLabel: 'All'},
  {id: 'overview', label: 'Overview', shortLabel: 'Overview'},
  {id: 'users', label: 'Users', shortLabel: 'Users'},
  {id: 'creators', label: 'Creators', shortLabel: 'Creators'},
  {id: 'developers', label: 'Developers', shortLabel: 'Devs'},
  {id: 'integrators', label: 'Protocol integrators', shortLabel: 'Integrators'},
  {id: 'operators', label: 'Operators / SRE', shortLabel: 'Ops'},
  {id: 'trust', label: 'Security & audits', shortLabel: 'Trust'},
  {id: 'reference', label: 'Reference & legal', shortLabel: 'Reference'},
];

const ALWAYS_VISIBLE_DOC_IDS = new Set(['index', 'wallet-architecture']);

const PERSONA_CATEGORY_LABELS: Record<
  Exclude<PersonaId, 'all' | 'overview'>,
  readonly string[]
> = {
  users: ['Users', 'Legal'],
  creators: ['Creators'],
  developers: ['Developers', 'API Reference'],
  integrators: ['Protocol Integrators', 'API Reference'],
  operators: ['Operators/SRE'],
  trust: ['Security', 'Audits'],
  reference: ['Reference', 'Legal'],
};

function isAlwaysVisibleDoc(item: PropSidebarItem): boolean {
  return item.type === 'doc' && ALWAYS_VISIBLE_DOC_IDS.has(item.id);
}

function categoryAllowed(label: string, persona: PersonaId): boolean {
  if (persona === 'all') {
    return true;
  }
  if (persona === 'overview') {
    return false;
  }
  return PERSONA_CATEGORY_LABELS[persona].includes(label);
}

export function filterSidebarByPersona(
  items: PropSidebarItem[],
  persona: PersonaId,
): PropSidebarItem[] {
  if (persona === 'all') {
    return items;
  }

  return items.filter((item) => {
    if (isAlwaysVisibleDoc(item)) {
      return true;
    }
    if (item.type === 'category') {
      return categoryAllowed(item.label, persona);
    }
    return false;
  });
}

export function detectPersonaFromPath(pathname: string): PersonaId | null {
  const path = pathname.toLowerCase();

  if (
    path.includes('/operations/') ||
    path.startsWith('/operators') ||
    path.includes('/operations')
  ) {
    return 'operators';
  }
  if (path.includes('/security') || path.includes('/audits')) {
    return 'trust';
  }
  if (path.startsWith('/api') || path.includes('/api/')) {
    return 'developers';
  }
  if (
    path.includes('/contracts') ||
    path.includes('/protocols') ||
    path.includes('/integrations') ||
    path.includes('/compressions') ||
    path.includes('/primitives')
  ) {
    return 'integrators';
  }
  if (path.includes('/creators') || path.includes('/governance') || path.includes('/tokenomics')) {
    return 'creators';
  }
  if (
    path.includes('/users') ||
    path.includes('/getting-started') ||
    path.includes('/guides')
  ) {
    return 'users';
  }
  if (path.includes('/legal') || path.includes('/reference')) {
    return 'reference';
  }
  if (
    path.includes('/frontend') ||
    path.includes('/architecture') ||
    path.includes('/developers')
  ) {
    return 'developers';
  }
  if (path === '/' || path.includes('/wallet-architecture')) {
    return 'overview';
  }

  return null;
}
