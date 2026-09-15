import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Discover from './pages/Discover'

// Mantenemos los placeholders del Dashboard y Admin por ahora
const Dashboard = () => <h1 className="text-3xl font-extrabold text-slate-900">Mi Dashboard</h1>;
const Admin = () => <h1 className="text-3xl font-extrabold text-slate-900">Panel de Estadísticas</h1>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Discover />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}