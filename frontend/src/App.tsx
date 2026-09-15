import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ActivityDetail from './pages/ActivityDetail';
import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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
