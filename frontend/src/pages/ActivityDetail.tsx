import { useEffect, useState } from 'react';
import { ArrowLeft, BellRing, CalendarClock, CalendarDays, CloudRain, LoaderCircle, LogIn, LogOut, MapPin, ShieldCheck, Thermometer, UsersRound, Wind } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ActivityStatusBadge from '../components/ActivityStatusBadge';
import VotingPanel from '../components/VotingPanel';
import WeatherPanel from '../components/WeatherPanel';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { activityTypeLabels, formatDateTime, formatLocation } from '../lib/formatters';
import api, { CURRENT_USER_ID, getApiErrorMessage } from '../services/api';
import type { Actividad } from '../types/api';

/** Vista operativa de una actividad: cupos, clima, reglas y votaciones. */
export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Actividad>();
  const [loading, setLoading] = useState(true);
  const [loadingParticipation, setLoadingParticipation] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get<Actividad>(`/actividades/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((response) => setActivity(response.data))
      .catch((cause) => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, reloadVersion]);

  async function changeParticipation(action: 'join' | 'leave') {
    if (!activity) return;
    setLoadingParticipation(true);
    setError('');
    setFeedback('');
    try {
      const path = `/actividades/${encodeURIComponent(activity.id)}/participantes${action === 'leave' ? '/me' : ''}`;
      const response = action === 'join' ? await api.post<Actividad>(path) : await api.delete<Actividad>(path);
      setActivity(response.data);
      setFeedback(action === 'join' ? 'Ya estás inscripto en esta actividad.' : 'Tu lugar quedó liberado.');
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setLoadingParticipation(false);
    }
  }

  if (loading && !activity) return <div className="space-y-5"><Skeleton className="h-6 w-40" /><Skeleton className="h-52 rounded-2xl" /><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div></div>;

  if (!activity) return <div className="mx-auto max-w-xl py-16"><Alert><AlertTitle>No pudimos abrir la actividad</AlertTitle><AlertDescription>{error || 'La actividad no existe.'}</AlertDescription></Alert><div className="mt-5 flex flex-wrap items-center gap-4"><Button variant="outline" onClick={() => setReloadVersion((current) => current + 1)}>Reintentar</Button><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft className="size-4" />Volver a descubrir</Link></div></div>;

  const organizer = activity.creadorId === CURRENT_USER_ID;
  const participant = activity.participantes.includes(CURRENT_USER_ID);
  const full = activity.participantes.length >= activity.max_participantes;
  const terminal = activity.estado === 'CANCELADA' || activity.estado === 'FINALIZADA';
  const occupancy = activity.max_participantes ? activity.participantes.length / activity.max_participantes * 100 : 0;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"><ArrowLeft className="size-4" />Volver a actividades</Link>

      {error && <Alert><AlertTitle>No pudimos completar la acción</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {feedback && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800"><AlertDescription>{feedback}</AlertDescription></Alert>}

      <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
        <div className="h-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400" />
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2"><Badge variant="outline">{activityTypeLabels[activity.tipo]}</Badge><ActivityStatusBadge status={activity.estado} />{organizer && <Badge variant="warning"><ShieldCheck className="mr-1 size-3" />Organizás esta actividad</Badge>}</div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{activity.titulo}</h1>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600 sm:text-base">{activity.descripcion}</p>
            </div>
            <div className="shrink-0 lg:w-52">
              {organizer ? <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><p className="font-semibold">Sos el organizador</p><p className="mt-1 text-xs text-blue-700">Administrá la votación más abajo.</p></div> : participant ? <Button variant="outline" className="w-full" disabled={loadingParticipation || terminal} onClick={() => changeParticipation('leave')}>{loadingParticipation ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}Bajarme</Button> : <Button className="w-full" disabled={loadingParticipation || full || terminal} onClick={() => changeParticipation('join')}>{loadingParticipation ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}{full ? 'Sin cupos' : 'Sumarme'}</Button>}
            </div>
          </div>

          <div className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <DetailItem icon={CalendarDays} label="Fecha y horario" value={formatDateTime(activity.fecha_horario)} />
            <DetailItem icon={MapPin} label="Ubicación" value={formatLocation(activity.ubicacion)} />
            <div><DetailItem icon={UsersRound} label="Participantes" value={`${activity.participantes.length} de ${activity.max_participantes}`} /><Progress value={occupancy} className="mt-3" /></div>
          </div>
          {activity.ubicacion.tipo === 'coordenadas' && <a href={`https://www.openstreetmap.org/?mlat=${activity.ubicacion.latitud}&mlon=${activity.ubicacion.longitud}#map=16/${activity.ubicacion.latitud}/${activity.ubicacion.longitud}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"><MapPin className="size-3.5" />Abrir ubicación en el mapa</a>}
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <WeatherPanel activity={activity} />
        <RulesCard activity={activity} />
      </div>

      <VotingPanel activity={activity} onActivityChange={setActivity} />
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon className="size-4" /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div></div>;
}

function RulesCard({ activity }: { activity: Actividad }) {
  const rules = activity.reglasClima;
  return <Card className="rounded-2xl"><CardHeader className="p-6 pb-4"><CardTitle className="text-lg">Reglas del organizador</CardTitle><p className="mt-1 text-xs text-slate-500">Límites usados para evaluar el pronóstico y proponer fechas.</p></CardHeader><CardContent className="px-6 pb-6">{rules ? <div className="grid gap-3 sm:grid-cols-2"><Rule icon={CloudRain} label="Lluvia máxima" value={`${rules.probabilidad_lluvia_max}%`} /><Rule icon={Thermometer} label="Temperatura" value={`${rules.temperatura_min} a ${rules.temperatura_max} °C`} /><Rule icon={Wind} label="Viento máximo" value={`${rules.viento_max} km/h`} /><Rule icon={BellRing} label="Anticipación" value={`${rules.horas_anticipacion} horas`} /><Rule icon={CalendarClock} label="Reprogramación" value={`Hasta ${rules.dias_max_reprogramacion} días`} /><Rule icon={ClockIcon} label="Franja horaria" value={`${rules.rango_horario.horario_min}–${rules.rango_horario.horario_max}`} /></div> : <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center"><ShieldCheck className="mx-auto mb-3 size-7 text-slate-300" /><p className="text-sm font-semibold">Sin reglas configuradas</p><p className="mt-1 text-xs text-slate-500">El organizador todavía no definió condiciones climáticas.</p></div>}</CardContent></Card>;
}

const ClockIcon = CalendarClock;

function Rule({ icon: Icon, label, value }: { icon: typeof CloudRain; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><Icon className="size-4 shrink-0 text-blue-600" /><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 text-sm font-bold">{value}</p></div></div>;
}
