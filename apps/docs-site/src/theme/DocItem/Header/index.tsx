import type React from 'react';
import DocItemHeader from '@theme-original/DocItem/Header';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import DocMetaBar from '@site/src/components/DocMetaBar';
import DocEditionBanner from '@site/src/components/DocEditionBanner';

function readReleaseScope(frontMatter: Record<string, unknown>): string | undefined {
  const appliesTo = frontMatter.applies_to_release;
  if (typeof appliesTo === 'string' && appliesTo.trim()) {
    return appliesTo.trim();
  }
  const release = frontMatter.release;
  if (typeof release === 'string' && release.trim()) {
    return release.trim();
  }
  return undefined;
}

export default function DocItemHeaderWrapper(
  props: React.ComponentProps<typeof DocItemHeader>,
): React.JSX.Element {
  const {frontMatter, metadata} = useDoc();
  const hideMeta =
    frontMatter.hide_doc_meta === true || metadata.slug === '/';
  const release = readReleaseScope(frontMatter as Record<string, unknown>);

  return (
    <>
      <DocItemHeader {...props} />
      {!hideMeta ? <DocMetaBar frontMatter={frontMatter} /> : null}
      {!hideMeta ? <DocEditionBanner release={release} /> : null}
    </>
  );
}
