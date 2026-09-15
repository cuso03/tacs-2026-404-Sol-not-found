import { Link, Outlet } from 'react-router-dom'
import Button from './ui/Button'

export default function Layout() {
  return (
    <div className="h-full flex flex-col font-sans text-slate-800">
      {/* Top Global Bar: User Simulator */}
      <header className="bg-slate-900 text-slate-300 text-xs px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-slate-200">Entorno TACS</span>
          <span className="text-slate-500">|</span>
          <span>Simulador <code className="text-amber-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">X-User-Id</code></span>
        </div>
      </header>

      {/* Main App Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-blue-500 flex items-center justify-center text-white shadow-md text-xl font-black">
                ☀️
              </div>
              <div>
                <div className="font-extrabold text-lg tracking-tight text-slate-900 leading-none flex items-center gap-1.5">
                  404 <span className="text-blue-600">Sol Not Found</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Monitoreo y Reprogramación</span>
              </div>
            </Link>

            {/* Desktop Navigation links */}
            <div className="hidden md:flex items-center space-x-2">
              <Link to="/" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Descubrir
              </Link>
              <Link to="/dashboard" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Mi Dashboard
              </Link>
              <Link to="/admin" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-1.5">
                <span>Admin</span>
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">Métricas</span>
              </Link>
            </div>

            {/* User Profile Pill */}
            <div className="flex items-center gap-3">
              <Button className="px-3.5 rounded-lg">
                Nueva Actividad
              </Button>
            </div>

          </div>
        </div>
      </nav>

      {/* Dynamic Content Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet /> {/* Acá React Router va a inyectar las distintas páginas */}
      </main>
    </div>
  )
}