import { useState, useEffect } from 'react';
import api from '../services/api';
import ActivityCard from '../components/ActivityCard';
import type { Actividad, PaginatedResponse } from '../types/api';

export default function Discover() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('todos');
  
  const [activities, setActivities] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Función asíncrona para buscar los datos
    const fetchActividades = async () => {
      setLoading(true);
      try {
        // Construimos los parámetros de búsqueda dinámicamente
        const params: Record<string, string> = {};
        if (filterType !== 'todos') params.tipo = filterType;
        if (searchTerm) params.ubicacion = searchTerm; // O params.titulo, dependiendo de cómo maneje tu backend la búsqueda libre

        const response = await api.get<PaginatedResponse<Actividad>>('/actividades', { params });
        setActivities(response.data.data); // Accedemos al array dentro de 'data'
      } catch (error) {
        console.error("Error al obtener actividades:", error);
      } finally {
        setLoading(false);
      }
    };

    // Usamos un pequeño delay (debounce) para no saturar la API mientras el usuario tipea
    const delayDebounceFn = setTimeout(() => {
      fetchActividades();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, filterType]); // Se vuelve a ejecutar si cambian los filtros

  return (
    <div className="space-y-6">
      {/* Search & Filters Hero */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 text-8xl opacity-10 select-none">⛅</div>
        <div className="max-w-2xl relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Actividades al Aire Libre</h1>
          
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ubicación..." 
                className="w-full pl-4 pr-4 py-2.5 bg-slate-800/90 text-white rounded-xl border border-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
          <h2 className="text-lg font-bold text-slate-900">
            Próximas Actividades <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{activities.length}</span>
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500">Cargando actividades desde la API...</div>
        ) : activities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activities.map((act) => (
              <ActivityCard key={act.id} {...act} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <h3 className="text-base font-semibold text-slate-800">No se encontraron actividades</h3>
          </div>
        )}
      </div>
    </div>
  );
}