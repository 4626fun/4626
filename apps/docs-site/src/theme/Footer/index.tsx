import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useThemeConfig} from '@docusaurus/theme-common';
import type {FooterLinkItem, Footer as FooterType} from '@docusaurus/theme-common';

function FooterLink({item}: {item: FooterLinkItem}): ReactNode {
  if (item.to) {
    return (
      <li className="footer__item">
        <Link className="footer__link-item" to={item.to}>
          {item.label}
        </Link>
      </li>
    );
  }

  const external = Boolean(item.href?.startsWith('http'));

  return (
    <li className="footer__item">
      <a
        className="footer__link-item"
        href={item.href}
        {...(external
          ? {target: '_blank', rel: 'noopener noreferrer'}
          : undefined)}>
        {item.label}
        {external ? (
          <span className="footer__link-external" aria-hidden="true">
            ↗
          </span>
        ) : null}
      </a>
    </li>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: FooterLinkItem[];
}): ReactNode {
  return (
    <div className="footer__column">
      <div className="footer__title">{title}</div>
      <ul className="footer__items clean-list">
        {items.map((item) => (
          <FooterLink key={`${title}-${item.label}`} item={item} />
        ))}
      </ul>
    </div>
  );
}

export default function Footer(): ReactNode {
  const {footer} = useThemeConfig();
  const logoUrl = useBaseUrl('/brand/logo.svg');

  if (!footer) {
    return null;
  }

  const {copyright, links, style} = footer as FooterType;

  return (
    <footer
      className="footer footer--custom"
      {...(style ? {'data-theme': style} : undefined)}>
      <div className="container container--fluid footer__container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Link to="/" className="footer__logo-link" aria-label="4626 docs home">
              <img
                className="footer__logo"
                src={logoUrl}
                alt=""
                width={28}
                height={28}
                loading="lazy"
                decoding="async"
              />
              <span className="footer__brand-name">4626.fun</span>
            </Link>
            <p className="footer__brand-tagline">
              Documentation for creator vaults, fair-launch shares, and onchain fee
              routing on Base.
            </p>
            <span className="footer__badge">Built on Base</span>
          </div>

          {links?.map((column) => (
            <FooterColumn
              key={column.title}
              title={column.title ?? ''}
              items={column.items}
            />
          ))}
        </div>

        <div className="footer__bottom">
          {copyright ? (
            <div className="footer__copyright">{copyright}</div>
          ) : null}
          <div className="footer__bottom-links">
            <a
              className="footer__bottom-link"
              href="https://4626.fun"
              target="_blank"
              rel="noopener noreferrer">
              4626.fun
            </a>
            <span className="footer__bottom-sep" aria-hidden="true">
              ·
            </span>
            <a
              className="footer__bottom-link"
              href="https://github.com/wenakita/4626"
              target="_blank"
              rel="noopener noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
