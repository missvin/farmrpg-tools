import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { appRoutes } from './lib/routes';

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
        </Routes>
      </Suspense>
    </AppShell>
  );
}
