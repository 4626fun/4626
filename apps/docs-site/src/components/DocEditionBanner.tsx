import type {ReactNode} from 'react';

type DocEditionBannerProps = {
  release?: string;
};

export default function DocEditionBanner({
  release,
}: DocEditionBannerProps): ReactNode {
  const value = release?.trim();
  if (!value) {
    return null;
  }

  return (
    <div className="doc-edition-banner" role="note" aria-label="Release scope">
      <span className="doc-edition-banner__label">Applies to release</span>
      <span className="doc-edition-banner__value">{value}</span>
    </div>
  );
}
