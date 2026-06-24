import type React from 'react';
import DocItemHeader from '@theme-original/DocItem/Header';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import DocMetaBar from '@site/src/components/DocMetaBar';

export default function DocItemHeaderWrapper(
  props: React.ComponentProps<typeof DocItemHeader>,
): React.JSX.Element {
  const {frontMatter, metadata} = useDoc();
  const hideMeta =
    frontMatter.hide_doc_meta === true || metadata.slug === '/';

  return (
    <>
      <DocItemHeader {...props} />
      {!hideMeta ? <DocMetaBar frontMatter={frontMatter} /> : null}
    </>
  );
}
