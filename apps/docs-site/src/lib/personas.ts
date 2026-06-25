import type {PropSidebarItem} from '@docusaurus/plugin-content-docs';

export type PersonaId =
  | 'all'
  | 'start'
  | 'guides'
  | 'product'
  | 'developers'
  | 'integrators'
  | 'operators'
  | 'trust'
  | 'reference';

export type PersonaOption = {
  id: PersonaId;
  label: string;
  shortLabel: string;
  /** One-line summary shown under the pills when this persona is active. */
  description: string;
};

export const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: 'all',
    label: 'All docs',
    shortLabel: 'All',
    description: 'Full sidebar — every doc category.',
  },
  {
    id: 'start',
    label: 'Start',
    shortLabel: 'Start',
    description: 'Reading order, wallet roles, account model, and connection methods.',
  },
  {
    id: 'guides',
    label: 'Guides',
    shortLabel: 'Guides',
    description: 'Task guides for holders and creators — swap, explore, launch, deploy, troubleshoot.',
  },
  {
    id: 'product',
    label: 'Product',
    shortLabel: 'Product',
    description: 'System model — compressions, primitives, architecture, tokenomics, governance.',
  },
  {
    id: 'developers',
    label: 'Developers',
    shortLabel: 'Devs',
    description: 'Frontend architecture, monorepo loops — use the API navbar tab for HTTP/TSDoc reference.',
  },
  {
    id: 'integrators',
    label: 'Protocol integrators',
    shortLabel: 'Integrators',
    description: 'Contracts, OFT/LayerZero, and integration guides.',
  },
  {
    id: 'operators',
    label: 'Operators / SRE',
    shortLabel: 'Ops',
    description: 'Deploy runbooks, keepers, infra, and on-call procedures.',
  },
  {
    id: 'trust',
    label: 'Security & audits',
    shortLabel: 'Trust',
    description: 'Threat model, agent security, and external audit reports.',
  },
  {
    id: 'reference',
    label: 'Reference & legal',
    shortLabel: 'Reference',
    description: 'Addresses, glossary, chains, terms, and repo inventory.',
  },
];

export function getPersonaOption(id: PersonaId): PersonaOption {
  return PERSONA_OPTIONS.find((option) => option.id === id) ?? PERSONA_OPTIONS[0];
}

const PERSONA_CATEGORY_LABELS: Record<
  Exclude<PersonaId, 'all' | 'start'>,
  readonly string[]
> = {
  guides: ['Guides'],
  product: ['Product'],
  developers: ['Developers'],
  integrators: ['Protocol Integrators'],
  operators: ['Operators/SRE'],
  trust: ['Security', 'Audits'],
  reference: ['Reference', 'Legal'],
};

function categoryAllowed(label: string, persona: PersonaId): boolean {
  if (persona === 'all') {
    return true;
  }
  if (persona === 'start') {
    return label === 'Start';
  }
  return PERSONA_CATEGORY_LABELS[persona].includes(label);
}

/** Journey sidebar only — the API sidebar uses its own navbar tab. */
export function shouldApplyPersonaSidebarFilter(pathname: string): boolean {
  return !pathname.startsWith('/api');
}

export function filterSidebarByPersona(
  items: readonly PropSidebarItem[],
  persona: PersonaId,
): PropSidebarItem[] {
  if (persona === 'all') {
    return [...items];
  }

  return items.filter((item) => {
    if (item.type === 'category') {
      return categoryAllowed(item.label, persona);
    }
    return persona === 'all';
  });
}

export function normalizeStoredPersona(stored: string | null): PersonaId | null {
  if (stored === 'overview') {
    return 'start';
  }
  if (stored === 'users' || stored === 'creators') {
    return 'guides';
  }
  if (
    stored === 'all' ||
    stored === 'start' ||
    stored === 'guides' ||
    stored === 'product' ||
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

export function detectPersonaFromPath(pathname: string): PersonaId | null {
  const path = pathname.toLowerCase();

  if (
    path === '/' ||
    path.includes('/reading-order') ||
    path.includes('/wallet-architecture') ||
    path.includes('/account_model') ||
    path.includes('/4626-connection-methods')
  ) {
    return 'start';
  }
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
    path.includes('/compressions') ||
    path.includes('/primitives') ||
    path.includes('/governance') ||
    path.includes('/tokenomics') ||
    path.startsWith('/product')
  ) {
    return 'product';
  }
  if (
    path.includes('/contracts') ||
    path.includes('/protocols') ||
    path.includes('/integrations')
  ) {
    return 'integrators';
  }
  if (
    path.includes('/users') ||
    path.includes('/creators') ||
    path.includes('/getting-started') ||
    path.includes('/guides')
  ) {
    return 'guides';
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

  return null;
}
