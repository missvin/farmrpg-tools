import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { appRouteCompatibilityRedirects, appRoutes } from './lib/routes';

export default function App() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <section className="page-card route-loading" aria-label="Loading page">
            <p>Loading page...</p>
          </section>
        }
      >
        <Routes>
          {appRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
          {appRouteCompatibilityRedirects.map(({ path, to }) => (
            <Route key={path} path={path} element={<Navigate to={to} replace />} />
          ))}
        </Routes>
      </Suspense>
    </AppShell>
  );
}
