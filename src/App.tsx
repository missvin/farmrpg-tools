import { Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { appRoutes } from './lib/routes';

export default function App() {
  return (
    <AppShell>
      <Routes>
        {appRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
      </Routes>
    </AppShell>
  );
}
