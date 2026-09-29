import { withAuthenticationRequired } from '@auth0/auth0-react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthBridge from './auth/AuthBridge';
import Layout from './components/Layout';
import ActivityDetail from './pages/ActivityDetail';
import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import NotFound from './pages/NotFound';

/** Todo el árbol de la app está detrás del login de Auth0 (RF-7). */
const ProtectedLayout = withAuthenticationRequired(Layout, {
  onRedirecting: () => (
    <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
      Verificando sesión…
    </div>
  ),
});

export default function App() {
  return (
    <BrowserRouter>
      <AuthBridge />
      <Routes>
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<Discover />} />
          <Route path="actividades/:id" element={<ActivityDetail />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
