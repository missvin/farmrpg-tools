import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { navigationSections } from '../lib/routes';

export function TopNav() {
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);
  const [openSectionTitle, setOpenSectionTitle] = useState<string | null>(null);

  function isSectionActive(sectionPaths: string[]): boolean {
    return sectionPaths.some((path) => path === location.pathname);
  }

  useEffect(() => {
    setOpenSectionTitle(null);
  }, [location.pathname]);

  useEffect(() => {
    function handleDocumentPointerDown(event: MouseEvent): void {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenSectionTitle(null);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpenSectionTitle(null);
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, []);

  function toggleSection(sectionTitle: string): void {
    setOpenSectionTitle((currentOpenTitle) => (currentOpenTitle === sectionTitle ? null : sectionTitle));
  }

  function closeMenu(): void {
    setOpenSectionTitle(null);
  }

  function handleSummaryKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, sectionTitle: string): void {
    if (event.key === 'Escape') {
      setOpenSectionTitle(null);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSection(sectionTitle);
    }
  }

  return (
    <nav aria-label="Primary" ref={navRef}>
      <ul className="top-nav-menu-list">
        {navigationSections.map((section) => (
          <li key={section.title}>
            <div className="top-nav-menu">
              <button
                type="button"
                aria-expanded={openSectionTitle === section.title}
                aria-haspopup="menu"
                className={
                  isSectionActive(section.items.map((item) => item.to))
                    ? 'top-nav-menu__summary top-nav-menu__summary--active'
                    : 'top-nav-menu__summary'
                }
                onClick={() => toggleSection(section.title)}
                onKeyDown={(event) => handleSummaryKeyDown(event, section.title)}
              >
                {section.title}
              </button>
              <ul
                className="top-nav-menu__panel"
                hidden={openSectionTitle !== section.title}
                aria-label={`${section.title} menu`}
              >
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
                      onClick={() => closeMenu()}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}
