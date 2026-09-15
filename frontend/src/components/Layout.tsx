import { useState } from 'react';
import { Compass, Gauge, Plus, ShieldCheck, SunMedium, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { CURRENT_USER_ID } from '../services/api';
import CreateActivityModal from './CreateActivityModal';
import { Button } from './ui/Button';

const navigation = [
  { to: '/', label: 'Descubrir', icon: Compass, end: true },
  { to: '/dashboard', label: 'Mi actividad', icon: Gauge, end: false },
  { to: '/admin', label: 'Administración', icon: ShieldCheck, end: false },
];

/** Marco principal y navegación persistente de la aplicación. */
export default function Layout() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="mr-auto flex items-center gap-3" aria-label="Sol Not Found - Inicio">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm"><SunMedium className="size-5" /></span>
            <span className="hidden sm:block">
              <span className="block text-sm font-extrabold leading-none tracking-tight">Sol Not Found</span>
              <span className="mt-1 block text-[11px] text-slate-500">Actividades preparadas para el clima</span>
            </span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            {navigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${isActive ? 'bg-slate-100 text-slate-950' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                <Icon className="size-4" />{label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 lg:flex" title={CURRENT_USER_ID}>
            <UserRound className="size-3.5" /><span>Usuario demo</span>
          </div>
          <Button size="sm" onClick={() => setIsModalOpen(true)}><Plus className="size-4" /><span className="hidden sm:inline">Nueva actividad</span></Button>
        </div>

        <nav className="mx-auto flex max-w-7xl border-t border-slate-100 px-4 md:hidden" aria-label="Navegación móvil">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-semibold ${isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
              <Icon className="size-3.5" />{label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Sol Not Found · Gestión climática de actividades</span>
          <span>Identidad simulada mediante X-User-Id</span>
        </div>
      </footer>

      <CreateActivityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
