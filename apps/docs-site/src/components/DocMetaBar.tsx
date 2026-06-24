import type {ReactNode} from 'react';

type DocFrontMatter = {
  status?: string;
  last_updated?: string;
  last_reviewed?: string;
  owner?: string;
  audience?: string | string[];
  stage?: string;
  hide_doc_meta?: boolean;
};

type DocMetaBarProps = {
  frontMatter: DocFrontMatter;
};

function formatAudience(audience: string | string[] | undefined): string[] {
  if (!audience) return [];
  return Array.isArray(audience) ? audience : [audience];
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'current' || normalized === 'active') {
    return 'doc-meta__badge--current';
  }
  if (normalized === 'draft' || normalized === 'review') {
    return 'doc-meta__badge--warn';
  }
  if (normalized === 'deprecated' || normalized === 'archived') {
    return 'doc-meta__badge--danger';
  }
  return '';
}

function MetaBadge({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <span className={`doc-meta__badge ${className}`.trim()}>{children}</span>
  );
}

export default function DocMetaBar({frontMatter}: DocMetaBarProps): ReactNode {
  if (frontMatter.hide_doc_meta) {
    return null;
  }

  const audiences = formatAudience(frontMatter.audience);
  const lastUpdated = frontMatter.last_updated ?? frontMatter.last_reviewed;
  const hasContent =
    frontMatter.status ||
    lastUpdated ||
    frontMatter.owner ||
    audiences.length > 0 ||
    frontMatter.stage;

  if (!hasContent) {
    return null;
  }

  return (
    <div className="doc-meta" aria-label="Document metadata">
      {frontMatter.status ? (
        <MetaBadge className={statusClass(frontMatter.status)}>
          {formatLabel(frontMatter.status)}
        </MetaBadge>
      ) : null}
      {audiences.map((item) => (
        <MetaBadge key={item}>{formatLabel(item)}</MetaBadge>
      ))}
      {frontMatter.stage ? (
        <MetaBadge>{formatLabel(frontMatter.stage)}</MetaBadge>
      ) : null}
      {lastUpdated ? (
        <MetaBadge className="doc-meta__badge--muted">
          Updated {lastUpdated}
        </MetaBadge>
      ) : null}
      {frontMatter.owner ? (
        <MetaBadge className="doc-meta__badge--muted">
          {frontMatter.owner}
        </MetaBadge>
      ) : null}
    </div>
  );
}
