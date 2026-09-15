import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

// Placeholders temporales para las páginas
const Discover = () => <h1 className="text-3xl font-extrabold text-slate-900">Buscador de Actividades</h1>;
const Dashboard = () => <h1 className="text-3xl font-extrabold text-slate-900">Mi Dashboard</h1>;
const Admin = () => <h1 className="text-3xl font-extrabold text-slate-900">Panel de Estadísticas</h1>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* El index indica qué componente carga en la ruta raíz ("/") */}
          <Route index element={<Discover />} />
          
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}