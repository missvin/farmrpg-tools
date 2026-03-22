import { NavLink, useLocation } from 'react-router-dom';

import { navigationSections } from '../lib/routes';

export function TopNav() {
  const location = useLocation();

  function isSectionActive(sectionPaths: string[]): boolean {
    return sectionPaths.some((path) => path === location.pathname);
  }

  function closeMenu(event: React.MouseEvent<HTMLAnchorElement>): void {
    const parentDetails = event.currentTarget.closest('details');
    if (parentDetails instanceof HTMLDetailsElement) {
      parentDetails.open = false;
    }
  }

  return (
    <nav aria-label="Primary">
      <ul className="top-nav-menu-list">
        {navigationSections.map((section) => (
          <li key={section.title}>
            <details className="top-nav-menu" open={isSectionActive(section.items.map((item) => item.to))}>
              <summary
                className={
                  isSectionActive(section.items.map((item) => item.to))
                    ? 'top-nav-menu__summary top-nav-menu__summary--active'
                    : 'top-nav-menu__summary'
                }
              >
                {section.title}
              </summary>
              <ul className="top-nav-menu__panel">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
                      onClick={closeMenu}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </nav>
  );
}
