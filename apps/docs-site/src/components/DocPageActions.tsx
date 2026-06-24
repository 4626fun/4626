import {useCallback, useState} from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';

export default function DocPageActions(): React.JSX.Element | null {
  const {metadata, frontMatter} = useDoc();
  const [copied, setCopied] = useState(false);

  const copyPageLink = useCallback(async () => {
    const url = window.location.href.split('#')[0] ?? window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, []);

  if (frontMatter.hide_table_of_contents === true && metadata.slug === '/') {
    return null;
  }

  return (
    <div className="doc-page-actions" aria-label="Page actions">
      <button
        type="button"
        className="doc-page-actions__button"
        onClick={copyPageLink}
        aria-live="polite">
        {copied ? 'Copied' : 'Copy link'}
      </button>
      {metadata.editUrl ? (
        <a
          className="doc-page-actions__button doc-page-actions__button--link"
          href={metadata.editUrl}
          target="_blank"
          rel="noopener noreferrer">
          Edit
        </a>
      ) : null}
      <a
        className="doc-page-actions__button doc-page-actions__button--link"
        href="https://github.com/wenakita/4626/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer">
        Report issue
      </a>
    </div>
  );
}
