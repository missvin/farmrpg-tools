import { Link, useInRouterContext } from 'react-router-dom';

import { toItemProfilePath } from '../lib/itemProfileRoutes';

type ItemProfileLinkProps = {
  canonicalKey: string;
  itemName: string;
  iconSrc?: string | null;
  className?: string;
};

export function ItemProfileLink({
  canonicalKey,
  itemName,
  iconSrc = null,
  className,
}: ItemProfileLinkProps) {
  const classes = ['item-profile-link', className].filter(Boolean).join(' ');
  const to = toItemProfilePath(canonicalKey);
  const inRouter = useInRouterContext();

  const content = (
    <>
      {iconSrc ? <img className="item-icon" src={iconSrc} alt="" aria-hidden="true" loading="lazy" /> : null}
      <strong>{itemName}</strong>
    </>
  );

  if (!inRouter) {
    return (
      <a className={classes} href={to}>
        {content}
      </a>
    );
  }

  return (
    <Link className={classes} to={to}>
      {content}
    </Link>
  );
}
