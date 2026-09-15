import { useState } from 'react';
import ActivityCard from '../components/ActivityCard';

// Simulamos que el usuario logueado tiene este ID (luego vendrá del Auth/Header X-User-Id)
const CURRENT_USER_ID = "user_martin";

// Mock de datos con información de roles
const mockDashboardActivities = [
  {
    id: "1",
    titulo: "Fútbol 7 de los Jueves",
    descripcion: "Partido semanal en césped sintético. En caso de lluvia se vota.",
    tipo: "aire_libre" as const,
    estado: "EN_VOTACION",
    fecha: "17 Sep - 20:00 hs",
    ubicacion: "Plaza Irlanda, Caballito",
    cuposOcupados: 5,
    cuposMaximos: 14,
    creadorId: "user_martin", // Somos el organizador
    participantes: ["user_martin", "user_lucia", "user_carlos"]
  },
  {
    id: "2",
    titulo: "Torneo Relámpago de Padel Mixto",
    descripcion: "Canchas techadas de blindex. El mal tiempo no suspende la actividad.",
    tipo: "techada" as const,
    estado: "CONFIRMADA",
    fecha: "21 Sep - 19:00 hs",
    ubicacion: "Club Padel Belgrano",
    cuposOcupados: 8,
    cuposMaximos: 8,
    creadorId: "user_carlos",
    participantes: ["user_carlos", "user_martin"] // Somos participantes, pero no organizadores
  }
];

export default function Dashboard() {
  // Estado para manejar el filtro actual
  const [filtro, setFiltro] = useState<'todas' | 'organizador' | 'participante'>('todas');

  // Lógica de filtrado en tiempo real
  const actividadesFiltradas = mockDashboardActivities.filter((act) => {
    const esOrganizador = act.creadorId === CURRENT_USER_ID;
    const esParticipante = act.participantes.includes(CURRENT_USER_ID);

    if (filtro === 'organizador') return esOrganizador;
    if (filtro === 'participante') return esParticipante && !esOrganizador;
    return esOrganizador || esParticipante;
  });

  // Función helper para aplicar estilos al botón activo
  const estiloBotonFiltro = (filtroActual: string) => {
    return `px-3 py-1.5 rounded-lg transition ${
      filtro === filtroActual 
        ? 'bg-white shadow-sm text-slate-800 font-semibold' 
        : 'text-slate-600 hover:text-slate-900'
    }`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        {/* Cabecera del Dashboard y Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mi Dashboard</h1>
            <p className="text-xs text-slate-500 mt-1">Actividades organizadas por vos o donde participás activamente.</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold">
            <button onClick={() => setFiltro('todas')} className={estiloBotonFiltro('todas')}>
              Todas
            </button>
            <button onClick={() => setFiltro('organizador')} className={estiloBotonFiltro('organizador')}>
              Organizador
            </button>
            <button onClick={() => setFiltro('participante')} className={estiloBotonFiltro('participante')}>
              Participante
            </button>
          </div>
        </div>

        {/* Grilla de resultados (Reutilizando ActivityCard) */}
        <div className="mt-6">
          {actividadesFiltradas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {actividadesFiltradas.map((act) => (
                <ActivityCard key={act.id} {...act} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No tenés actividades registradas bajo este filtro.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}