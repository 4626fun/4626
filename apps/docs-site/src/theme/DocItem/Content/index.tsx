import type React from 'react';
import DocItemContent from '@theme-original/DocItem/Content';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import DocFeedback from '@site/src/components/DocFeedback';
import HistoricalDocBanner from '@site/src/components/HistoricalDocBanner';

const DOC_TEMPLATES = new Set(['runbook', 'audit', 'reference']);

export default function DocItemContentWrapper(
  props: React.ComponentProps<typeof DocItemContent>,
): React.JSX.Element {
  const {frontMatter, metadata} = useDoc();
  const rawTemplate = frontMatter.doc_template;
  const template =
    typeof rawTemplate === 'string' && DOC_TEMPLATES.has(rawTemplate)
      ? rawTemplate
      : null;
  const isHistorical = frontMatter.status === 'historical';

  return (
    <div className={template ? `doc-template doc-template--${template}` : undefined}>
      {isHistorical ? <HistoricalDocBanner title={metadata.title} /> : null}
      <DocItemContent {...props} />
      <DocFeedback />
    </div>
  );
}
