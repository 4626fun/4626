import {useEffect, useState} from 'react';
import {useLocation} from '@docusaurus/router';

const MIN_PAGE_HEIGHT_PX = 2000;

export default function ReadingProgressBar(): React.JSX.Element | null {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (location.pathname === '/') {
      setVisible(false);
      setProgress(0);
      return;
    }

    const measure = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      setVisible(scrollHeight > MIN_PAGE_HEIGHT_PX);
    };

    const onScroll = () => {
      const scrollTop = document.documentElement.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
    };

    measure();
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', measure);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, [location.pathname]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="reading-progress"
      aria-hidden="true"
      style={{transform: `scaleX(${progress / 100})`}}
    />
  );
}
