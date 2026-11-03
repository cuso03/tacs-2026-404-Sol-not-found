import { createElement, type ComponentType } from 'react';
import { Activity, AlertOctagon, BarChart3, CalendarClock, CheckCircle2, Clock, CloudRain, Cpu, Database, Flame, RefreshCw, ShieldAlert, UsersRound, ZapOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { useEstadisticas, useTelemetriaClima } from '../hooks/useAdmin';
import { formatMetricName } from '../lib/formatters';
import { getApiErrorMessage } from '../services/api';

/** Panel administrativo con métricas acumuladas y telemetría de resiliencia (User Story 4). */
export default function Admin() {
  const statsQuery = useEstadisticas();
  const climaStatsQuery = useTelemetriaClima();

  const metrics = statsQuery.data ?? {};
  const loading = statsQuery.isPending;
  const error = statsQuery.isError ? getApiErrorMessage(statsQuery.error) : '';

  const climaData = climaStatsQuery.data;
  const loadingClima = climaStatsQuery.isPending;
  const legacy = climaData?.proveedores?.legacy;

  const entries = Object.entries(metrics).sort(([left], [right]) => left.localeCompare(right));

  const handleRefresh = () => {
    void statsQuery.refetch();
    void climaStatsQuery.refetch();
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-700">Administración</span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Estado de la plataforma</h1>
          <p className="mt-2 text-sm text-slate-500">
            Telemetría de resiliencia en tiempo real y contadores acumulados de eventos.
          </p>
        </div>
        <Button variant="outline" disabled={loading || loadingClima} onClick={handleRefresh}>
          <RefreshCw className={`size-4 ${(loading || loadingClima) ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </header>

      {error && (
        <Alert>
          <AlertTitle>No pudimos cargar el panel</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* SECCIÓN 1: TELEMETRÍA DE PROVEEDORES DE CLIMA & RESILIENCIA (USER STORY 4) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="size-5 text-indigo-600" />
          <h2 className="text-lg font-bold tracking-tight">Telemetría de Proveedores de Clima</h2>
        </div>

        {loadingClima && !climaData ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}
          </div>
        ) : legacy ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. ESTADO DEL PROVEEDOR LEGACY */}
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <CloudRain className="size-5" />
                  </span>
                  <HealthBadge status={legacy.estado} />
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Proveedor Legacy</p>
                  <p className="text-sm font-bold text-slate-800 truncate" title={legacy.nombre}>
                    {legacy.nombre}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Probes: /healthz y /readyz
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 2. ESTADO DEL CIRCUIT BREAKER */}
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                    <ShieldAlert className="size-5" />
                  </span>
                  <CircuitBreakerBadge state={legacy.circuitBreaker.estado} />
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Circuit Breaker</p>
                  <p className="text-2xl font-black tracking-tight text-slate-900">
                    {legacy.circuitBreaker.estado}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Fallos seguidos: <strong>{legacy.circuitBreaker.fallosConsecutivos}</strong>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 3. CACHÉ HIT RATIO */}
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Database className="size-5" />
                  </span>
                  <Badge variant="outline" className="font-semibold text-emerald-700">
                    {legacy.cache.hitRatioPct}% Hit
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Caché Legacy (10m TTL)</p>
                  <p className="text-2xl font-black tracking-tight text-slate-900">
                    {legacy.cache.hits} <span className="text-xs font-normal text-slate-400">hits / {legacy.cache.misses} misses</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Protege el caudal al binario
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 4. FALLBACKS EJECUTADOS */}
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-600">
                    <Flame className="size-5" />
                  </span>
                  <Badge variant="outline" className="font-semibold text-orange-700">
                    Resiliencia
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fallbacks a Visual Crossing</p>
                  <p className="text-2xl font-black tracking-tight text-slate-900">
                    {legacy.metricas.fallbacksEjecutados}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Consultas salvadas sin caída
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="rounded-2xl border-slate-200 bg-slate-50/50 p-5">
            <p className="text-sm text-slate-500">Telemetría de proveedores de clima no disponible o en espera de inicio del servicio.</p>
          </Card>
        )}

        {legacy && (
          <Card className="rounded-2xl border-slate-200">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-bold text-slate-700">Desglose Operativo del Proveedor Legacy</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 pt-3">
                <MiniMetric label="Total consultas" value={legacy.metricas.consultasTotales} />
                <MiniMetric label="Exitosas" value={legacy.metricas.consultasExitosas} color="text-emerald-600" />
                <MiniMetric label="Fallidas" value={legacy.metricas.consultasFallidas} color="text-red-600" />
                <MiniMetric label="Errores timeout" value={legacy.metricas.erroresTimeout} color="text-amber-600" />
                <MiniMetric label="Errores validación" value={legacy.metricas.erroresValidacion} color="text-rose-600" />
                <MiniMetric label="Bloqueos circuit breaker" value={legacy.metricas.erroresCircuitOpen} color="text-purple-600" />
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* SECCIÓN 2: MÉTRICAS HISTÓRICAS DE EVENTOS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight">Eventos de la Plataforma</h2>

        {loading && entries.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}
          </div>
        ) : entries.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {entries.map(([name, value]) => <MetricCard key={name} name={name} value={value} />)}
          </div>
        ) : !error && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <BarChart3 className="mb-3 size-9 text-slate-300" />
              <h2 className="font-semibold">Todavía no hay métricas acumuladas</h2>
              <p className="mt-1 text-sm text-slate-500">Los contadores aparecerán cuando se utilicen las funciones del sistema.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function HealthBadge({ status }: { status: 'OK' | 'DEGRADED' | 'OUTAGE' }) {
  if (status === 'OK') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1">
        <CheckCircle2 className="size-3" /> Operativo
      </Badge>
    );
  }
  if (status === 'DEGRADED') {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 flex items-center gap-1">
        <Clock className="size-3" /> Degradado
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1">
      <AlertOctagon className="size-3" /> Caído
    </Badge>
  );
}

function CircuitBreakerBadge({ state }: { state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }) {
  if (state === 'CLOSED') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1">
        <CheckCircle2 className="size-3" /> CLOSED (Normal)
      </Badge>
    );
  }
  if (state === 'HALF_OPEN') {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 flex items-center gap-1">
        <Clock className="size-3" /> HALF-OPEN (Prueba)
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1">
      <ZapOff className="size-3" /> OPEN (Disparado)
    </Badge>
  );
}

function MiniMetric({ label, value, color = 'text-slate-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${color}`}>{value.toLocaleString('es-AR')}</p>
    </div>
  );
}

function MetricCard({ name, value }: { name: string; value: number }) {
  const Icon = metricIcon(name);
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
            {createElement(Icon, { className: 'size-5' })}
          </span>
          <span className="text-3xl font-black tracking-tight">{value.toLocaleString('es-AR')}</span>
        </div>
        <p className="mt-5 text-sm font-semibold text-slate-700">{formatMetricName(name)}</p>
      </CardContent>
    </Card>
  );
}

function metricIcon(name: string): ComponentType<{ className?: string }> {
  const normalized = name.toLocaleLowerCase('es');
  if (normalized.includes('clima') || normalized.includes('weather')) return CloudRain;
  if (normalized.includes('usuario')) return UsersRound;
  if (normalized.includes('reprogram')) return CalendarClock;
  return Activity;
}
