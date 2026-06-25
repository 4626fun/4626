import {useCallback, useEffect, useState} from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';

const STORAGE_PREFIX = '4626-docs-feedback:';

function feedbackKey(slug: string): string {
  return `${STORAGE_PREFIX}${slug}`;
}

function buildIssueUrl(pageTitle: string, pageUrl: string): string {
  const title = encodeURIComponent(`[Docs] Feedback: ${pageTitle}`);
  const body = encodeURIComponent(
    [
      '## Page',
      pageUrl,
      '',
      '## What was unclear or incorrect?',
      '',
      '_Describe what you expected and what you found instead._',
      '',
      '## Optional context',
      '- Browser / device:',
      '- Persona (users, operators, etc.):',
    ].join('\n'),
  );
  return `https://github.com/wenakita/4626/issues/new?title=${title}&body=${body}`;
}

export default function DocFeedback(): React.JSX.Element | null {
  const {metadata, frontMatter} = useDoc();
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(feedbackKey(metadata.slug));
    if (stored === 'yes' || stored === 'no') {
      setChoice(stored);
    }
  }, [metadata.slug]);

  const persist = useCallback(
    (value: 'yes' | 'no') => {
      setChoice(value);
      try {
        window.localStorage.setItem(feedbackKey(metadata.slug), value);
      } catch {
        // Ignore storage failures (private mode, quota, etc.)
      }
    },
    [metadata.slug],
  );

  const onYes = useCallback(() => {
    persist('yes');
  }, [persist]);

  const onNo = useCallback(() => {
    persist('no');
    const url = buildIssueUrl(metadata.title, window.location.href.split('#')[0] ?? '');
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [metadata.title, persist]);

  if (frontMatter.hide_doc_feedback === true || metadata.slug === '/') {
    return null;
  }

  return (
    <section className="doc-feedback" aria-label="Page feedback">
      {choice === 'yes' ? (
        <p className="doc-feedback__message">Thanks — glad this helped.</p>
      ) : choice === 'no' ? (
        <p className="doc-feedback__message">
          Thanks for the signal. If you opened an issue, we&apos;ll follow up on GitHub.
        </p>
      ) : (
        <>
          <p className="doc-feedback__prompt">Was this page helpful?</p>
          <div className="doc-feedback__actions">
            <button
              type="button"
              className="doc-feedback__button doc-feedback__button--yes"
              onClick={onYes}>
              Yes
            </button>
            <button
              type="button"
              className="doc-feedback__button doc-feedback__button--no"
              onClick={onNo}>
              No
            </button>
          </div>
        </>
      )}
    </section>
  );
}
