import { ArrowRight, CalendarDays, MapPin, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { activityTypeLabels, formatDateTime, formatLocation } from '../lib/formatters';
import type { Actividad } from '../types/api';
import ActivityStatusBadge from './ActivityStatusBadge';
import { Badge } from './ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

/** Resumen navegable de una actividad obtenida de la API. */
export default function ActivityCard(activity: Actividad) {
  const occupied = activity.participantes.length;
  const percentage = activity.max_participantes > 0 ? (occupied / activity.max_participantes) * 100 : 0;
  const isFull = occupied >= activity.max_participantes;

  return (
    <Card className="group flex h-full flex-col rounded-2xl border-slate-200 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-950/5">
      <CardHeader className="space-y-4 p-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">{activityTypeLabels[activity.tipo]}</Badge>
          <ActivityStatusBadge status={activity.estado} />
        </div>
        <div>
          <CardTitle className="line-clamp-1 text-lg font-bold tracking-tight text-slate-950 group-hover:text-blue-700">{activity.titulo}</CardTitle>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{activity.descripcion}</p>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 px-5 pb-0 text-sm text-slate-600">
        <div className="flex items-start gap-2.5"><CalendarDays className="mt-0.5 size-4 shrink-0 text-slate-400" /><span>{formatDateTime(activity.fecha_horario)}</span></div>
        <div className="flex items-start gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" /><span className="line-clamp-2">{formatLocation(activity.ubicacion)}</span></div>
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><UsersRound className="size-3.5 text-slate-400" />{occupied} participantes</span><span className={isFull ? 'font-semibold text-rose-600' : 'text-slate-400'}>{isFull ? 'Sin cupos' : `${activity.max_participantes - occupied} disponibles`}</span></div>
          <Progress value={percentage} />
        </div>
      </CardContent>

      <CardFooter className="mt-5 border-t border-slate-100 p-0">
        <Link to={`/actividades/${activity.id}`} className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-blue-700 outline-none transition hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
          Ver actividad <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
