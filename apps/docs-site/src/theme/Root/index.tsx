import type {ReactNode} from 'react';
import Root from '@theme-original/Root';
import ReadingProgressBar from '@site/src/components/ReadingProgressBar';

export default function RootWrapper(props: {children: ReactNode}): React.JSX.Element {
  return (
    <>
      <ReadingProgressBar />
      <Root {...props} />
    </>
  );
}
