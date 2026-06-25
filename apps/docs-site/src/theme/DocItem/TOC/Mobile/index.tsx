import clsx from 'clsx';
import DocItemTOCMobile from '@theme-original/DocItem/TOC/Mobile';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import DocPageActions from '@site/src/components/DocPageActions';

export default function DocItemTOCMobileWrapper(): React.JSX.Element | null {
  const {metadata, frontMatter} = useDoc();
  const hideToc = frontMatter.hide_table_of_contents === true;
  const isHome = metadata.slug === '/';

  if (isHome) {
    return null;
  }

  return (
    <div className="doc-mobile-toc-shell">
      {!hideToc ? <DocItemTOCMobile /> : null}
      <DocPageActions variant="mobile" />
    </div>
  );
}
