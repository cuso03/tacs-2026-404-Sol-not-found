import { useState, useEffect } from 'react';
import api from '../services/api';
import type { PaginatedResponse } from '../types/api';

// Interfaz rápida para el resumen que devuelve tu backend
interface ActividadResumen {
  id: string;
  titulo: string;
  fecha_horario: string;
  rol: 'organizador' | 'participante';
  estado: string;
  votacion_abierta: boolean;
}

export default function Dashboard() {
  const [filtro, setFiltro] = useState<'todas' | 'organizador' | 'participante'>('todas');
  const [actividades, setActividades] = useState<ActividadResumen[]>([]);
  const [loading, setLoading] = useState(true);

  // Llamada a la API
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get<PaginatedResponse<ActividadResumen>>('/usuarios/me/actividades');
        setActividades(response.data.data);
      } catch (error) {
        console.error("Error al cargar el dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  // Lógica de filtrado con el campo `rol` real del backend
  const actividadesFiltradas = actividades.filter((act) => {
    if (filtro === 'organizador') return act.rol === 'organizador';
    if (filtro === 'participante') return act.rol === 'participante';
    return true; // Si es 'todas'
  });

  const estiloBotonFiltro = (filtroActual: string) => {
    return `px-3 py-1.5 rounded-lg transition ${
      filtro === filtroActual 
        ? 'bg-white shadow-sm text-slate-800 font-semibold' 
        : 'text-slate-600 hover:text-slate-900'
    }`;
  };

  const getStatusBadgeHtml = (estado: string) => {
    const estilos: Record<string, string> = {
      'PROPUESTA': 'bg-blue-50 text-blue-700 border-blue-200',
      'EN_VOTACION': 'bg-amber-50 text-amber-800 border-amber-300 font-bold animate-pulse',
      'CONFIRMADA': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    const estiloClase = estilos[estado] || 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`px-2 py-0.5 rounded-full text-[10px] border font-bold ${estiloClase}`}>{estado}</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mi Dashboard</h1>
            <p className="text-xs text-slate-500 mt-1">Actividades organizadas por vos o donde participás activamente.</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold">
            <button onClick={() => setFiltro('todas')} className={estiloBotonFiltro('todas')}>Todas</button>
            <button onClick={() => setFiltro('organizador')} className={estiloBotonFiltro('organizador')}>Organizador</button>
            <button onClick={() => setFiltro('participante')} className={estiloBotonFiltro('participante')}>Participante</button>
          </div>
        </div>

        {/* Lista de Resultados tipo fila */}
        <div className="mt-4 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Cargando tus actividades...</div>
          ) : actividadesFiltradas.length > 0 ? (
            actividadesFiltradas.map((act) => (
              <div key={act.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 px-3 rounded-xl transition cursor-pointer">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{act.titulo}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${act.rol === 'organizador' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                      {act.rol === 'organizador' ? 'Organizador' : 'Participante'}
                    </span>
                    {getStatusBadgeHtml(act.estado)}
                    {act.votacion_abierta && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-md font-bold animate-pulse">Votación Activa</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span>📅 {new Date(act.fecha_horario).toLocaleDateString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                  </div>
                </div>
                <div className="text-xs font-semibold text-blue-600">Ver detalle →</div>
              </div>
            ))
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