import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../services/api';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/Button';
import type { PaginatedResponse } from '../types/api';

interface ActividadResumen {
  id: string;
  titulo: string;
  fecha_horario: string;
  rol: 'organizador' | 'participante';
  estado: string;
  votacion_abierta: boolean;
}

export default function Dashboard() {
  const [filtro, setFiltro] = useState<'todas' | 'organizador' | 'participante'>('todas');
  const [actividades, setActividades] = useState<ActividadResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    api.get<PaginatedResponse<ActividadResumen>>('/usuarios/me/actividades', { signal: controller.signal })
      .then((response) => setActividades(response.data.data))
      .catch((cause) => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const actividadesFiltradas = actividades.filter((activity) => filtro === 'todas' || activity.rol === filtro);
  const statusStyles: Record<string, string> = {
    PROPUESTA: 'border-blue-200 bg-blue-50 text-blue-700',
    EN_VOTACION: 'border-amber-300 bg-amber-50 font-bold text-amber-800',
    CONFIRMADA: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="space-y-6">
      {error && <Alert><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
          <div><h1 className="text-2xl font-bold text-slate-900">Mi Dashboard</h1><p className="mt-1 text-xs text-slate-500">Actividades organizadas por vos o donde participás.</p></div>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            <Button size="sm" variant={filtro === 'todas' ? 'outline' : 'ghost'} onClick={() => setFiltro('todas')}>Todas</Button>
            <Button size="sm" variant={filtro === 'organizador' ? 'outline' : 'ghost'} onClick={() => setFiltro('organizador')}>Organizador</Button>
            <Button size="sm" variant={filtro === 'participante' ? 'outline' : 'ghost'} onClick={() => setFiltro('participante')}>Participante</Button>
          </div>
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {loading ? <div className="py-12 text-center text-sm text-slate-500">Cargando tus actividades...</div> : actividadesFiltradas.length > 0 ? actividadesFiltradas.map((activity) => (
            <div key={activity.id} className="flex cursor-pointer flex-col justify-between gap-3 rounded-xl px-3 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{activity.titulo}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${activity.rol === 'organizador' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>{activity.rol === 'organizador' ? 'Organizador' : 'Participante'}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusStyles[activity.estado] ?? 'border-slate-200 bg-slate-100 text-slate-700'}`}>{activity.estado}</span>
                  {activity.votacion_abierta && <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Votación activa</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">📅 {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.fecha_horario))}</p>
              </div>
              <span className="text-xs font-semibold text-blue-600">Ver detalle →</span>
            </div>
          )) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500">No tenés actividades registradas bajo este filtro.</div>}
        </div>
      </div>
    </div>
  );
}
