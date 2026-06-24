import type React from 'react';
import DocItemContent from '@theme-original/DocItem/Content';
import {useDoc} from '@docusaurus/plugin-content-docs/client';

const DOC_TEMPLATES = new Set(['runbook', 'audit', 'reference']);

export default function DocItemContentWrapper(
  props: React.ComponentProps<typeof DocItemContent>,
): React.JSX.Element {
  const {frontMatter} = useDoc();
  const rawTemplate = frontMatter.doc_template;
  const template =
    typeof rawTemplate === 'string' && DOC_TEMPLATES.has(rawTemplate)
      ? rawTemplate
      : null;

  if (!template) {
    return <DocItemContent {...props} />;
  }

  return (
    <div className={`doc-template doc-template--${template}`}>
      <DocItemContent {...props} />
    </div>
  );
}
