import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Discover from './pages/Discover'
import Dashboard from './pages/Dashboard'

// Placeholder del Admin (todavía nos falta armarlo)
const Admin = () => <h1 className="text-3xl font-extrabold text-slate-900">Panel de Estadísticas</h1>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Discover />} />
          
          {/* 2. Reemplazá el placeholder por el componente Dashboard */}
          <Route path="dashboard" element={<Dashboard />} />
          
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}