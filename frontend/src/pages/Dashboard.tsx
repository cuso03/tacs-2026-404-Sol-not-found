import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, CircleUserRound, ClipboardList, Vote } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import ActivityStatusBadge from '../components/ActivityStatusBadge';
import type { AppOutletContext } from '../components/Layout';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { formatDateTime } from '../lib/formatters';
import api, { getApiErrorMessage } from '../services/api';
import type { ActividadResumenUsuario, PaginatedResponse } from '../types/api';

const PAGE_SIZE = 10;

/** Actividades creadas o integradas por el usuario autenticado. */
export default function Dashboard() {
  const { refreshVersion } = useOutletContext<AppOutletContext>();
  const [filter, setFilter] = useState<'todas' | 'organizador' | 'participante'>('todas');
  const [page, setPage] = useState(1);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [response, setResponse] = useState<PaginatedResponse<ActividadResumenUsuario>>({ data: [], meta: { total: 0, page: 1, limit: PAGE_SIZE, totalPages: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get<PaginatedResponse<ActividadResumenUsuario>>('/usuarios/me/actividades', { params: { page, limit: PAGE_SIZE }, signal: controller.signal })
      .then((result) => setResponse(result.data))
      .catch((cause) => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, reloadVersion, refreshVersion]);

  const activities = response.data.filter((activity) => filter === 'todas' || activity.rol === filter);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><span className="text-sm font-semibold text-blue-700">Espacio personal</span><h1 className="mt-1 text-3xl font-black tracking-tight">Mi actividad</h1><p className="mt-2 text-sm text-slate-500">Seguí tus organizaciones, inscripciones y votaciones pendientes.</p></div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <Button size="sm" variant={filter === 'todas' ? 'secondary' : 'ghost'} onClick={() => setFilter('todas')}>Todas</Button>
          <Button size="sm" variant={filter === 'organizador' ? 'secondary' : 'ghost'} onClick={() => setFilter('organizador')}>Organizo</Button>
          <Button size="sm" variant={filter === 'participante' ? 'secondary' : 'ghost'} onClick={() => setFilter('participante')}>Participo</Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={ClipboardList} label="En esta página" value={response.data.length} />
        <SummaryCard icon={CircleUserRound} label="Como organizador" value={response.data.filter((activity) => activity.rol === 'organizador').length} />
        <SummaryCard icon={Vote} label="Votaciones abiertas" value={response.data.filter((activity) => activity.votacion_abierta).length} accent />
      </div>

      {error && <Alert><AlertTitle>No pudimos cargar tu dashboard</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button variant="outline" size="sm" onClick={() => setReloadVersion((current) => current + 1)}>Reintentar</Button></AlertDescription></Alert>}

      <Card className="overflow-hidden rounded-2xl">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold">Actividades vinculadas</h2><p className="mt-1 text-xs text-slate-500">{response.meta.total} resultados totales</p></div>
        <CardContent className="p-0">
          {loading && response.data.length === 0 ? (
            <div className="space-y-1 p-4">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>
          ) : activities.length > 0 ? activities.map((activity) => (
            <Link key={activity.id} to={`/actividades/${activity.id}`} className="group flex flex-col gap-3 border-b border-slate-100 px-5 py-4 outline-none transition last:border-0 hover:bg-slate-50 focus-visible:bg-blue-50 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-slate-950">{activity.titulo}</h3><Badge variant={activity.rol === 'organizador' ? 'warning' : 'secondary'}>{activity.rol === 'organizador' ? 'Organizador' : 'Participante'}</Badge><ActivityStatusBadge status={activity.estado} />{activity.votacion_abierta && <Badge variant="default"><Vote className="mr-1 size-3" />Votación abierta</Badge>}</div>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="size-4" />{formatDateTime(activity.fecha_horario)}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-700">Abrir <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
            </Link>
          )) : !error && (
            <div className="flex flex-col items-center px-6 py-16 text-center"><ClipboardList className="mb-4 size-9 text-slate-300" /><h3 className="font-semibold">No hay actividades en este filtro</h3><p className="mt-1 text-sm text-slate-500">Probá otra vista o sumate a una actividad desde Descubrir.</p></div>
          )}
        </CardContent>
      </Card>

      {response.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="size-4" />Anterior</Button><span className="text-sm text-slate-500">Página {response.meta.page} de {response.meta.totalPages}</span><Button variant="outline" size="sm" disabled={page >= response.meta.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Siguiente<ChevronRight className="size-4" /></Button></div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent = false }: { icon: typeof ClipboardList; label: string; value: number; accent?: boolean }) {
  return <Card className={accent ? 'border-blue-200 bg-blue-50/60' : ''}><CardContent className="flex items-center gap-4 p-5"><span className={`grid size-10 place-items-center rounded-xl ${accent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon className="size-5" /></span><div><p className="text-2xl font-black">{value}</p><p className="text-xs text-slate-500">{label}</p></div></CardContent></Card>;
}
