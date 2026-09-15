import type { ComponentType } from 'react';
import { Cloud, CloudLightning, CloudRain, CloudSun, Droplets, RefreshCw, Sun, Thermometer, Wind } from 'lucide-react';
import { useClimaActividad } from '../hooks/useClima';
import { getApiErrorMessage } from '../services/api';
import type { Actividad, CondicionClima } from '../types/api';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';

const weatherIcons: Record<CondicionClima, ComponentType<{ className?: string }>> = {
  SOLEADO: Sun,
  NUBLADO: Cloud,
  PARCIALMENTE_NUBLADO: CloudSun,
  LLUVIA: CloudRain,
  TORMENTA: CloudLightning,
};

const weatherLabels: Record<CondicionClima, string> = {
  SOLEADO: 'Soleado',
  NUBLADO: 'Nublado',
  PARCIALMENTE_NUBLADO: 'Parcialmente nublado',
  LLUVIA: 'Lluvia',
  TORMENTA: 'Tormenta',
};

/** Consulta y presenta las condiciones actuales y las previstas para una actividad. */
export default function WeatherPanel({ activity }: { activity: Actividad }) {
  const weatherQuery = useClimaActividad(activity.id);
  const weather = weatherQuery.data;
  const loading = weatherQuery.isPending;
  const error = weatherQuery.isError ? getApiErrorMessage(weatherQuery.error) : '';

  if (loading && !weather) return <Card className="rounded-2xl"><CardContent className="space-y-4 p-6"><Skeleton className="h-6 w-40" /><Skeleton className="h-32 w-full" /></CardContent></Card>;

  if (error && !weather) return <Alert><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void weatherQuery.refetch()}><RefreshCw className="size-3.5" />Reintentar</Button></AlertDescription></Alert>;
  if (!weather) return null;

  const CurrentIcon = weatherIcons[weather.clima_actual.condicion];
  const ForecastIcon = weatherIcons[weather.pronostico_actividad.condicion];
  const rules = activity.reglasClima;
  const suitable = rules
    ? weather.pronostico_actividad.probabilidad_lluvia <= rules.probabilidad_lluvia_max
      && weather.pronostico_actividad.temperatura >= rules.temperatura_min
      && weather.pronostico_actividad.temperatura <= rules.temperatura_max
      && weather.pronostico_actividad.viento <= rules.viento_max
    : undefined;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-6 pb-4">
        <div><CardTitle className="text-lg">Clima de la actividad</CardTitle><p className="mt-1 text-xs text-slate-500">Datos actuales y pronóstico para el horario programado.</p></div>
        <Button variant="ghost" size="icon" aria-label="Actualizar clima" disabled={weatherQuery.isFetching} onClick={() => void weatherQuery.refetch()}><RefreshCw className={`size-4 ${weatherQuery.isFetching ? 'animate-spin' : ''}`} /></Button>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <WeatherBlock title="Ahora" icon={CurrentIcon} condition={weatherLabels[weather.clima_actual.condicion]} metrics={[
            { icon: Thermometer, label: `${weather.clima_actual.temperatura} °C` },
            { icon: Wind, label: `${weather.clima_actual.viento} km/h` },
            { icon: Droplets, label: `${weather.clima_actual.humedad}% humedad` },
          ]} />
          <WeatherBlock title="Para la actividad" icon={ForecastIcon} condition={weatherLabels[weather.pronostico_actividad.condicion]} metrics={[
            { icon: Thermometer, label: `${weather.pronostico_actividad.temperatura} °C` },
            { icon: Wind, label: `${weather.pronostico_actividad.viento} km/h` },
            { icon: CloudRain, label: `${weather.pronostico_actividad.probabilidad_lluvia}% lluvia` },
          ]} />
        </div>
        {suitable !== undefined && <div className={`flex items-center justify-between rounded-xl border p-3 ${suitable ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div><p className="text-sm font-semibold">{suitable ? 'Pronóstico dentro de las reglas' : 'Pronóstico fuera de las reglas'}</p><p className="mt-0.5 text-xs text-slate-600">Comparado con los límites definidos por el organizador.</p></div><Badge variant={suitable ? 'success' : 'warning'}>{suitable ? 'Favorable' : 'Revisar'}</Badge></div>}
      </CardContent>
    </Card>
  );
}

function WeatherBlock({ title, icon: Icon, condition, metrics }: { title: string; icon: ComponentType<{ className?: string }>; condition: string; metrics: Array<{ icon: ComponentType<{ className?: string }>; label: string }> }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-white text-blue-600 shadow-sm"><Icon className="size-6" /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p><p className="font-bold">{condition}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{metrics.map(({ icon: MetricIcon, label }) => <span key={label} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-600 shadow-sm"><MetricIcon className="size-3.5 text-slate-400" />{label}</span>)}</div></div>;
}
