import { useState } from 'react';
import ActivityCard from '../components/ActivityCard';

// Datos de prueba simulando la API
const mockActivities = [
  {
    id: "1",
    titulo: "Fútbol 7 de los Jueves",
    descripcion: "Partido semanal en césped sintético. En caso de lluvia se vota.",
    tipo: "aire_libre" as const,
    estado: "EN_VOTACION",
    fecha: "17 Sep - 20:00 hs",
    ubicacion: "Plaza Irlanda, Caballito",
    cuposOcupados: 5,
    cuposMaximos: 14
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
    cuposMaximos: 8
  },
  {
    id: "3",
    titulo: "Picnic & Mateada en los Bosques",
    descripcion: "Tarde relajada al aire libre. Cada uno lleva su mate.",
    tipo: "aire_libre" as const,
    estado: "PROPUESTA",
    fecha: "19 Sep - 15:30 hs",
    ubicacion: "Rosedal de Palermo",
    cuposOcupados: 3,
    cuposMaximos: 20
  }
];

export default function Discover() {
  // 1. Definimos los estados para el buscador y el select
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('todos');

  // 2. Filtramos la lista basándonos en los estados actuales
  const filteredActivities = mockActivities.filter((act) => {
    const matchesSearch = 
      act.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.ubicacion.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'todos' || act.tipo === filterType;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filters Hero */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 text-8xl opacity-10 select-none">⛅</div>
        <div className="max-w-2xl relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Actividades al Aire Libre sin Sorpresas
          </h1>
          <p className="mt-2 text-slate-300 text-sm sm:text-base">
            Buscá partidos, salidas en bici o picnics. Si el clima se complica, el sistema coordina la votación por vos.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {/* Conectamos el input al estado searchTerm */}
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ciudad, parque o dirección..." 
                className="w-full pl-11 pr-4 py-2.5 bg-slate-800/90 text-white rounded-xl border border-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Conectamos el select al estado filterType */}
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-800/90 text-white rounded-xl px-4 py-2.5 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos los tipos</option>
              <option value="aire_libre">Aire libre</option>
              <option value="techada">Techada</option>
              <option value="mixta">Mixta</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activities Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Próximas Actividades</span>
            {/* El contador ahora refleja los elementos filtrados */}
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
              {filteredActivities.length}
            </span>
          </h2>
          <span className="text-xs text-slate-500">Actualizado con datos de clima en vivo</span>
        </div>

        {/* Renderizado condicional: Grilla o Estado Vacío */}
        {filteredActivities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredActivities.map((act) => (
              <ActivityCard key={act.id} {...act} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-base font-semibold text-slate-800">No se encontraron actividades</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No hay eventos que coincidan con la búsqueda. Probá quitando filtros o creá una nueva.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}