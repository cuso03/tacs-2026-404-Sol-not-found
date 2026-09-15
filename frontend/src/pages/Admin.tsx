import { createElement, type ComponentType } from 'react';
import { Activity, BarChart3, BellRing, CalendarClock, CloudRain, LoaderCircle, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { useEstadisticas, useSimularMonitoreo } from '../hooks/useAdmin';
import { formatMetricName } from '../lib/formatters';
import { CURRENT_USER_ROLE, getApiErrorMessage } from '../services/api';

/** Panel administrativo para métricas acumuladas y simulación del monitoreo. */
export default function Admin() {
  const statsQuery = useEstadisticas();
  const simulateMutation = useSimularMonitoreo();
  const metrics = statsQuery.data ?? {};
  const loading = statsQuery.isPending;
  const simulating = simulateMutation.isPending;
  const error = statsQuery.isError ? getApiErrorMessage(statsQuery.error) : simulateMutation.isError ? getApiErrorMessage(simulateMutation.error) : '';
  const simulation = simulateMutation.data;

  const entries = Object.entries(metrics).sort(([left], [right]) => left.localeCompare(right));

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><div className="flex items-center gap-2"><span className="text-sm font-semibold text-blue-700">Administración</span><Badge variant="outline"><ShieldCheck className="mr-1 size-3" />Rol {CURRENT_USER_ROLE}</Badge></div><h1 className="mt-2 text-3xl font-black tracking-tight">Estado de la plataforma</h1><p className="mt-2 text-sm text-slate-500">Métricas persistidas y herramientas operativas del entorno.</p></div>
        <Button variant="outline" disabled={loading} onClick={() => void statsQuery.refetch()}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</Button>
      </header>

      {error && <Alert><AlertTitle>No pudimos cargar el panel</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      {loading && entries.length === 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}</div> : entries.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{entries.map(([name, value]) => <MetricCard key={name} name={name} value={value} />)}</div>
      ) : !error && <Card className="rounded-2xl border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><BarChart3 className="mb-3 size-9 text-slate-300" /><h2 className="font-semibold">Todavía no hay métricas</h2><p className="mt-1 text-sm text-slate-500">Los contadores aparecerán cuando se utilicen las funciones del sistema.</p></CardContent></Card>}

      <Card className="rounded-2xl border-blue-100 bg-gradient-to-br from-white to-blue-50/60">
        <CardHeader className="p-6 pb-3"><CardTitle className="flex items-center gap-2 text-lg"><BellRing className="size-5 text-blue-600" />Simulación de monitoreo</CardTitle><p className="mt-1 max-w-2xl text-sm text-slate-500">Ejecuta el escenario mock del backend para comprobar la evaluación climática y el envío de notificaciones sin esperar al cronjob.</p></CardHeader>
        <CardContent className="flex flex-col items-start justify-between gap-5 px-6 pb-6 sm:flex-row sm:items-end">
          <div>{simulation ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800"><AlertTitle>{simulation.actividadEvaluada}</AlertTitle><AlertDescription>{simulation.mensaje}</AlertDescription></Alert> : <p className="text-xs text-slate-500">El resultado se muestra aquí y los mensajes simulados también quedan visibles en la consola del backend.</p>}</div>
          <Button className="shrink-0" disabled={simulating} onClick={() => simulateMutation.mutate()}>{simulating ? <LoaderCircle className="size-4 animate-spin" /> : <Activity className="size-4" />}Ejecutar simulación</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ name, value }: { name: string; value: number }) {
  const Icon = metricIcon(name);
  return <Card className="rounded-2xl"><CardContent className="p-5"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">{createElement(Icon, { className: 'size-5' })}</span><span className="text-3xl font-black tracking-tight">{value.toLocaleString('es-AR')}</span></div><p className="mt-5 text-sm font-semibold text-slate-700">{formatMetricName(name)}</p></CardContent></Card>;
}

function metricIcon(name: string): ComponentType<{ className?: string }> {
  const normalized = name.toLocaleLowerCase('es');
  if (normalized.includes('clima') || normalized.includes('weather')) return CloudRain;
  if (normalized.includes('usuario')) return UsersRound;
  if (normalized.includes('reprogram')) return CalendarClock;
  return Activity;
}
