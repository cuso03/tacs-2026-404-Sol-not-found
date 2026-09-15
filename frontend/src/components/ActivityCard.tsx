import type { Actividad } from '../types/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';

/** Tarjeta homogénea para una actividad obtenida de la API. */
export default function ActivityCard({ titulo, descripcion, tipo, estado, fecha_horario, ubicacion, participantes, max_participantes }: Actividad) {
  const isFull = participantes.length >= max_participantes;
  const typeLabels = { aire_libre: '🌳 Aire libre', techada: '🏢 Techada', mixta: '⛅ Mixta' };
  const statusStyles: Record<string, string> = {
    PROPUESTA: 'bg-blue-50 text-blue-700 border-blue-200',
    EN_VOTACION: 'bg-amber-50 text-amber-800 border-amber-300 font-bold animate-pulse',
    CONFIRMADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REPROGRAMADA: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    CANCELADA: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  const formattedDate = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(fecha_horario));
  const formattedLocation = ubicacion.tipo === 'ciudad'
    ? `${ubicacion.ciudad}, ${ubicacion.pais}`
    : ubicacion.direccion ?? `${ubicacion.latitud.toFixed(4)}, ${ubicacion.longitud.toFixed(4)}`;

  return (
    <Card className="group flex cursor-pointer flex-col justify-between rounded-2xl transition hover:border-blue-400 hover:shadow-md">
      <div>
        <CardHeader className="p-5 pb-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{typeLabels[tipo]}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[estado] ?? 'border-slate-200 bg-slate-100 text-slate-700'}`}>
              {estado.replace('_', ' ')}
            </span>
          </div>
          <CardTitle className="line-clamp-1 text-base font-bold text-slate-900 transition group-hover:text-blue-600">{titulo}</CardTitle>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{descripcion}</p>
        </CardHeader>

        <CardContent className="space-y-2 px-5 pb-0 text-xs text-slate-600">
          <div className="flex items-center gap-2"><span>📅</span><span className="font-medium">{formattedDate}</span></div>
          <div className="flex items-center gap-2"><span>📍</span><span className="truncate">{formattedLocation}</span></div>
        </CardContent>
      </div>

      <CardFooter className="mx-5 mt-5 flex items-center justify-between border-t border-slate-100 px-0 pb-4 pt-3 text-xs">
        <span className={`font-medium ${isFull ? 'font-bold text-rose-600' : 'text-slate-500'}`}>👥 {participantes.length}/{max_participantes} cupos</span>
        <span className="inline-flex font-semibold text-blue-600 transition group-hover:translate-x-0.5">Ver detalle →</span>
      </CardFooter>
    </Card>
  );
}
