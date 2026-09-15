import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api, { getApiErrorMessage } from '../services/api';
import ActivityCard from '../components/ActivityCard';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import type { Actividad, PaginatedResponse } from '../types/api';

export default function Discover() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('todos');
  const [apiActivities, setApiActivities] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { createdActivities } = useOutletContext<{ createdActivities: Actividad[] }>();

  useEffect(() => {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params: Record<string, string> = {};
        if (filterType !== 'todos') params.tipo = filterType;
        if (searchTerm.trim()) params.ubicacion = searchTerm.trim();
        const response = await api.get<PaginatedResponse<Actividad>>('/actividades', { params, signal: controller.signal });
        setApiActivities(response.data.data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(getApiErrorMessage(cause));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      globalThis.clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, filterType]);

  const activities = useMemo(() => {
    const combined = new Map(apiActivities.map((activity) => [activity.id, activity]));
    for (const activity of createdActivities) combined.set(activity.id, activity);
    const query = searchTerm.trim().toLocaleLowerCase('es');
    return [...combined.values()].filter((activity) => {
      const location = activity.ubicacion.tipo === 'ciudad'
        ? `${activity.ubicacion.ciudad} ${activity.ubicacion.pais}`
        : activity.ubicacion.direccion ?? '';
      return (filterType === 'todos' || activity.tipo === filterType)
        && (!query || activity.titulo.toLocaleLowerCase('es').includes(query) || location.toLocaleLowerCase('es').includes(query));
    });
  }, [apiActivities, createdActivities, filterType, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -bottom-8 -right-8 select-none text-8xl opacity-10">⛅</div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Actividades al Aire Libre sin Sorpresas</h1>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">Buscá partidos, salidas o encuentros. Si el clima cambia, el sistema ayuda a reprogramar.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-3 size-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por título, parque o dirección..." className="h-11 border-slate-700 bg-slate-800/90 pl-11 text-white placeholder:text-slate-400" />
            </div>
            <NativeSelect value={filterType} onChange={(event) => setFilterType(event.target.value)} className="h-11 border-slate-700 bg-slate-800/90 px-4 text-white">
              <option value="todos">Todos los tipos</option>
              <option value="aire_libre">Aire libre</option>
              <option value="techada">Techada</option>
              <option value="mixta">Mixta</option>
            </NativeSelect>
          </div>
        </div>
      </div>

      {error && <Alert><AlertDescription>{error}</AlertDescription></Alert>}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">Próximas Actividades <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{activities.length}</span></h2>
        </div>
        {loading && activities.length === 0 ? (
          <div className="py-12 text-center text-slate-500">Cargando actividades desde la API...</div>
        ) : activities.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {activities.map((activity) => <ActivityCard key={activity.id} {...activity} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <div className="mb-3 text-4xl">🔍</div>
            <h3 className="text-base font-semibold text-slate-800">No se encontraron actividades</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">Probá quitando filtros o creá una nueva actividad.</p>
          </div>
        )}
      </section>
    </div>
  );
}
