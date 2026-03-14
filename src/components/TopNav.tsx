import { NavLink } from 'react-router-dom';

import { navigationItems } from '../lib/routes';

export function TopNav() {
  return (
    <nav aria-label="Primary">
      <ul className="top-nav">
        {navigationItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
