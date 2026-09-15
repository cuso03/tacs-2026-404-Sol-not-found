import { useEffect, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, MapPinned, Search, SlidersHorizontal } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import type { AppOutletContext } from '../components/Layout';
import ActivityCard from '../components/ActivityCard';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { NativeSelect } from '../components/ui/native-select';
import { Skeleton } from '../components/ui/skeleton';
import api, { getApiErrorMessage } from '../services/api';
import type { Actividad, PaginatedResponse } from '../types/api';

const PAGE_SIZE = 9;

/** Catálogo público con filtros y paginación conectados al backend. */
export default function Discover() {
  const { refreshVersion } = useOutletContext<AppOutletContext>();
  const [location, setLocation] = useState('');
  const [type, setType] = useState('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [page, setPage] = useState(1);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [response, setResponse] = useState<PaginatedResponse<Actividad>>({ data: [], meta: { total: 0, page: 1, limit: PAGE_SIZE, totalPages: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
        if (type !== 'todos') params.tipo = type;
        if (location.trim()) params.ubicacion = location.trim();
        if (dateFrom) params.fecha_desde = new Date(`${dateFrom}T00:00:00`).toISOString();
        const result = await api.get<PaginatedResponse<Actividad>>('/actividades', { params, signal: controller.signal });
        setResponse(result.data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(getApiErrorMessage(cause));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      globalThis.clearTimeout(timer);
      controller.abort();
    };
  }, [dateFrom, location, page, reloadVersion, refreshVersion, type]);

  function clearFilters() {
    setLocation('');
    setType('todos');
    setDateFrom('');
    setPage(1);
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white shadow-xl shadow-slate-950/10 sm:px-10 sm:py-14">
        <div className="absolute -right-24 -top-32 size-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-blue-100"><MapPinned className="size-3.5" />Actividades con seguimiento meteorológico</span>
          <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">Encontrá tu próximo plan sin perder de vista el clima.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Explorá actividades, reservá tu lugar y participá de la reprogramación cuando el pronóstico cambie.</p>
        </div>
      </section>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="flex items-center gap-2 text-base font-bold"><SlidersHorizontal className="size-4 text-blue-600" />Buscar actividades</h2><p className="mt-1 text-xs text-slate-500">Filtrá por ubicación, modalidad o fecha.</p></div>
            {(location || type !== 'todos' || dateFrom) && <Button variant="ghost" size="sm" onClick={clearFilters}>Limpiar</Button>}
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px]">
            <div className="space-y-2"><Label htmlFor="location-filter">Ubicación</Label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><Input id="location-filter" value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} placeholder="Ciudad, parque o dirección" className="pl-9" /></div></div>
            <div className="space-y-2"><Label htmlFor="type-filter">Tipo</Label><NativeSelect id="type-filter" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="todos">Todos los tipos</option><option value="aire_libre">Aire libre</option><option value="techada">Techada</option><option value="mixta">Mixta</option></NativeSelect></div>
            <div className="space-y-2"><Label htmlFor="date-filter">Desde</Label><div className="relative"><CalendarRange className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><Input id="date-filter" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="pl-9" /></div></div>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="activity-list-title">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><h2 id="activity-list-title" className="text-2xl font-bold tracking-tight">Actividades disponibles</h2><p className="mt-1 text-sm text-slate-500">{loading ? 'Actualizando resultados…' : `${response.meta.total} actividades con cupos`}</p></div>
        </div>

        {error && <Alert className="mb-5"><AlertTitle>No pudimos cargar las actividades</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button variant="outline" size="sm" onClick={() => setReloadVersion((current) => current + 1)}>Reintentar</Button></AlertDescription></Alert>}

        {loading && response.data.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-80 rounded-2xl" />)}</div>
        ) : response.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{response.data.map((activity) => <ActivityCard key={activity.id} {...activity} />)}</div>
        ) : !error && (
          <Card className="rounded-2xl border-dashed"><CardContent className="flex flex-col items-center px-6 py-16 text-center"><Search className="mb-4 size-9 text-slate-300" /><h3 className="font-semibold">No encontramos actividades</h3><p className="mt-1 max-w-md text-sm text-slate-500">Probá con otra ubicación, cambiá los filtros o creá una nueva actividad.</p><Button variant="outline" className="mt-5" onClick={clearFilters}>Quitar filtros</Button></CardContent></Card>
        )}

        {response.meta.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="size-4" />Anterior</Button>
            <span className="text-sm text-slate-500">Página <strong className="text-slate-900">{response.meta.page}</strong> de {response.meta.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= response.meta.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Siguiente<ChevronRight className="size-4" /></Button>
          </div>
        )}
      </section>
    </div>
  );
}
