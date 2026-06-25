import Link from '@docusaurus/Link';
import type React from 'react';

type Props = {
  title?: string;
};

export default function HistoricalDocBanner({title}: Props): React.JSX.Element {
  return (
    <div className="doc-historical-banner" role="note">
      <strong>{title ? `${title} — ` : ''}Historical doc.</strong>{' '}
      Kept for audit context; behavior or env may no longer match production. See{' '}
      <Link to="/operators">Operators</Link> for current runbooks.
    </div>
  );
}
